-- ============================================================================
-- Esteti'Kas Instagram Queue Table
-- ============================================================================
-- Ejecuta esto en Supabase SQL Editor para crear la tabla automáticamente
-- ============================================================================

-- Tabla principal para cola de publicación
CREATE TABLE IF NOT EXISTS instagram_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de contenido
  type VARCHAR NOT NULL DEFAULT 'resultado',
  CHECK (type IN ('resultado', 'tratamiento', 'tip', 'producto')),

  -- Relación con tratamientos (opcional)
  tratamiento_id UUID REFERENCES tratamientos(id) ON DELETE CASCADE,

  -- Datos del cliente (para antes/después)
  cliente_nombre VARCHAR,
  cliente_email VARCHAR,

  -- URLs de fotos (si es resultado antes/después)
  foto_antes_url VARCHAR,
  foto_despues_url VARCHAR,

  -- Descripción / copy
  descripcion TEXT,

  -- Estado del post
  estado VARCHAR NOT NULL DEFAULT 'pendiente',
  CHECK (estado IN ('pendiente', 'generando', 'publicado', 'error', 'cancelado')),

  -- Resultado de publicación
  instagram_media_id VARCHAR UNIQUE,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,

  -- Metadatos
  metadata JSONB DEFAULT '{}'
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_instagram_queue_estado
  ON instagram_queue(estado);

CREATE INDEX IF NOT EXISTS idx_instagram_queue_created_at
  ON instagram_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_instagram_queue_tipo
  ON instagram_queue(type);

CREATE INDEX IF NOT EXISTS idx_instagram_queue_tratamiento_id
  ON instagram_queue(tratamiento_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_instagram_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.estado = 'publicado' AND OLD.estado != 'publicado' THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_instagram_queue_timestamp ON instagram_queue;
CREATE TRIGGER trigger_instagram_queue_timestamp
  BEFORE UPDATE ON instagram_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_queue_timestamp();

-- ============================================================================
-- EJEMPLOS DE DATOS
-- ============================================================================

-- Ejemplo 1: Resultado antes/después
INSERT INTO instagram_queue (
  type,
  tratamiento_id,
  cliente_nombre,
  foto_antes_url,
  foto_despues_url,
  descripcion,
  estado
) VALUES (
  'resultado',
  (SELECT id FROM tratamientos WHERE slug = 'botox' LIMIT 1),
  'María',
  'https://example.com/antes.jpg',
  'https://example.com/despues.jpg',
  'Botox natural que realza sin perder expresión',
  'pendiente'
);

-- Ejemplo 2: Tip de cuidado
INSERT INTO instagram_queue (
  type,
  descripcion,
  estado
) VALUES (
  'tip',
  'SPF 50+ todos los días es el mejor anti-aging que existe. No es opcional.',
  'pendiente'
);

-- Ejemplo 3: Promoción de tratamiento
INSERT INTO instagram_queue (
  type,
  tratamiento_id,
  descripcion,
  estado
) VALUES (
  'tratamiento',
  (SELECT id FROM tratamientos WHERE slug = 'peeling-quimico' LIMIT 1),
  'Peeling químico: la solución para acné y manchas. Resultados garantizados en 3 sesiones.',
  'pendiente'
);

-- ============================================================================
-- RLS POLICIES (Optional - para control de permisos)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE instagram_queue ENABLE ROW LEVEL SECURITY;

-- Política: Solo admin puede insertar
CREATE POLICY "Only admins can insert instagram_queue"
  ON instagram_queue
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política: Solo admin puede ver todos
CREATE POLICY "Only admins can view instagram_queue"
  ON instagram_queue
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: Solo admin puede actualizar
CREATE POLICY "Only admins can update instagram_queue"
  ON instagram_queue
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista: Posts pendientes hoy
CREATE OR REPLACE VIEW vw_instagram_hoy_pendientes AS
  SELECT *
  FROM instagram_queue
  WHERE estado = 'pendiente'
    AND DATE(created_at) = CURRENT_DATE
  ORDER BY created_at ASC;

-- Vista: Historial de publicados
CREATE OR REPLACE VIEW vw_instagram_publicados AS
  SELECT
    id,
    type,
    cliente_nombre,
    descripcion,
    published_at,
    instagram_media_id
  FROM instagram_queue
  WHERE estado = 'publicado'
  ORDER BY published_at DESC
  LIMIT 30;

-- Vista: Errores recientes
CREATE OR REPLACE VIEW vw_instagram_errores AS
  SELECT
    id,
    type,
    error_message,
    updated_at
  FROM instagram_queue
  WHERE estado = 'error'
  ORDER BY updated_at DESC
  LIMIT 10;
