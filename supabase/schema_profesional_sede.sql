-- =====================================================================
-- Esteti'Kas — Sede por profesional y por día
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query (idempotente)
--
-- Reemplaza a schema_limpieza_sede.sql (trigger citas_limpieza_sede), que
-- solo cubría las limpiezas faciales.
--
-- Reglas (espejo de api/_lib/profesionales.mjs):
--   • Ninguna profesional atiende en dos ciudades (Bataan / Guápiles) el
--     mismo día.
--   • Katherine (limpieza facial) y la Dra. Mónica (masajes, sueroterapia)
--     atienden en una sola sede por día.
--   • La Dra. Karen (resto de tratamientos) puede atender en los dos locales
--     de Guápiles el mismo día si entre citas de distinto local hay al menos
--     120 minutos.
--
-- El backend hace la misma verificación antes de insertar para dar un
-- mensaje amable; este trigger es el respaldo a prueba de carreras: las
-- escrituras de una misma profesional y fecha se serializan con un
-- advisory lock, así la segunda siempre ve a la primera.
-- =====================================================================

create or replace function public.profesional_de(p_slug text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_slug = 'limpieza-facial'              then 'katherine'
    when p_slug in ('masajes', 'sueroterapia')   then 'monica'
    else 'karen'
  end;
$$;

-- Ordenado y sin duplicados: el orden fijo de los locks evita interbloqueos.
create or replace function public.profesionales_de(p_servicios jsonb)
returns text[]
language sql
immutable
parallel safe
as $$
  select coalesce(array_agg(distinct public.profesional_de(e->>'slug') order by public.profesional_de(e->>'slug')), '{}')
  from jsonb_array_elements(p_servicios) e;
$$;

-- "17:30" → 1050
create or replace function public.hora_a_minutos(p_hora text)
returns int
language sql
immutable
parallel safe
as $$
  select split_part(p_hora, ':', 1)::int * 60 + split_part(p_hora, ':', 2)::int;
$$;

create or replace function public.check_profesional_sede()
returns trigger
language plpgsql
as $$
declare
  p text;
begin
  if new.estado = 'cancelada' then
    return new;
  end if;

  foreach p in array public.profesionales_de(new.servicios) loop
    perform pg_advisory_xact_lock(hashtext('profesional:' || p || ':' || new.fecha::text));

    if exists (
      select 1
      from public.citas c
      where c.fecha  = new.fecha
        and c.id is distinct from new.id
        and c.estado <> 'cancelada'
        and c.sede   <> new.sede
        and p = any(public.profesionales_de(c.servicios))
        and (
          public.sede_ciudad(c.sede) <> public.sede_ciudad(new.sede)
          or p <> 'karen'
          or abs(public.hora_a_minutos(c.hora) - public.hora_a_minutos(new.hora)) < 120
        )
    ) then
      raise exception 'profesional_sede_conflict'
        using hint = 'La profesional ya tiene citas ese día en otra sede.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists citas_limpieza_sede on public.citas;
drop function if exists public.check_limpieza_sede();

drop trigger if exists citas_profesional_sede on public.citas;
create trigger citas_profesional_sede
  before insert or update of sede, fecha, hora, estado, servicios on public.citas
  for each row execute function public.check_profesional_sede();
