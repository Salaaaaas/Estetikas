// Reconciliación Google Calendar → tabla citas.
//
// Cuando Katherine borra o cancela un evento directamente en Google Calendar,
// la cita seguía viva en la BD y su hora quedaba bloqueada para siempre. Esto
// lo arregla marcándola como cancelada.
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
import { audit } from './security.mjs';

/**
 * Marca como canceladas las citas cuyo evento de Calendar ya no existe.
 *
 * Es idempotente: solo toca filas que aún no están canceladas, así que
 * repetirla sobre la misma ventana no hace nada la segunda vez.
 *
 * @param {number} minutesBack ventana de cambios a revisar
 * @param {string} origen      queda en el audit_log para saber quién disparó
 */
export async function syncCancellations(minutesBack, origen) {
  const events = await getRecentlyChangedEvents(minutesBack);
  const cancelled = events.filter((e) => e.status === 'cancelled');

  let canceladas = 0;

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

  return { revisados: events.length, cancelados_en_calendar: cancelled.length, canceladas };
}
