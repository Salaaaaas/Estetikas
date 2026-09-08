# Backend de la app móvil — puesta en marcha

Lo que la fase 2 añadió a este repo para que la app nativa
(`../estetikas-app`) pueda reservar. Todo es aditivo: la ruta web sigue
comprobando `Origin` y Turnstile exactamente igual que antes.

## Orden de ejecución

**1. Correr el SQL.** Supabase Dashboard → SQL Editor → New Query, pegar
`supabase/schema_mobile.sql`. Es idempotente.

**2. Añadir las variables de entorno** en Vercel, ANTES de desplegar: si el
código nuevo sube sin `PHONE_HASH_PEPPER`, `hashPhone` lanza y `create-booking`
devuelve 500 también en la web. Están documentadas en `.env.example`; estas dos
se generan ahora mismo:

```bash
openssl rand -base64 48   # → PHONE_HASH_PEPPER
openssl rand -base64 48   # → MOBILE_SESSION_SECRET
```

`PHONE_HASH_PEPPER` es tan crítico como `PII_ENCRYPTION_KEY`: si se pierde,
hay que recalcular todos los `telefono_hash` (se puede, porque los teléfonos
siguen siendo descifrables). `MOBILE_SESSION_SECRET` se puede rotar sin drama:
invalida las sesiones y las apps vuelven a atestar solas.

**3. Desplegar.** Aparecen `/api/mobile/attest` y el endpoint de backfill.

**4. Rellenar los hashes de las citas existentes.** Sin esto, las citas
anteriores a hoy no aparecerán en «Mis citas». Se hace contra el despliegue,
no en local:

```bash
BASE=https://estetikas.vercel.app
CRON=<el valor de CRON_SECRET>

curl -X POST "$BASE/api/admin/backfill-telefono-hash?dry=1" -H "Authorization: Bearer $CRON"
curl -X POST "$BASE/api/admin/backfill-telefono-hash"       -H "Authorization: Bearer $CRON"
```

Responde `{ actualizadas, fallidas, restantes, completo }`. Repetir mientras
`restantes > 0` (procesa 500 filas por llamada). Es idempotente.

Corre en Vercel a propósito: `PII_ENCRYPTION_KEY` está marcada como sensible y
no se puede volver a leer desde el dashboard ni con `vercel env pull`, así que
la clave de cifrado de producción nunca tiene que bajar a una máquina de
trabajo. `scripts/backfill-telefono-hash.mjs` hace lo mismo en local y sigue
ahí por si algún día se tiene la clave a mano.

**5. Comprobar que no se rompió nada** — la ruta web debe seguir igual:

```bash
npm test          # 31 comprobaciones de las piezas puras
npm run build     # el sitio sigue compilando
```

## Credenciales de las tiendas

La atestación no se puede probar sin ellas, y ninguna de las dos se consigue en
cinco minutos. Conviene pedirlas ya.

| Variable | De dónde sale |
| --- | --- |
| `APPLE_TEAM_ID` | developer.apple.com → Membership. Requiere cuenta de desarrollador. |
| `IOS_BUNDLE_ID` | El de la app: `cr.estetikas.app`. |
| `APP_ATTEST_ENV` | `production`. Solo `development` para probar con builds de Xcode. |
| `ANDROID_PACKAGE_NAME` | El de la app: `cr.estetikas.app`. |
| `GOOGLE_PLAY_INTEGRITY_SA_JSON` | Google Cloud → cuenta de servicio con acceso a la Play Integrity API, vinculada al proyecto de Play Console. Pegar el JSON tal cual o en base64. |

Hasta tenerlas, `/api/mobile/attest` responde `atestacion_rechazada` con
`app_attest_misconfigured` o `play_integrity_misconfigured` en el log. Falla
cerrado a propósito: una atestación que no se puede verificar no se acepta.

## Cómo entra la app

```
GET  /api/mobile/attest                    → { challenge }
POST /api/mobile/attest                    → { session, deviceId }
     { platform, challenge, attestation, keyId }        (iOS)
     { platform, challenge, token, deviceId }           (Android)

POST /api/create-booking
     Authorization: Bearer <session>       → sin Origin, sin Turnstile
```

El token de sesión dura 90 días. Revocar un dispositivo es poner `revoked_at`
en `mobile_devices`: `requireMobileSession` lo comprueba en cada petición.

## Qué cambió y por qué

| Cambio | Motivo |
| --- | --- |
| `create-booking` acepta `Authorization` en lugar de `Origin` | El `fetch` de React Native no envía `Origin`; la comprobación rechazaba toda reserva de la app. |
| Turnstile solo en la ruta web | Es un widget de navegador. En la app la barrera es la atestación del dispositivo. |
| `citas.telefono_hash` | `telefono_enc` es AES-GCM con IV aleatorio: no determinista, imposible de consultar. El HMAC permite buscar sin poder revertir. |
| `rate_limits_subject` + límite por dispositivo | Las operadoras celulares comparten IP entre miles de abonados; 5 por IP bloqueaba a clientas legítimas. Queda un techo por IP de 60. |
| `citas_slot_ciudad_unico_idx` | El índice global `(fecha, hora)` impedía que Katherine (Bataan) y la Dra. Karen (Guápiles) atendieran a la misma hora. |
| `get-availability?sede=` | Corolario del anterior: sin filtro, la parrilla mostraría como ocupadas horas que están libres en la otra ciudad. |

### Por qué el candado es por ciudad y no por sede

Guápiles tiene dos locales —Medical Numancia y Eco Clinic— y en los dos
atiende la misma persona. Un índice por sede exacta dejaría agendar a la Dra.
Karen a las 10:00 en ambos a la vez. Lo que no se puede duplicar es la
profesional, y la profesional la determina la ciudad: Bataan = Katherine,
Guápiles = Dra. Karen.

La función SQL `public.sede_ciudad` y `ciudadDeSede` en
`api/get-availability.mjs` son espejo la una de la otra; si se añade una sede
nueva hay que tocar las dos (y `SEDES_VALIDAS` en `api/_lib/validate.mjs`).

## Lo que no está verificado

`npm test` cubre las piezas puras: decodificador CBOR contra los vectores del
RFC 8949, lector DER contra la CA raíz real de Apple, normalización de
teléfonos, determinismo del hash, retos y sesiones, y los caminos de rechazo de
App Attest.

Lo que **no** se puede probar sin un dispositivo físico y las credenciales de
las tiendas es una atestación válida de extremo a extremo. La primera prueba
real es instalar la app en un teléfono con las variables ya configuradas.
