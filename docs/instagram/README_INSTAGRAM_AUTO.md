# Instagram Automation — Quick Start

Automatización completa de publicación de carruseles en Instagram.

---

## 🚀 Setup en 5 minutos

### 1. Crear tabla en Supabase

Copia el contenido de `sql/instagram_queue.sql` y pégalo en **Supabase SQL Editor**. Ejecuta.

### 2. Configurar credenciales

```bash
# Copia el archivo de ejemplo
cp .env.instagram.example .env.local

# Completa los valores:
# - VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ya deberías tenerlos)
# - INSTAGRAM_BUSINESS_ID (de tu cuenta de Instagram)
# - INSTAGRAM_ACCESS_TOKEN (de Meta Graph API)
```

Ver instrucciones completas en `INSTAGRAM_SETUP.md`

### 3. Instalar dependencias

```bash
npm install @supabase/supabase-js sharp node-fetch
```

### 4. Probar

```bash
# Test mode (no publica)
node scripts/instagram-auto-poster.mjs --test

# Publicar de verdad
node scripts/instagram-auto-poster.mjs --publish
```

---

## 📅 Uso diario (Katherine)

### Paso 1: Sube datos a Supabase

Abre **Supabase → Tabla `instagram_queue`** e inserta:

| Campo | Valor |
|-------|-------|
| type | `resultado` o `tip` |
| cliente_nombre | Ej: "María" |
| foto_antes_url | URL de foto antes (Supabase Storage o URL externa) |
| foto_despues_url | URL de foto después |
| descripcion | Copy breve del post |
| estado | `pendiente` |

**Ejemplo SQL:**

```sql
INSERT INTO instagram_queue (
  type, cliente_nombre, foto_antes_url, foto_despues_url,
  descripcion, estado
) VALUES (
  'resultado', 'María',
  'https://storage.esteti.co/antes.jpg',
  'https://storage.esteti.co/despues.jpg',
  'Botox natural: resultados sin perder expresión',
  'pendiente'
);
```

### Paso 2: El script corre automáticamente

- **8 AM, 1 PM, 6 PM** (horarios configurables)
- Lee tabla `instagram_queue`
- Genera carrusel automático (3 slides)
- Publica a Instagram
- Marca como `publicado`

### Paso 3: Verifica en Instagram

@esteti_kas debe mostrar el post nuevo.

---

## 📊 Monitoreo

### Ver posts pendientes

```sql
SELECT * FROM instagram_queue WHERE estado = 'pendiente' ORDER BY created_at ASC;
```

### Ver posts publicados hoy

```sql
SELECT * FROM vw_instagram_hoy_pendientes;
```

### Ver errores

```sql
SELECT * FROM vw_instagram_errores;
```

---

## 🎨 Qué genera el script

**Slide 1:** Nombre tratamiento + fotos antes/después  
**Slide 2:** Beneficios del tratamiento (lista de 4)  
**Slide 3:** CTA con logo Esteti'Kas

Estilo: Teal (#007D88), Bodoni Moda + Jost, blanco limpio. Consistente con identidad visual.

---

## ⚙️ Configurar scheduler (automático)

### Opción A: GitHub Actions (RECOMENDADO)

1. Abre `.github/workflows/instagram-daily.yml` (crear si no existe)
2. Pega:

```yaml
name: Instagram Auto-Poster
on:
  schedule:
    - cron: "0 8,13,18 * * *"
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

3. En GitHub: **Settings → Secrets → Actions**
4. Agrega las 4 variables de ambiente

### Opción B: Cron job local (Linux/Mac)

```bash
crontab -e

# Agrega:
0 8,13,18 * * * cd /ruta/a/estetikas-astro && node scripts/instagram-auto-poster.mjs --publish
```

### Opción C: Vercel Crons (si usas Vercel)

En `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/instagram-daily",
    "schedule": "0 8,13,18 * * *"
  }]
}
```

---

## 🔄 Renovar Access Token (cada 60 días)

1. Ve a **Meta Business Manager**
2. **Settings → Users and Permissions → Apps and websites**
3. Genera nuevo token
4. Actualiza en `.env.local` (o en GitHub Secrets)

---

## 📝 Troubleshooting

| Error | Solución |
|-------|----------|
| "Missing Supabase credentials" | Verifica `.env.local` tiene valores correctos |
| "Instagram upload failed: 401" | Token expiró. Regenera en Meta Business Manager |
| "No pending posts in queue" | Inserta datos de prueba en `instagram_queue` |
| "Cannot find module 'sharp'" | `npm install sharp @supabase/supabase-js node-fetch` |

---

## 📈 Próximos pasos

- [ ] Crear tabla SQL en Supabase (`sql/instagram_queue.sql`)
- [ ] Obtener credenciales (Business ID + Access Token)
- [ ] Configurar `.env.local`
- [ ] Instalar dependencias
- [ ] Probar en modo test
- [ ] Publicar primer post
- [ ] Configurar scheduler automático
- [ ] Monitorear engagement

---

**Documentación completa:** Ver `INSTAGRAM_SETUP.md`

**Script:** `scripts/instagram-auto-poster.mjs`
