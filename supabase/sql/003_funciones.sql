-- T8. Crea las funciones de staff, cobros y temporada y la declaración pública de pago.
-- Ejecutar después de 001 y 002. Probar después con pruebas/003_funciones.sql.
begin;

do $seguridad$
begin
  if has_schema_privilege('anon', 'public', 'CREATE')
    or has_schema_privilege('authenticated', 'public', 'CREATE')
    or has_schema_privilege('anon', 'extensions', 'CREATE')
    or has_schema_privilege('authenticated', 'extensions', 'CREATE') then
    raise exception 'Los roles de la API solo deben tener USAGE en public y extensions';
  end if;
end;
$seguridad$;

-- Conserva el importe original para calcular escalones y el importe real para la hucha.
alter table public.multas
  add column if not exists importe_cobrado numeric(9,2)
    check (importe_cobrado >= 0 and importe_cobrado <> 'NaN'::numeric);

create or replace function public.login_staff(usuario text, pin text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_staff public.staff%rowtype;
  v_ahora timestamptz;
  v_fallos integer;
  v_error constant jsonb := '{"ok":false,"error":"No autorizado"}';
begin
  select s.* into v_staff from public.staff s where s.usuario = lower(btrim($1)) for update;
  if not found then return v_error; end if;

  v_ahora := clock_timestamp();
  if v_staff.bloqueado_hasta > v_ahora then return v_error; end if;

  if $2 ~ '^[0-9]{4}$' and extensions.crypt($2, v_staff.pin_hash) = v_staff.pin_hash then
    if v_staff.intentos_fallidos <> 0 or v_staff.bloqueado_hasta is not null then
      update public.staff s set intentos_fallidos = 0, bloqueado_hasta = null where s.id = v_staff.id;
    end if;
    return jsonb_build_object('ok', true, 'usuario', v_staff.usuario);
  end if;

  v_fallos := case when v_staff.bloqueado_hasta is not null then 1 else v_staff.intentos_fallidos + 1 end;
  update public.staff s
  set intentos_fallidos = v_fallos,
      bloqueado_hasta = case when v_fallos = 5 then v_ahora + interval '1 minute' end
  where s.id = v_staff.id;
  return v_error;
end;
$funcion$;

create or replace function public.registrar_multa(
  usuario text, pin text, jugadora_id uuid, concepto_id text, importe numeric,
  multiplicador integer, cantidad integer, fecha date, observacion text, pagada_ahora boolean
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
  v_jugadora public.jugadoras%rowtype;
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
  v_observacion text := nullif(btrim($9), '');
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  if $8 is null or not isfinite($8) or $7 is null or $7 < 1 or $10 is null
    or ($10 and $8 > v_hoy) then
    return '{"ok":false,"error":"Datos de multa no válidos"}';
  end if;

  -- Comparte el bloqueo de cambio de temporada y serializa el cálculo de escalones por jugadora.
  perform pg_advisory_xact_lock_shared(4287, 1);
  select t.id into v_temporada from public.temporadas t where t.activa for share;
  if not found then return '{"ok":false,"error":"No hay temporada activa"}'; end if;
  select j.* into v_jugadora from public.jugadoras j where j.id = $3 and j.activa for update;
  if not found then return '{"ok":false,"error":"Jugadora no disponible"}'; end if;

  if $4 = 'ajuste_manual' then
    if v_observacion is null or $5 is null or $5 not between 0 and 999999.99 or $5 <> round($5, 2) then
      return '{"ok":false,"error":"El ajuste manual requiere importe y motivo"}';
    end if;
    v_importe := $5;
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
    ) as c(id, importe, tipo) where c.id = $4;
    if not found then return '{"ok":false,"error":"Concepto de multa no válido"}'; end if;

    if v_tipo = 'escalon' then
      select count(*) filter (where m.concepto_id in ('ent_falta_sin_aviso', 'ent_falta_menos_4h', 'ent_falta_con_aviso')),
        coalesce(sum(m.importe / m.multiplicador) filter (where m.concepto_id in ('esc_3', 'esc_6', 'esc_9')), 0)
      into v_faltas, v_registrado
      from public.multas m
      where m.temporada_id = v_temporada and m.jugadora_id = $3 and m.estado <> 'anulada';

      v_nivel := case when v_faltas >= 9 then 'esc_9' when v_faltas >= 6 then 'esc_6' when v_faltas >= 3 then 'esc_3' end;
      v_base := v_base - v_registrado;
      if v_nivel is distinct from $4 or v_base <= 0 then
        return '{"ok":false,"error":"El escalón indicado no está pendiente"}';
      end if;
    end if;

    v_multiplicador := case when v_jugadora.capitana then 2 else 1 end;
    v_importe := v_base * v_multiplicador * case when v_tipo = 'por_prenda' then $7 else 1 end;
  end if;

  if $6 is distinct from v_multiplicador or $5 is distinct from v_importe
    or v_importe > 999999.99 or (v_tipo is distinct from 'por_prenda' and $7 <> 1) then
    return '{"ok":false,"error":"El importe, el multiplicador o la cantidad no coinciden con la multa calculada"}';
  end if;

  v_fecha_pago := case when v_importe = 0 then $8 when $10 then v_hoy end;
  if v_fecha_pago is not null then
    v_cobrado := v_importe * case when v_fecha_pago > $8 + 15 then 2 else 1 end;
  end if;

  insert into public.multas as m (
    temporada_id, jugadora_id, concepto_id, importe, multiplicador, cantidad, fecha, observacion,
    estado, fecha_pago, cobrada_por, cobrada_en, importe_cobrado, registrada_por
  ) values (
    v_temporada, $3, $4, v_importe, v_multiplicador, $7, $8, v_observacion,
    case when v_fecha_pago is null then 'pendiente' else 'pagada' end,
    v_fecha_pago, case when v_fecha_pago is not null then v_acceso->>'usuario' end,
    case when v_fecha_pago is not null then clock_timestamp() end, v_cobrado, v_acceso->>'usuario'
  ) on conflict do nothing returning m.id into v_id;
  if not found then return '{"ok":false,"error":"El escalón ya está registrado"}'; end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$funcion$;

create or replace function public.marcar_pagada(usuario text, pin text, multa_id uuid, fecha_pago date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;

  update public.multas m
  set estado = 'pagada', fecha_pago = $4, cobrada_por = v_acceso->>'usuario', cobrada_en = clock_timestamp(),
      importe_cobrado = m.importe * case when $4 > m.fecha + 15 then 2 else 1 end
  where m.id = $3 and m.estado = 'pendiente' and $4 between m.fecha and v_hoy;
  if not found then return '{"ok":false,"error":"Multa pendiente o fecha de cobro no válida"}'; end if;
  return '{"ok":true}';
end;
$funcion$;

create or replace function public.declarar_pago(multa_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
begin
  update public.multas m set estado = 'pago_declarado', declarada_en = clock_timestamp()
  where m.id = $1 and m.estado = 'pendiente';
  return '{"ok":true}';
end;
$funcion$;

create or replace function public.verificar_pago(usuario text, pin text, multa_id uuid, aceptar boolean, fecha_pago date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
  v_multa public.multas%rowtype;
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  if $4 is null then return '{"ok":false,"error":"Indica si aceptas el pago"}'; end if;

  select m.* into v_multa from public.multas m where m.id = $3 and m.estado = 'pago_declarado' for update;
  if not found then return '{"ok":false,"error":"La multa no tiene un pago por verificar"}'; end if;

  if $4 then
    if $5 is null or $5 not between v_multa.fecha and v_hoy then
      return '{"ok":false,"error":"Fecha de cobro no válida"}';
    end if;
    update public.multas m
    set estado = 'pagada', fecha_pago = $5, cobrada_por = v_acceso->>'usuario', cobrada_en = clock_timestamp(),
        importe_cobrado = m.importe * case when (m.declarada_en at time zone 'Europe/Madrid')::date > m.fecha + 15 then 2 else 1 end
    where m.id = v_multa.id;
  else
    update public.multas m set estado = 'pendiente', declarada_en = null where m.id = v_multa.id;
  end if;
  return '{"ok":true}';
end;
$funcion$;

create or replace function public.anular_multa(usuario text, pin text, multa_id uuid, motivo text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
  v_motivo text := nullif(btrim($4), '');
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  if v_motivo is null then return '{"ok":false,"error":"Indica el motivo de la anulación"}'; end if;

  perform 1 from public.jugadoras j join public.multas m on m.jugadora_id = j.id where m.id = $3 for update of j;
  update public.multas m
  set estado = 'anulada', motivo_anulacion = v_motivo, anulada_por = v_acceso->>'usuario', anulada_en = clock_timestamp()
  where m.id = $3 and m.estado <> 'anulada';
  if not found then return '{"ok":false,"error":"Multa no disponible para anular"}'; end if;
  return '{"ok":true}';
end;
$funcion$;

create or replace function public.registrar_gasto(usuario text, pin text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
  v_motivo text := nullif(btrim($5), '');
  v_id uuid;
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  if $4 is null or $4 not between 0.01 and 999999.99 or $4 <> round($4, 2)
    or v_motivo is null or $6 is null or not isfinite($6) then
    return '{"ok":false,"error":"El gasto requiere importe positivo, motivo y fecha"}';
  end if;

  perform 1 from public.temporadas t where t.id = $3 for key share;
  if not found then return '{"ok":false,"error":"Temporada no disponible"}'; end if;

  insert into public.gastos_hucha as g (temporada_id, importe, motivo, fecha, registrado_por)
  values ($3, $4, v_motivo, $6, v_acceso->>'usuario') returning g.id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$funcion$;

create or replace function public.editar_hucha_inicial(usuario text, pin text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
  v_motivo text := nullif(btrim($5), '');
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  if $4 is null or $4 not between -999999.99 and 999999.99 or $4 <> round($4, 2)
    or v_motivo is null or $6 is null or not isfinite($6) then
    return '{"ok":false,"error":"El ajuste de hucha requiere importe, motivo y fecha"}';
  end if;

  update public.temporadas t
  set hucha_inicial = $4,
      historial_hucha_inicial = t.historial_hucha_inicial || jsonb_build_array(jsonb_build_object(
        'anterior', t.hucha_inicial, 'nuevo', $4, 'motivo', v_motivo, 'fecha', $6,
        'usuario', v_acceso->>'usuario', 'registrado_en', clock_timestamp()
      ))
  where t.id = $3;
  if not found then return '{"ok":false,"error":"Temporada no disponible"}'; end if;
  return '{"ok":true}';
end;
$funcion$;

create or replace function public.crear_temporada(usuario text, pin text, nombre text, hucha_inicial numeric)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
  v_nombre text := nullif(btrim($3), '');
  v_inicial numeric := $4;
  v_id uuid;
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  if v_nombre is null then return '{"ok":false,"error":"Indica un nombre para la temporada"}'; end if;

  perform pg_advisory_xact_lock(4287, 1);
  if v_inicial is null then
    select t.hucha_inicial
      + coalesce((select sum(coalesce(m.importe_cobrado, m.importe)) from public.multas m where m.temporada_id = t.id and m.estado = 'pagada'), 0)
      - coalesce((select sum(g.importe) from public.gastos_hucha g where g.temporada_id = t.id), 0)
    into v_inicial from public.temporadas t where t.activa;
    v_inicial := coalesce(v_inicial, 0);
  end if;
  if v_inicial not between -999999.99 and 999999.99 or v_inicial <> round(v_inicial, 2) then
    return '{"ok":false,"error":"Saldo inicial de hucha no válido"}';
  end if;

  insert into public.temporadas as t (nombre, activa, hucha_inicial) values (v_nombre, false, v_inicial)
  on conflict do nothing returning t.id into v_id;
  if not found then return '{"ok":false,"error":"Ya existe una temporada con ese nombre"}'; end if;

  update public.temporadas t set activa = false where t.activa;
  update public.temporadas t set activa = true where t.id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$funcion$;

revoke all on function
  public.login_staff(text, text),
  public.registrar_multa(text, text, uuid, text, numeric, integer, integer, date, text, boolean),
  public.marcar_pagada(text, text, uuid, date),
  public.declarar_pago(uuid),
  public.verificar_pago(text, text, uuid, boolean, date),
  public.anular_multa(text, text, uuid, text),
  public.registrar_gasto(text, text, uuid, numeric, text, date),
  public.editar_hucha_inicial(text, text, uuid, numeric, text, date),
  public.crear_temporada(text, text, text, numeric)
from public, anon, authenticated;

grant execute on function
  public.login_staff(text, text),
  public.registrar_multa(text, text, uuid, text, numeric, integer, integer, date, text, boolean),
  public.marcar_pagada(text, text, uuid, date),
  public.declarar_pago(uuid),
  public.verificar_pago(text, text, uuid, boolean, date),
  public.anular_multa(text, text, uuid, text),
  public.registrar_gasto(text, text, uuid, numeric, text, date),
  public.editar_hucha_inicial(text, text, uuid, numeric, text, date),
  public.crear_temporada(text, text, text, numeric)
to anon;

commit;
