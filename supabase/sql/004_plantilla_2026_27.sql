-- Carga la plantilla femenina 2026/27. Ejecutar como administrador en Supabase.
-- Conserva las altas existentes que coinciden en nombre y dorsal.
begin;

create temporary table plantilla_2026_27 (
  dorsal integer primary key,
  nombre text not null
) on commit drop;

insert into pg_temp.plantilla_2026_27 (dorsal, nombre)
values
  -- Porteras
  (16, 'Luna'),
  -- Defensas
  (6, 'Melissa'),
  (4, 'Gaby'),
  (5, 'Bea'),
  (14, 'Elena'),
  (7, 'Aitana'),
  (12, 'Meri'),
  (3, 'Marta'),
  (17, 'Alicia'),
  -- Mediocentros
  (13, 'Julia'),
  (8, 'Marta'),
  (20, 'Carla'),
  (19, 'Cata'),
  (11, 'Sánchez'),
  (77, 'Tania'),
  (15, 'Chloe'),
  (2, 'Duna'),
  (23, 'Ana'),
  -- Delanteras
  (27, 'María'),
  (9, 'Laura'),
  (10, 'Estefi'),
  (22, 'Andrea');

do $$
declare
  v_altas integer;
  v_conflictos text;
begin
  insert into public.jugadoras (nombre, dorsal, activa)
  select p.nombre, p.dorsal, true
  from pg_temp.plantilla_2026_27 as p
  order by p.dorsal
  on conflict (dorsal) where activa do nothing;

  get diagnostics v_altas = row_count;

  select string_agg(
    format('#%s: %s (se esperaba %s)', p.dorsal, coalesce(j.nombre, 'sin alta activa'), p.nombre),
    ', ' order by p.dorsal
  )
  into v_conflictos
  from pg_temp.plantilla_2026_27 as p
  left join public.jugadoras as j on j.dorsal = p.dorsal and j.activa
  where j.nombre is distinct from p.nombre;

  if v_conflictos is not null then
    raise exception 'Conflictos al cargar la plantilla 2026/27: %', v_conflictos;
  end if;

  raise notice 'Plantilla 2026/27 comprobada: % jugadoras activas de la lista (% altas nuevas).',
    (select count(*) from pg_temp.plantilla_2026_27), v_altas;
end;
$$;

commit;
