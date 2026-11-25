-- Elimina solo los dos ajustes de prueba "asd" de la temporada activa.
-- Ejecutar manualmente desde Supabase SQL Editor; no añade permisos ni una acción en la app.
begin;

do $limpieza$
declare
  v_temporada_id uuid;
  v_historial jsonb;
  v_cambio_2_a_0 integer;
  v_cambio_0_a_2 integer;
begin
  select id, historial_hucha_inicial
  into v_temporada_id, v_historial
  from public.temporadas
  where activa
  for update;

  if not found then
    raise exception 'No hay temporada activa; no se ha modificado ningún historial';
  end if;

  select
    count(*) filter (
      where entrada->'anterior' = '2'::jsonb
        and entrada->'nuevo' = '0'::jsonb
        and entrada->>'motivo' = 'asd'
        and entrada->>'usuario' = 'coach'
        and entrada->>'fecha' ~ '^[0-9]{4}-11-23$'
    ),
    count(*) filter (
      where entrada->'anterior' = '0'::jsonb
        and entrada->'nuevo' = '2'::jsonb
        and entrada->>'motivo' = 'asd'
        and entrada->>'usuario' = 'coach'
        and entrada->>'fecha' ~ '^[0-9]{4}-11-23$'
    )
  into v_cambio_2_a_0, v_cambio_0_a_2
  from jsonb_array_elements(v_historial) as historial(entrada);

  if v_cambio_2_a_0 = 0 and v_cambio_0_a_2 = 0 then
    raise notice 'Los ajustes de prueba ya estaban eliminados; no se ha cambiado nada';
  elsif v_cambio_2_a_0 <> 1 or v_cambio_0_a_2 <> 1 then
    raise exception 'Se esperaba un ajuste de cada tipo; no se ha modificado ningún historial';
  else
    update public.temporadas as t
    set historial_hucha_inicial = coalesce(
      (
        select jsonb_agg(historial.entrada order by historial.orden)
        from jsonb_array_elements(t.historial_hucha_inicial)
          with ordinality as historial(entrada, orden)
        where not (
          (
            (
              historial.entrada->'anterior' = '2'::jsonb
              and historial.entrada->'nuevo' = '0'::jsonb
            )
            or (
              historial.entrada->'anterior' = '0'::jsonb
              and historial.entrada->'nuevo' = '2'::jsonb
            )
          )
          and historial.entrada->>'motivo' is not distinct from 'asd'
          and historial.entrada->>'usuario' is not distinct from 'coach'
          and coalesce(historial.entrada->>'fecha' ~ '^[0-9]{4}-11-23$', false)
        )
      ),
      '[]'::jsonb
    )
    where t.id = v_temporada_id;
  end if;
end
$limpieza$;

commit;
