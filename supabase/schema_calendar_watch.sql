-- =====================================================================
-- Esteti'Kas — Canal de notificaciones de Google Calendar
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query (idempotente)
--
-- Los canales de push de Google Calendar caducan (una semana como mucho) y
-- hay que volver a registrarlos. Sin guardar cuál es el canal vigente no se
-- puede cerrar el anterior al crear uno nuevo, y se acumulan canales activos
-- que mandan notificaciones duplicadas hasta caducar.
--
-- Es una tabla de una sola fila: id = 'current'.
-- =====================================================================

create table if not exists public.calendar_watch (
  id           text primary key default 'current',
  channel_id   text not null,
  resource_id  text not null,
  webhook_url  text not null,
  expiration   timestamptz,
  renewed_at   timestamptz not null default now()
);

alter table public.calendar_watch enable row level security;
revoke all on public.calendar_watch from anon, authenticated;

comment on table public.calendar_watch is
  'Canal push vigente de Google Calendar. Lo renueva el cron /api/register-calendar-watch.';
