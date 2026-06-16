-- =====================================================================
-- Esteti'Kas — Schema de citas con seguridad por capas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- Estrategia de cifrado:
--   Los campos PII (telefono, email) se cifran en el backend Node con
--   AES-256-GCM antes de insertar. La BD solo guarda el ciphertext.
--   Aun si alguien dumpea la BD, no puede leer los datos sin la clave
--   que vive solo en Netlify Environment.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla principal: citas
-- ---------------------------------------------------------------------
create table if not exists public.citas (
  id                          uuid primary key default gen_random_uuid(),
  nombre                      text not null,
  telefono_enc                text not null,            -- AES-256-GCM (base64)
  email_enc                   text,                     -- AES-256-GCM (base64), opcional
  servicios                   jsonb not null,           -- [{slug, name}, ...]
  sede                        text not null,
  fecha                       date not null,
  hora                        text not null,
  notas                       text,
  estado                      text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','cancelada','completada','no_asistio')),
  google_event_id             text,
  consentimiento_habeas_data  boolean not null,
  consentimiento_at           timestamptz not null,
  ip_origen                   inet,
  user_agent                  text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists citas_fecha_idx  on public.citas(fecha);
create index if not exists citas_estado_idx on public.citas(estado);

-- Anti doble-reserva: no puede existir más de una cita activa en el mismo
-- (fecha, hora). Las citas canceladas no cuentan, así el slot se libera.
create unique index if not exists citas_slot_unico_idx
  on public.citas(fecha, hora)
  where estado <> 'cancelada';

-- ---------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigserial primary key,
  actor        text not null,
  action       text not null,
  resource_id  uuid,
  metadata     jsonb,
  ip           inet,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_created_idx  on public.audit_log(created_at desc);
create index if not exists audit_log_resource_idx on public.audit_log(resource_id);

-- ---------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  ip            inet not null,
  endpoint      text not null,
  window_start  timestamptz not null,
  count         int not null default 1,
  primary key (ip, endpoint, window_start)
);

create index if not exists rate_limits_cleanup_idx on public.rate_limits(window_start);

-- ---------------------------------------------------------------------
-- Funciones utilitarias
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists citas_touch on public.citas;
create trigger citas_touch
  before update on public.citas
  for each row execute function public.touch_updated_at();

-- Rate limit: ventana de N minutos. Retorna el conteo actual.
create or replace function public.bump_rate_limit(
  p_ip inet,
  p_endpoint text,
  p_window_minutes int default 10
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start := date_trunc('minute', now())
    - ((extract(minute from now())::int) % p_window_minutes) * interval '1 minute';

  insert into public.rate_limits(ip, endpoint, window_start, count)
  values (p_ip, p_endpoint, v_window_start, 1)
  on conflict (ip, endpoint, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

create or replace function public.cleanup_rate_limits()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;

create or replace function public.purge_old_citas()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  with d as (
    delete from public.citas
     where created_at < now() - interval '2 years'
     returning 1
  )
  select count(*) into v_count from d;
  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- Bloqueo total para anon/authenticated. Solo service_role puede operar.
-- ---------------------------------------------------------------------
alter table public.citas       enable row level security;
alter table public.audit_log   enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.citas       from anon, authenticated;
revoke all on public.audit_log   from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;

revoke execute on function public.bump_rate_limit(inet, text, int) from anon, authenticated;
revoke execute on function public.cleanup_rate_limits()            from anon, authenticated;
revoke execute on function public.purge_old_citas()                from anon, authenticated;
