# Esteti'Kas Instagram Automation Setup

Guía completa para configurar publicación automática de carruseles en Instagram.

---

## ¿Qué hace?

- **Lee datos de Supabase** (tratamientos, fotos antes/después, descripciones)
- **Genera carruseles automáticamente** con el diseño Esteti'Kas (Bodoni Moda + Jost, teal, etc.)
- **Publica directamente a Instagram** Graph API a horas fijas
- **Registra todo** en Supabase para control y análisis

**Flujo:**

```
Katherine sube datos a Supabase
         ↓
Script detecta datos pendientes
         ↓
Genera 3 slides automáticamente (antes, beneficios, CTA)
         ↓
Publica carrusel a Instagram @esteti_kas
         ↓
Marca como "publicado" en Supabase
```

---

## Requisitos previos

- ✅ Cuenta Instagram @esteti_kas (Business/Creator)
- ✅ Supabase project activo
- ✅ Node.js 18+ instalado
- ✅ Acceso a Meta Business Manager

---

## PASO 1: Crear tabla en Supabase

Copia y ejecuta esto en Supabase SQL Editor:

```sql
CREATE TABLE instagram_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR NOT NULL DEFAULT 'resultado', -- 'resultado', 'tratamiento', 'tip'
  tratamiento_id UUID REFERENCES tratamientos(id) ON DELETE CASCADE,
  cliente_nombre VARCHAR,
  foto_antes_url VARCHAR,
  foto_despues_url VARCHAR,
  descripcion TEXT,
  estado VARCHAR DEFAULT 'pendiente', -- 'pendiente', 'publicado', 'error'
  instagram_media_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice para queries rápidas
CREATE INDEX idx_instagram_queue_estado ON instagram_queue(estado);
CREATE INDEX idx_instagram_queue_created_at ON instagram_queue(created_at DESC);
```

---

## PASO 2: Obtener credenciales Instagram Graph API

### 2.1 Obtén tu Business Account ID

1. Ve a **instagram.com/@esteti_kas**
2. **Settings → Account → Professional dashboard**
3. Copia el número grande que ves en la URL o en "Account ID"

**O via Graph API:**

1. Ve a **developers.facebook.com**
2. Crea una app (si no tienes)
3. **Tools → Graph API Explorer**
4. Escribe: `GET /me/instagram_business_account`
5. Ejecuta y copia el `id` del resultado

```json
{
  "instagram_business_account": {
    "id": "17841408745XXXXX", ← COPIAR ESTO
    "username": "esteti_kas"
  }
}
```

### 2.2 Obtén tu Access Token

1. En **Meta Business Manager** (business.facebook.com)
2. Settings → Users and Permissions
3. **Apps and websites**
4. Busca tu app (crea una si no existe)
5. **Tools → API token generator**
6. Selecciona permisos:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `instagram_content_publishing`
7. Genera token y **cópialo** (válido 60 días — plan renovar)

**O via Graph API Explorer:**

1. Graph API Explorer → Selecciona tu app
2. Token → Generate Access Token
3. Permisos: `instagram_manage_insights`, `pages_manage_posts`, `instagram_content_publishing`
4. Copia el token

⚠️ **Importante:** Este token expira cada 60 días. Guárdalo en `.env` (no en Git).

---

## PASO 3: Configurar variables de entorno

1. Copia el archivo `.env.instagram.example`:

```bash
cp .env.instagram.example .env.local
```

2. Abre `.env.local` y completa:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here
INSTAGRAM_BUSINESS_ID=17841408745XXXXX
INSTAGRAM_ACCESS_TOKEN=IGQVR7xxxxxxxxxxxxxxxxxxxxxx
```

3. **NUNCA hagas commit de `.env.local`** — ya está en `.gitignore`

---

## PASO 4: Instalar dependencias

```bash
npm install @supabase/supabase-js sharp node-fetch
```

(Si ya tiene estas librerías, sáltalo)

---

## PASO 5: Probar el script

### Test mode (no publica, solo genera imágenes)

```bash
node scripts/instagram-auto-poster.mjs --test
```

Deberías ver:
```
[INFO] Starting Esteti'Kas Instagram Auto-Poster...
[INFO] Processing post: uuid-123
[✓] Carousel generated: .instagram-carousel/carousel_12345_1.png
[⚠] [TEST MODE] Would upload carousel with caption: ...
[✓] Post uuid-123 processed successfully
```

### Dry run (genera y publica sin marcar como hecho)

```bash
node scripts/instagram-auto-poster.mjs
```

### Publicar de verdad

```bash
node scripts/instagram-auto-poster.mjs --publish
```

---

## PASO 6: Agregar datos de prueba

En Supabase, tabla `instagram_queue`, inserta:

```sql
INSERT INTO instagram_queue (type, cliente_nombre, descripcion, estado)
VALUES (
  'resultado',
  'Cliente Test',
  'Botox natural que realza sin perder expresión',
  'pendiente'
);
```

Luego ejecuta:

```bash
node scripts/instagram-auto-poster.mjs --publish
```

Verifica que el post aparezca en **instagram.com/@esteti_kas** 🎉

---

## PASO 7: Automatizar ejecución (Scheduler)

### Opción A: Cron Job (Linux/Mac)

```bash
# Abre crontab
crontab -e

