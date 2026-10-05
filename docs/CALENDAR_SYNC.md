# Sincronización Google Calendar → sitio

Cuando Katherine borra, cancela o mueve una cita directamente en Google
Calendar, el sitio tiene que enterarse: si no, la fila de `citas` queda en la
hora vieja, ese turno sigue bloqueado y el recordatorio sale con datos malos.

- **Borrada o cancelada** → la cita pasa a `cancelada`.
- **Movida** (otra fecha u hora) → la cita toma la fecha y hora nuevas. Si el
  turno nuevo choca con otra cita (índice único o trigger de sede), no se
  cambia y queda `move_from_calendar_failed` en `audit_log` para revisarlo.

## Cómo funciona

Dos disparadores para la misma reconciliación (`api/_lib/calendar-sync.mjs`):

| Disparador | Cuándo | Ventana |
| --- | --- | --- |
| `api/calendar-webhook.mjs` | push de Google, en segundos | 2 h |
| `api/register-calendar-watch.mjs` | cron diario, 11:00 UTC (5 AM CR) | 26 h |

El push es rápido pero su entrega **no está garantizada**: el canal caduca, la
red falla, la función puede estar fría. Por eso el cron, además de renovar el
canal, repasa una ventana larga con dos horas de solape. Si un push se pierde,
la cancelación se aplica igual al día siguiente en vez de quedar colgada.

La reconciliación es idempotente: solo toca filas que todavía difieren del
Calendar.

## Por qué hacía falta arreglarlo

- **Nada renovaba el canal.** Los canales de push de Google Calendar caducan
  en una semana como mucho. Se registraba uno a mano y días después el sitio
  dejaba de enterarse, en silencio.
- **Los canales viejos no se cerraban.** Cada registro creaba uno nuevo sin
  parar el anterior, así que llegaban notificaciones duplicadas hasta que
  caducaban. Ahora `calendar_watch` guarda el vigente y se cierra antes de
  crear el siguiente.
- **El webhook fallaba abierto.** La comprobación del token se saltaba cuando
  `CALENDAR_WEBHOOK_TOKEN` no estaba configurada — justo el caso en que el
  endpoint queda expuesto. Ahora falla cerrado.
- **No había red de seguridad.** Todo dependía de que el push llegara.

## Puesta en marcha

**1. SQL:** pegar `supabase/schema_calendar_watch.sql` en el SQL Editor.

**2. Variables de entorno** en Vercel (Production y Preview):

| Variable | Valor |
| --- | --- |
| `CALENDAR_WEBHOOK_TOKEN` | `openssl rand -base64 32`, tipo Secret |
| `WEBHOOK_BASE_URL` | `https://estetikascr.com` (respaldo; en producción Vercel ya expone `VERCEL_PROJECT_PRODUCTION_URL`) |

`CRON_SECRET` también hace falta, y ya está.

**3. Desplegar** y registrar el primer canal a mano — el cron lo renovará solo
a partir de ahí:

```bash
curl -X POST https://estetikascr.com/api/register-calendar-watch \
  -H "Authorization: Bearer $CALENDAR_WEBHOOK_TOKEN"
```

Respuesta esperada: `{ ok: true, channelId, expiration, repaso: {...} }`.

**4. Comprobar** que el canal quedó guardado:

```sql
select channel_id, expiration, renewed_at from calendar_watch;
```

## Si el registro falla

El error más habitual es que Google rechace la dirección del webhook porque el
dominio no está verificado. Calendar exige que el dominio del `address` esté
verificado **en el proyecto de Google Cloud** que emite las credenciales — no
basta con tenerlo verificado en Search Console.

Google Cloud Console → APIs & Services → **Domain verification** → Add domain →
`estetikascr.com`. El método de archivo HTML sirve: ya hay dos archivos de
verificación en `public/` de intentos anteriores, y `astro build` los publica en
la raíz del sitio.

El detalle del error de Google se propaga tal cual en la respuesta y en los
logs, así que ahí se ve si es esto u otra cosa.

## Qué cuenta como ocupado en la parrilla

Reglas en `api/_lib/agenda.mjs` (pruebas: `node scripts/test-agenda.mjs`).
Todo se compara como intervalos: un turno de 60 min está ocupado si se cruza
aunque sea un minuto con algo del calendario.

| Evento en el Calendar | Efecto |
| --- | --- |
| Con sede en "Ubicación", creado por la clínica, con hora, título que no empieza con "Cita" | **Bloque de disponibilidad**: abre turnos |
| Cita del sitio ("Cita — Nombre") | Ocupa su hora en su ciudad |
| Evento personal o cita a mano sin sede | Ocupa todos los turnos que cruza, en todas las sedes |
| Evento con sede en "Ubicación" que no es bloque (cita a mano, invitación ajena) | Ocupa los turnos que cruza en esa ciudad |
| Evento de día completo (vacaciones, etc.) | Ocupa el día entero (o los días que abarque) |
| Cancelado, o invitación que Katherine rechazó | No cuenta |
