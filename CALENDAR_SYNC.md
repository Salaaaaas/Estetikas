# Sincronización Google Calendar → sitio

Cuando Katherine borra o cancela una cita directamente en Google Calendar, el
sitio tiene que enterarse: si no, la fila sigue viva en `citas` y esa hora queda
bloqueada para siempre en la parrilla de reservas.

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

La reconciliación es idempotente: solo toca filas que aún no están canceladas.

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
| `WEBHOOK_BASE_URL` | `https://estetikas.vercel.app` (respaldo; en producción Vercel ya expone `VERCEL_PROJECT_PRODUCTION_URL`) |

`CRON_SECRET` también hace falta, y ya está.

**3. Desplegar** y registrar el primer canal a mano — el cron lo renovará solo
a partir de ahí:

```bash
curl -X POST https://estetikas.vercel.app/api/register-calendar-watch \
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
`estetikas.vercel.app`. El método de archivo HTML sirve: ya hay dos archivos de
verificación en `public/` de intentos anteriores, y `astro build` los publica en
la raíz del sitio.

El detalle del error de Google se propaga tal cual en la respuesta y en los
logs, así que ahí se ve si es esto u otra cosa.

## Límite conocido

Solo se sincronizan **cancelaciones**. Si en Calendar se mueve una cita de hora
o de día, la BD no se entera y las dos fuentes quedan discrepando. Se puede
añadir cuando haga falta; hoy la clínica cancela mucho más de lo que reagenda.

`getRecentlyChangedEvents` pide 50 cambios como máximo por consulta y no pagina.
Para el volumen actual sobra; si algún día un solo día trae más de 50 cambios,
hay que paginar.
