-- T002-07. Añade el cuerpo técnico como destinatario de multas y conserva las jugadoras.
-- Ejecutar después de 005. Comprobar con pruebas/006_cuerpo_tecnico.sql.
begin;

do $permisos$
begin
  if has_schema_privilege('anon', 'public', 'CREATE')
    or has_schema_privilege('authenticated', 'public', 'CREATE')
    or has_schema_privilege('anon', 'extensions', 'CREATE')
    or has_schema_privilege('authenticated', 'extensions', 'CREATE')
    or has_schema_privilege('anon', 'crg_privado', 'USAGE')
    or has_schema_privilege('authenticated', 'crg_privado', 'USAGE') then
    raise exception 'Revisa los permisos de los roles de la API antes de aplicar 006';
  end if;
end;
$permisos$;

create table if not exists public.cuerpo_tecnico (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  nombre text not null unique check (nombre = btrim(nombre) and nombre <> ''),
  activo boolean not null default true
);

alter table public.cuerpo_tecnico enable row level security;
revoke all on table public.cuerpo_tecnico from public, anon, authenticated;
grant select on table public.cuerpo_tecnico to anon;

drop policy if exists cuerpo_tecnico_lectura_anon on public.cuerpo_tecnico;
create policy cuerpo_tecnico_lectura_anon on public.cuerpo_tecnico
  for select to anon using (true);

-- Los destinatarios son independientes de las cuentas privadas de acceso.
insert into public.cuerpo_tecnico (nombre)
values ('Jaime'), ('Nacho'), ('Guada')
on conflict (nombre) do nothing;

alter table public.multas
  add column if not exists tecnico_id uuid references public.cuerpo_tecnico(id),
  alter column jugadora_id drop not null;

do $restriccion$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.multas'::regclass and conname = 'multas_un_destinatario'
  ) then
    alter table public.multas add constraint multas_un_destinatario
      check (num_nonnulls(jugadora_id, tecnico_id) = 1);
  end if;
end;
$restriccion$;

create unique index if not exists multas_escalon_tecnico_unico
  on public.multas (temporada_id, tecnico_id, concepto_id)
  where tecnico_id is not null and concepto_id in ('esc_3', 'esc_6', 'esc_9')
    and estado <> 'anulada';