# Agrega estas líneas (publica a 8 AM, 1 PM, 6 PM)
0 8 * * * cd /ruta/a/estetikas-astro && node scripts/instagram-auto-poster.mjs --publish
0 13 * * * cd /ruta/a/estetikas-astro && node scripts/instagram-auto-poster.mjs --publish
0 18 * * * cd /ruta/a/estetikas-astro && node scripts/instagram-auto-poster.mjs --publish
```

### Opción B: GitHub Actions (recomendado)

Crea `.github/workflows/instagram-daily.yml`:

```yaml
name: Instagram Daily Auto-Poster

on:
  schedule:
    - cron: "0 8,13,18 * * *" # 8 AM, 1 PM, 6 PM UTC

jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: node scripts/instagram-auto-poster.mjs --publish
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          INSTAGRAM_BUSINESS_ID: ${{ secrets.INSTAGRAM_BUSINESS_ID }}
          INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
```

### Opción C: Vercel Crons (si usas Vercel)

En `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/instagram-daily",
      "schedule": "0 8,13,18 * * *"
    }
  ]
}
```

Y crea `api/instagram-daily.mjs` que ejecute el script.

---

## Flujo de uso diario (Katherine)

1. **Después de un tratamiento:**
   - Toma foto antes y después
   - En Supabase, abre tabla `instagram_queue`
   - Inserta: cliente, fotos URLs, descripción breve
   - Estado = `pendiente`

2. **El script corre automáticamente** a las 8 AM, 1 PM, 6 PM
   - Lee la entrada
   - Genera carrusel (3 slides)
   - Publica a Instagram
   - Marca como `publicado`

3. **Verifica en Instagram**
   - @esteti_kas debe mostrar el post nuevo

---

## Troubleshooting

### ❌ "Missing Supabase credentials"

**Solución:** Verifica que `.env.local` tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

```bash
cat .env.local | grep SUPABASE
```

### ❌ "Instagram upload failed: 401 Unauthorized"

**Solución:** Token expiró (duran 60 días). Regenera en Meta Business Manager.

```bash
# Verifica el token
echo $INSTAGRAM_ACCESS_TOKEN

# Si es antiguo, regenera en developers.facebook.com
```

### ❌ "No pending posts in queue"

**Solución:** No hay datos en Supabase. Inserta uno de prueba:

```sql
INSERT INTO instagram_queue (cliente_nombre, descripcion, estado)
VALUES ('Test', 'Test caption', 'pendiente');
```

### ❌ "Cannot find module 'sharp'"

**Solución:** Instala dependencias:

```bash
npm install sharp @supabase/supabase-js node-fetch
```

---

## Renovación de Access Token (cada 60 días)

1. Ve a **Meta Business Manager**
2. **Settings → Users and Permissions → Apps and websites**
3. Genera nuevo token
4. Actualiza en `.env.local`:

```env
INSTAGRAM_ACCESS_TOKEN=nuevo-token-aqui
```

O si lo guardaste en GitHub Secrets:

```bash
# En GitHub, ve a Settings → Secrets → Actions
# Edita INSTAGRAM_ACCESS_TOKEN con el nuevo valor
```

---

## Monitoreo

Para ver logs de publicaciones:

```bash
# Ver últimos posts publicados
node scripts/instagram-auto-poster.mjs --list

# Ver posts con error
node scripts/instagram-auto-poster.mjs --errors
```

(Aún no implementado, pero fácil de agregar)

---

## Próximos pasos

1. ✅ Prueba con datos de teste
2. ✅ Configura scheduler (Cron o GitHub Actions)
3. ✅ Sube primer post real
4. ✅ Monitorea engagement diariamente

---

**Soporte:** Si algo falla, revisa los logs o contacta a Sebastián.
