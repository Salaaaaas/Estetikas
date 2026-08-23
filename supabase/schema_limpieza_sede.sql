-- =====================================================================
-- Esteti'Kas — Limpiezas faciales en UNA sola sede por día
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query (idempotente)
--
-- Katherine es quien realiza las limpiezas faciales y no puede estar en
-- dos localidades el mismo día. Si ya existe una cita activa con limpieza
-- facial en una sede, ninguna otra sede puede recibir limpiezas ese día.
--
-- El backend hace esta misma verificación antes de insertar para dar un
-- mensaje amable; este trigger es el respaldo a prueba de carreras: dos
-- inserciones simultáneas en sedes distintas se serializan con un
-- advisory lock por fecha, así la segunda siempre ve a la primera.
-- =====================================================================

create or replace function public.check_limpieza_sede()
returns trigger
language plpgsql
as $$
begin
  if new.estado <> 'cancelada'
     and new.servicios @> '[{"slug":"limpieza-facial"}]'::jsonb then

    -- Serializa las escrituras de limpiezas de esta fecha dentro de la txn.
    perform pg_advisory_xact_lock(hashtext('limpieza:' || new.fecha::text));

    if exists (
      select 1
      from public.citas c
      where c.fecha  = new.fecha
        and c.id is distinct from new.id
        and c.estado <> 'cancelada'
        and c.servicios @> '[{"slug":"limpieza-facial"}]'::jsonb
        and c.sede   <> new.sede
    ) then
      raise exception 'limpieza_sede_conflict'
        using hint = 'Las limpiezas faciales solo se atienden en una sede por día.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists citas_limpieza_sede on public.citas;
create trigger citas_limpieza_sede
  before insert or update of sede, fecha, estado, servicios on public.citas
  for each row execute function public.check_limpieza_sede();