-- Una sola implementación de las reglas de registro para ambos destinatarios.
create or replace function crg_privado.registrar_multa_destinatario(
  actor text, jugadora_id uuid, concepto_id text, importe numeric,
  multiplicador integer, cantidad integer, fecha date, observacion text,
  pagada_ahora boolean, tecnico_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_aplica_doble boolean;
  v_temporada uuid;
  v_id uuid;
  v_tipo text;
  v_base numeric;
  v_importe numeric;
  v_multiplicador integer;
  v_faltas bigint;
  v_registrado numeric;
  v_nivel text;
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
  v_fecha_pago date;
  v_cobrado numeric;
  v_observacion text := nullif(btrim($8), '');
begin
  if $7 is null or not isfinite($7) or $6 is null or $6 < 1 or $9 is null
    or ($9 and $7 > v_hoy) then
    return '{"ok":false,"error":"Datos de multa no válidos"}';
  end if;

  if num_nonnulls($2, $10) <> 1 then
    return '{"ok":false,"error":"Selecciona un solo destinatario"}';
  end if;

  -- Comparte el bloqueo de cambio de temporada y serializa los escalones por destinatario.
  perform pg_advisory_xact_lock_shared(4287, 1);
  select t.id into v_temporada from public.temporadas t where t.activa for share;
  if not found then return '{"ok":false,"error":"No hay temporada activa"}'; end if;
  if $2 is not null then
    select j.capitana into v_aplica_doble
    from public.jugadoras j where j.id = $2 and j.activa for update;
    if not found then return '{"ok":false,"error":"Jugadora no disponible"}'; end if;
  else
    perform 1 from public.cuerpo_tecnico c where c.id = $10 and c.activo for update;
    if not found then return '{"ok":false,"error":"Entrenador no disponible"}'; end if;
    v_aplica_doble := true;
  end if;

  if $3 = 'ajuste_manual' then
    if v_observacion is null or $4 is null or $4 not between 0 and 999999.99 or $4 <> round($4, 2) then
      return '{"ok":false,"error":"El ajuste manual requiere importe y motivo"}';
    end if;
    v_importe := $4;
    v_multiplicador := 1;
  else
    -- Importes base de la tabla fija de spec.md. Se contrastan con src/data/catalogo.json.
    select c.importe, c.tipo into v_base, v_tipo
    from (values
      ('ent_tarde', 2, 'fijo'),
      ('ent_falta_sin_aviso', 5, 'fijo'),
      ('ent_falta_menos_4h', 3, 'fijo'),
      ('ent_falta_con_aviso', 0, 'fijo'),
      ('ent_uniforme', 1, 'por_prenda'),
      ('ent_respeto', 6, 'fijo'),
      ('esc_3', 4, 'escalon'),
      ('esc_6', 6, 'escalon'),
      ('esc_9', 8, 'escalon'),
      ('par_tarde', 3, 'tardanza'),
      ('par_tarde_20', 7, 'tardanza'),
      ('par_no_asiste_local', 5, 'fijo'),
      ('par_falta', 20, 'fijo'),
      ('par_convocatoria', 1, 'por_prenda'),
      ('par_equipacion', 3, 'por_prenda'),
      ('par_respeto', 5, 'fijo'),
      ('par_amarilla', 5, 'fijo'),
      ('par_expulsion', 10, 'fijo')
    ) as c(id, importe, tipo) where c.id = $3;
    if not found then return '{"ok":false,"error":"Concepto de multa no válido"}'; end if;

    if v_tipo = 'escalon' then
      select count(*) filter (where m.concepto_id in ('ent_falta_sin_aviso', 'ent_falta_menos_4h', 'ent_falta_con_aviso')),
        coalesce(sum(m.importe / m.multiplicador) filter (where m.concepto_id in ('esc_3', 'esc_6', 'esc_9')), 0)
      into v_faltas, v_registrado
      from public.multas m
      where m.temporada_id = v_temporada and m.estado <> 'anulada'
        and (m.jugadora_id = $2 or m.tecnico_id = $10);

      v_nivel := case when v_faltas >= 9 then 'esc_9' when v_faltas >= 6 then 'esc_6' when v_faltas >= 3 then 'esc_3' end;
      v_base := v_base - v_registrado;
      if v_nivel is distinct from $3 or v_base <= 0 then
        return '{"ok":false,"error":"El escalón indicado no está pendiente"}';
      end if;
    end if;

    v_multiplicador := case when v_aplica_doble then 2 else 1 end;
    v_importe := v_base * v_multiplicador * case when v_tipo = 'por_prenda' then $6 else 1 end;
  end if;

  if $5 is distinct from v_multiplicador or $4 is distinct from v_importe
    or v_importe > 999999.99 or (v_tipo is distinct from 'por_prenda' and $6 <> 1) then
    return '{"ok":false,"error":"El importe, el multiplicador o la cantidad no coinciden con la multa calculada"}';
  end if;

  v_fecha_pago := case when v_importe = 0 then $7 when $9 then v_hoy end;
  if v_fecha_pago is not null then
    v_cobrado := v_importe * case when v_fecha_pago > $7 + 15 then 2 else 1 end;
  end if;

  insert into public.multas as m (
    temporada_id, jugadora_id, tecnico_id, concepto_id, importe, multiplicador, cantidad, fecha, observacion,
    estado, fecha_pago, cobrada_por, cobrada_en, importe_cobrado, registrada_por
  ) values (
    v_temporada, $2, $10, $3, v_importe, v_multiplicador, $6, $7, v_observacion,
    case when v_fecha_pago is null then 'pendiente' else 'pagada' end,
    v_fecha_pago, case when v_fecha_pago is not null then $1 end,
    case when v_fecha_pago is not null then clock_timestamp() end, v_cobrado, $1
  ) on conflict do nothing returning m.id into v_id;
  if not found then return '{"ok":false,"error":"El escalón ya está registrado"}'; end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$funcion$;

create or replace function crg_privado.registrar_multa(
  actor text, jugadora_id uuid, concepto_id text, importe numeric,
  multiplicador integer, cantidad integer, fecha date, observacion text,
  pagada_ahora boolean
)
returns jsonb
language sql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
  select crg_privado.registrar_multa_destinatario($1, $2, $3, $4, $5, $6, $7, $8, $9, null);
$funcion$;

create or replace function public.registrar_multa_tecnico_sesion(
  token text, tecnico_id uuid, concepto_id text, importe numeric,
  multiplicador integer, cantidad integer, fecha date, observacion text,
  pagada_ahora boolean
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := crg_privado.validar_sesion($1);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.registrar_multa_destinatario(v_acceso->>'usuario', null, $3, $4, $5, $6, $7, $8, $9, $2);
end;
$funcion$;

-- Una anulación también bloquea la ficha que usa el cálculo de escalones.
create or replace function crg_privado.anular_multa(actor text, multa_id uuid, motivo text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_motivo text := nullif(btrim($3), '');
begin
  if v_motivo is null then return '{"ok":false,"error":"Indica el motivo de la anulación"}'; end if;

  perform 1 from public.jugadoras j join public.multas m on m.jugadora_id = j.id where m.id = $2 for update of j;
  perform 1 from public.cuerpo_tecnico c join public.multas m on m.tecnico_id = c.id where m.id = $2 for update of c;
  update public.multas m
  set estado = 'anulada', motivo_anulacion = v_motivo, anulada_por = $1, anulada_en = clock_timestamp()
  where m.id = $2 and m.estado <> 'anulada';
  if not found then return '{"ok":false,"error":"Multa no disponible para anular"}'; end if;
  return '{"ok":true}';
end;
$funcion$;

revoke all on function
  crg_privado.registrar_multa_destinatario(text, uuid, text, numeric, integer, integer, date, text, boolean, uuid),
  crg_privado.registrar_multa(text, uuid, text, numeric, integer, integer, date, text, boolean),
  crg_privado.anular_multa(text, uuid, text),
  public.registrar_multa_tecnico_sesion(text, uuid, text, numeric, integer, integer, date, text, boolean)
from public, anon, authenticated;

grant execute on function public.registrar_multa_tecnico_sesion(text, uuid, text, numeric, integer, integer, date, text, boolean)
to anon;

commit;
