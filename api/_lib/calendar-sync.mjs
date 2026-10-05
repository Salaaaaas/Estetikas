// Reconciliación Google Calendar → tabla citas.
//
// Cuando Katherine borra o cancela el evento de una cita directamente en
// Google Calendar, la cita se marca como cancelada en la BD. Cuando lo MUEVE
// a otra fecha u hora, la cita de la BD se mueve con él (antes quedaba en la
// hora vieja: bloqueaba ese turno y el recordatorio salía con la hora mala).
//
// Vive en su propio módulo porque hay DOS disparadores, a propósito:
//
//   1. El webhook push de Google (api/calendar-webhook.mjs), que reacciona en
//      segundos pero cuya entrega no está garantizada: el canal caduca, puede
//      fallar la red, o la función puede estar fría y devolver error.
//   2. El cron diario (api/register-calendar-watch.mjs), que además de renovar
//      el canal repasa una ventana larga.
//
// El segundo existe para que el sistema se cure solo. Si el push se pierde un
// día entero, la cancelación igual acaba aplicándose; sin él, una notificación
// perdida deja la hora bloqueada hasta que alguien lo note a mano.

import { supabase } from './supabase.mjs';
import { getRecentlyChangedEvents } from './calendar.mjs';
import { fechaHoraCR } from './agenda.mjs';
import { audit } from './security.mjs';

/**
 * Lleva a la tabla citas los cambios hechos en Calendar a eventos de citas:
 * borrados → cancelada; movidos → nueva fecha y hora.
 *
 * Es idempotente: solo toca filas que todavía difieren del Calendar, así que
 * repetirla sobre la misma ventana no hace nada la segunda vez.
 *
 * @param {number} minutesBack ventana de cambios a revisar
 * @param {string} origen      queda en el audit_log para saber quién disparó
 */
export async function syncDesdeCalendar(minutesBack, origen) {
  const events = await getRecentlyChangedEvents(minutesBack);
  const cancelled = events.filter((e) => e.status === 'cancelled');
  const vivos = events.filter((e) => e.status !== 'cancelled' && e.start?.dateTime);

  let canceladas = 0;
  let movidas = 0;
  let conflictos = 0;

  for (const event of cancelled) {
    const { data: updated, error } = await supabase
      .from('citas')
      .update({ estado: 'cancelada' })
      .eq('google_event_id', event.id)
      .neq('estado', 'cancelada')
      .select('id');

    if (error) {
      console.error('sync_cancel_error', { eventId: event.id, message: error.message });
      continue;
    }

    for (const row of updated ?? []) {
      canceladas++;
      await audit({
        actor: 'system',
        action: 'cancel_from_calendar',
        resourceId: row.id,
        metadata: { google_event_id: event.id, origen, ventana_min: minutesBack },
      });
    }
  }

  if (vivos.length > 0) {
    const { data: citas, error } = await supabase
      .from('citas')
      .select('id, fecha, hora, google_event_id')
      .in('google_event_id', vivos.map((e) => e.id))
      .neq('estado', 'cancelada');

    if (error) {
      console.error('sync_move_select_error', { message: error.message });
    } else {
      const porEvento = new Map(vivos.map((e) => [e.id, e]));
      for (const cita of citas ?? []) {
        const nuevo = fechaHoraCR(Date.parse(porEvento.get(cita.google_event_id).start.dateTime));
        if (nuevo.fecha === cita.fecha && nuevo.hora === cita.hora) continue;

        const antes = { fecha: cita.fecha, hora: cita.hora };
        const { error: errMove } = await supabase
          .from('citas')
          .update({ fecha: nuevo.fecha, hora: nuevo.hora })
          .eq('id', cita.id);

        // El índice de turno único o el trigger de sede por profesional pueden
        // rechazar el cambio (otra cita ya ocupa ese turno). Se deja la cita
        // como estaba y queda registrado para revisarlo a mano.
        if (errMove) {
          conflictos++;
          console.error('sync_move_error', { citaId: cita.id, message: errMove.message });
          await audit({
            actor: 'system',
            action: 'move_from_calendar_failed',
            resourceId: cita.id,
            metadata: { google_event_id: cita.google_event_id, antes, despues: nuevo, origen, code: errMove.code },
          });
          continue;
        }

        movidas++;
        await audit({
          actor: 'system',
          action: 'move_from_calendar',
          resourceId: cita.id,
          metadata: { google_event_id: cita.google_event_id, antes, despues: nuevo, origen, ventana_min: minutesBack },
        });
      }
    }
  }

  return {
    revisados: events.length,
    cancelados_en_calendar: cancelled.length,
    canceladas,
    movidas,
    conflictos,
  };
}
