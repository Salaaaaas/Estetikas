-- =====================================================================
-- Sitio público — Endurecimiento de seguridad (auditoría 2026-10-03)
-- Ejecutar en: Supabase Dashboard → SQL Editor (proyecto jsbzgslbyopixyzkykkr).
-- Es idempotente. CORRER ANTES de desplegar la rama seguridad-auditoria-2026-10:
-- el attest móvil nuevo usa la tabla mobile_challenges_used.
-- =====================================================================

-- 1) Funciones SECURITY DEFINER: fuera PUBLIC ------------------------
-- Postgres da EXECUTE a PUBLIC por defecto y los scripts anteriores solo lo
-- quitaban a anon/authenticated (que lo heredan de PUBLIC). Con la anon key
-- cualquiera podía inflar el contador de rate limit de otra IP o dispositivo.
revoke execute on function public.bump_rate_limit(inet, text, int)          from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits()                     from public, anon, authenticated;
revoke execute on function public.purge_old_citas()                         from public, anon, authenticated;
revoke execute on function public.bump_rate_limit_subject(text, text, int)  from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits_subject()             from public, anon, authenticated;

grant execute on function public.bump_rate_limit(inet, text, int)         to service_role;
grant execute on function public.cleanup_rate_limits()                    to service_role;
grant execute on function public.purge_old_citas()                        to service_role;
grant execute on function public.bump_rate_limit_subject(text, text, int) to service_role;
grant execute on function public.cleanup_rate_limits_subject()            to service_role;

-- Para que las funciones que se creen en adelante tampoco nazcan públicas.
alter default privileges in schema public revoke execute on functions from public;

-- 2) Retos de atestación de un solo uso -------------------------------
create table if not exists public.mobile_challenges_used (
  nonce_hash text primary key,              -- SHA-256 del reto completo
  expires_at timestamptz not null
);
create index if not exists mobile_challenges_used_exp_idx on public.mobile_challenges_used (expires_at);

alter table public.mobile_challenges_used enable row level security;
revoke all on public.mobile_challenges_used from anon, authenticated;

-- 3) La hora de una cita es una hora real ------------------------------
-- NOT VALID: no revisa filas viejas (podría haber alguna "99:99"), solo nuevas.
alter table public.citas drop constraint if exists citas_hora_valida;
alter table public.citas add constraint citas_hora_valida
  check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;

-- 4) instagram_queue (solo si ese script se aplicó alguna vez) --------
-- Las policies "Only admins ..." permitían a cualquier usuario autenticado,
-- y las vistas (sin security_invoker) se saltaban el RLS para anon. La cola
-- la opera solo el backend con service_role.
do $$
begin
  if to_regclass('public.instagram_queue') is not null then
    execute 'drop policy if exists "Only admins can insert instagram_queue" on public.instagram_queue';
    execute 'drop policy if exists "Only admins can view instagram_queue" on public.instagram_queue';
    execute 'drop policy if exists "Only admins can update instagram_queue" on public.instagram_queue';
    execute 'alter table public.instagram_queue enable row level security';
    execute 'revoke all on public.instagram_queue from anon, authenticated';
  end if;
  if to_regclass('public.vw_instagram_hoy_pendientes') is not null then
    execute 'alter view public.vw_instagram_hoy_pendientes set (security_invoker = true)';
    execute 'revoke all on public.vw_instagram_hoy_pendientes from anon, authenticated';
  end if;
  if to_regclass('public.vw_instagram_publicados') is not null then
    execute 'alter view public.vw_instagram_publicados set (security_invoker = true)';
    execute 'revoke all on public.vw_instagram_publicados from anon, authenticated';
  end if;
  if to_regclass('public.vw_instagram_errores') is not null then
    execute 'alter view public.vw_instagram_errores set (security_invoker = true)';
    execute 'revoke all on public.vw_instagram_errores from anon, authenticated';
  end if;
end $$;
