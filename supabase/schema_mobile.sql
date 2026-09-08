-- =====================================================================
-- Esteti'Kas — Soporte para la app móvil (fase 2)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query (idempotente)
--
-- Cubre los cuatro bloqueadores que impedían que una app nativa reservara:
--   1. citas.telefono_hash  → permite buscar las citas de un cliente sin
--                             romper el cifrado de la PII
--   2. mobile_devices       → dispositivos atestados con App Attest /
--                             Play Integrity
--   3. rate_limits_subject  → límite por dispositivo en vez de por IP
--   4. candado de slot     → pasa de (fecha,hora) global a por ciudad
--
-- Después de correr este script hay que ejecutar UNA VEZ el backfill:
--   node scripts/backfill-telefono-hash.mjs
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Índice buscable del teléfono
--
-- telefono_enc es AES-256-GCM con IV aleatorio por fila: el mismo número
-- produce un ciphertext distinto cada vez, así que no se puede buscar por
-- él. telefono_hash guarda un HMAC-SHA256 determinista del teléfono
-- normalizado a E.164, con un pepper que vive solo en las variables de
-- entorno (PHONE_HASH_PEPPER, distinto de PII_ENCRYPTION_KEY).
--
-- El hash permite buscar; nunca revertir. Sin el pepper, un atacante con
-- un dump de la BD no puede probar números por fuerza bruta.
--
-- Si algún día cambia la normalización a E.164 en api/_lib/validate.mjs,
-- hay que volver a correr el backfill: los teléfonos siguen siendo
-- descifrables, así que el hash siempre se puede recalcular.
-- ---------------------------------------------------------------------
alter table public.citas
  add column if not exists telefono_hash text;

create index if not exists citas_telefono_hash_idx
  on public.citas(telefono_hash)
  where telefono_hash is not null;

comment on column public.citas.telefono_hash is
  'HMAC-SHA256(PHONE_HASH_PEPPER, telefono en E.164). Solo para buscar; no revierte.';


-- ---------------------------------------------------------------------
-- 2. Dispositivos móviles atestados
--
-- Una fila por instalación de la app que superó App Attest (iOS) o
-- Play Integrity (Android). El token de sesión que emite
-- /api/mobile/attest referencia device_id; revocar un dispositivo es
-- poner revoked_at y sus tokens dejan de valer al instante.
--
-- public_key y key_id solo existen en iOS: son los datos que harían falta
-- para verificar aserciones de App Attest por petición más adelante.
-- ---------------------------------------------------------------------
create table if not exists public.mobile_devices (
  device_id    text primary key,
  platform     text not null check (platform in ('ios','android')),
  key_id       text,
  public_key   text,
  app_version  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);

create index if not exists mobile_devices_active_idx
  on public.mobile_devices(last_seen_at desc)
  where revoked_at is null;


-- ---------------------------------------------------------------------
-- 3. Rate limit por sujeto (dispositivo)
--
-- rate_limits usa `inet` como clave y sigue sirviendo a la ruta web. Las
-- operadoras celulares meten miles de abonados detrás de un mismo NAT, así
-- que en móvil limitar por IP castiga a clientas legítimas: la ruta móvil
-- limita por device_id y deja el límite por IP como techo global.
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits_subject (
  subject       text not null,
  endpoint      text not null,
  window_start  timestamptz not null,
  count         int not null default 1,
  primary key (subject, endpoint, window_start)
);

create index if not exists rate_limits_subject_cleanup_idx
  on public.rate_limits_subject(window_start);

create or replace function public.bump_rate_limit_subject(
  p_subject text,
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

  insert into public.rate_limits_subject(subject, endpoint, window_start, count)
  values (p_subject, p_endpoint, v_window_start, 1)
  on conflict (subject, endpoint, window_start)
  do update set count = public.rate_limits_subject.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

create or replace function public.cleanup_rate_limits_subject()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limits_subject where window_start < now() - interval '1 hour';
$$;


-- ---------------------------------------------------------------------
-- 4. El candado de slot pasa a ser por CIUDAD, no por sede exacta
--
-- El índice anterior era (fecha, hora) global: dos sedes no podían tener
-- cita a la misma hora aunque atendieran profesionales distintas. Katherine
-- en Bataan y la Dra. Karen en Guápiles se bloqueaban entre sí.
--
-- Pero abrir el candado por sede exacta sería pasarse: Guápiles tiene DOS
-- locales (Medical Numancia y Eco Clinic) y en ambos atiende la misma
-- persona. Un índice por sede dejaría agendar a la Dra. Karen a las 10:00
-- en los dos sitios a la vez.
--
-- Lo que de verdad no se puede duplicar es la persona, y la persona está
-- determinada por la ciudad: Bataan = Katherine, Guápiles = Dra. Karen. Así
-- que el candado agrupa los locales de una misma ciudad.
--
-- El trigger citas_limpieza_sede sigue garantizando, además, que las
-- limpiezas faciales de un día ocurran en una sola sede.
-- ---------------------------------------------------------------------
create or replace function public.sede_ciudad(p_sede text)
returns text
language sql
immutable
parallel safe
as $$
  select case when p_sede like 'Bataan%' then 'Bataan' else 'Guápiles' end;
$$;

comment on function public.sede_ciudad(text) is
  'Ciudad de una sede. Debe seguir a SEDES_VALIDAS en api/_lib/validate.mjs.';

drop index if exists public.citas_slot_unico_idx;
drop index if exists public.citas_slot_sede_unico_idx;

create unique index if not exists citas_slot_ciudad_unico_idx
  on public.citas(fecha, hora, public.sede_ciudad(sede))
  where estado <> 'cancelada';


-- ---------------------------------------------------------------------
-- 5. RLS — mismo bloqueo total que el resto del esquema
-- ---------------------------------------------------------------------
alter table public.mobile_devices      enable row level security;
alter table public.rate_limits_subject enable row level security;

revoke all on public.mobile_devices      from anon, authenticated;
revoke all on public.rate_limits_subject from anon, authenticated;

revoke execute on function public.bump_rate_limit_subject(text, text, int) from anon, authenticated;
revoke execute on function public.cleanup_rate_limits_subject()            from anon, authenticated;
