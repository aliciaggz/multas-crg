-- T002-05. Acceso por PIN individual y escrituras con sesión revocable.
-- Ejecutar después de 003. Las firmas antiguas siguen activas durante la transición.
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

create schema if not exists crg_privado;
revoke all on schema crg_privado from public, anon, authenticated;

create table if not exists crg_privado.sesiones_staff (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  staff_id uuid not null references public.staff(id) on delete cascade,
  creada_en timestamptz not null default clock_timestamp(),
  revocada_en timestamptz
);
create index if not exists sesiones_staff_cuenta on crg_privado.sesiones_staff(staff_id);

create table if not exists crg_privado.limite_acceso_staff (
  id boolean primary key check (id),
  fallos integer not null default 0 check (fallos between 0 and 5),
  bloqueado_hasta timestamptz
);
insert into crg_privado.limite_acceso_staff (id) values (true) on conflict do nothing;

alter table crg_privado.sesiones_staff enable row level security;
alter table crg_privado.limite_acceso_staff enable row level security;
revoke all on all tables in schema crg_privado from public, anon, authenticated;

-- Solo para administradores. El bloqueo serializa los cambios de PIN y el acceso.
create or replace function crg_privado.configurar_pin(usuario text, pin text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_id uuid;
begin
  if $2 is null or $2 !~ '^[0-9]{4}$' then
    return '{"ok":false,"error":"Usa un PIN de cuatro dígitos"}';
  end if;

  perform 1 from crg_privado.limite_acceso_staff where id for update;
  select s.id into v_id from public.staff s where s.usuario = lower(btrim($1));
  if not found then return '{"ok":false,"error":"Cuenta no disponible"}'; end if;
  if exists (
    select 1 from public.staff s where s.id <> v_id
      and extensions.crypt($2, s.pin_hash) = s.pin_hash
  ) then
    return '{"ok":false,"error":"Ese PIN ya está asignado"}';
  end if;

  update public.staff s
  set pin_hash = extensions.crypt($2, extensions.gen_salt('bf')),
      intentos_fallidos = 0, bloqueado_hasta = null
  where s.id = v_id;
  if not found then return '{"ok":false,"error":"Cuenta no disponible"}'; end if;
  return '{"ok":true}';
end;
$funcion$;

create or replace function crg_privado.revocar_sesiones_por_pin()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
begin
  update crg_privado.sesiones_staff
  set revocada_en = clock_timestamp()
  where staff_id = new.id and revocada_en is null;
  return new;
end;
$funcion$;

drop trigger if exists revocar_sesiones_por_pin on public.staff;
create trigger revocar_sesiones_por_pin
after update of pin_hash on public.staff for each row
when (old.pin_hash is distinct from new.pin_hash)
execute function crg_privado.revocar_sesiones_por_pin();

create or replace function public.iniciar_sesion_staff(pin text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_limite crg_privado.limite_acceso_staff%rowtype;
  v_coincidencias uuid[];
  v_hashes text[];
  v_cuenta public.staff%rowtype;
  v_ahora timestamptz;
  v_fallos integer;
  v_token text;
  v_error constant jsonb := '{"ok":false,"error":"No autorizado"}';
begin
  select * into strict v_limite from crg_privado.limite_acceso_staff where id for update;
  v_ahora := clock_timestamp();
  if v_limite.bloqueado_hasta > v_ahora then
    return v_error || jsonb_build_object('reintentar_en', ceil(extract(epoch from v_limite.bloqueado_hasta - v_ahora)));
  end if;

  if $1 ~ '^[0-9]{4}$' then
    select array_agg(s.id), array_agg(s.pin_hash) into v_coincidencias, v_hashes
    from public.staff s where extensions.crypt($1, s.pin_hash) = s.pin_hash;

    if cardinality(v_coincidencias) = 1 then
      -- Un cambio concurrente de PIN invalida la coincidencia anterior.
      select s.* into v_cuenta from public.staff s
      where s.id = v_coincidencias[1] and s.pin_hash = v_hashes[1] for share;
      if found then
        v_token := encode(extensions.gen_random_bytes(32), 'hex');
        insert into crg_privado.sesiones_staff (token_hash, staff_id)
        values (extensions.digest(v_token, 'sha256'), v_cuenta.id);
        update crg_privado.limite_acceso_staff set fallos = 0, bloqueado_hasta = null where id;
        return jsonb_build_object('ok', true, 'usuario', v_cuenta.usuario, 'token', v_token);
      end if;
    end if;
  end if;

  v_fallos := case when v_limite.bloqueado_hasta is not null then 1 else v_limite.fallos + 1 end;
  update crg_privado.limite_acceso_staff
  set fallos = v_fallos, bloqueado_hasta = case when v_fallos = 5 then clock_timestamp() + interval '1 minute' end
  where id;
  return case when v_fallos = 5 then v_error || '{"reintentar_en":60}'::jsonb else v_error end;
end;
$funcion$;

-- Bloquea la sesión mientras dura una escritura protegida.
create or replace function crg_privado.validar_sesion(token text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_usuario text;
begin
  if $1 ~ '^[0-9a-f]{64}$' then
    select s.usuario into v_usuario
    from crg_privado.sesiones_staff se join public.staff s on s.id = se.staff_id
    where se.token_hash = extensions.digest($1, 'sha256') and se.revocada_en is null
    for share of se;
    if found then return jsonb_build_object('ok', true, 'usuario', v_usuario); end if;
  end if;
  return '{"ok":false,"error":"No autorizado"}';
end;
$funcion$;

create or replace function public.validar_sesion_staff(token text)
returns jsonb
language sql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
  select crg_privado.validar_sesion($1);
$funcion$;

create or replace function public.cerrar_sesion_staff(token text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
begin
  if $1 ~ '^[0-9a-f]{64}$' then
    update crg_privado.sesiones_staff
    set revocada_en = clock_timestamp()
    where token_hash = extensions.digest($1, 'sha256') and revocada_en is null;
  end if;
  return '{"ok":true}';
end;
$funcion$;

-- Cada operación comparte una implementación privada. Las entradas públicas
-- obtienen la autoría de la autenticación antes de trasladarle los argumentos.
create or replace function crg_privado.registrar_multa(
  actor text, jugadora_id uuid, concepto_id text, importe numeric,
  multiplicador integer, cantidad integer, fecha date, observacion text,
  pagada_ahora boolean
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
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
  v_observacion text := nullif(btrim($8), '');
begin
  if $7 is null or not isfinite($7) or $6 is null or $6 < 1 or $9 is null
    or ($9 and $7 > v_hoy) then
    return '{"ok":false,"error":"Datos de multa no válidos"}';
  end if;

  -- Comparte el bloqueo de cambio de temporada y serializa el cálculo de escalones por jugadora.
  perform pg_advisory_xact_lock_shared(4287, 1);
  select t.id into v_temporada from public.temporadas t where t.activa for share;
  if not found then return '{"ok":false,"error":"No hay temporada activa"}'; end if;
  select j.* into v_jugadora from public.jugadoras j where j.id = $2 and j.activa for update;
  if not found then return '{"ok":false,"error":"Jugadora no disponible"}'; end if;

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
      where m.temporada_id = v_temporada and m.jugadora_id = $2 and m.estado <> 'anulada';

      v_nivel := case when v_faltas >= 9 then 'esc_9' when v_faltas >= 6 then 'esc_6' when v_faltas >= 3 then 'esc_3' end;
      v_base := v_base - v_registrado;
      if v_nivel is distinct from $3 or v_base <= 0 then
        return '{"ok":false,"error":"El escalón indicado no está pendiente"}';
      end if;
    end if;

    v_multiplicador := case when v_jugadora.capitana then 2 else 1 end;
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
    temporada_id, jugadora_id, concepto_id, importe, multiplicador, cantidad, fecha, observacion,
    estado, fecha_pago, cobrada_por, cobrada_en, importe_cobrado, registrada_por
  ) values (
    v_temporada, $2, $3, v_importe, v_multiplicador, $6, $7, v_observacion,
    case when v_fecha_pago is null then 'pendiente' else 'pagada' end,
    v_fecha_pago, case when v_fecha_pago is not null then $1 end,
    case when v_fecha_pago is not null then clock_timestamp() end, v_cobrado, $1
  ) on conflict do nothing returning m.id into v_id;
  if not found then return '{"ok":false,"error":"El escalón ya está registrado"}'; end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$funcion$;

create or replace function public.registrar_multa(
  usuario text, pin text, jugadora_id uuid, concepto_id text,
  importe numeric, multiplicador integer, cantidad integer, fecha date,
  observacion text, pagada_ahora boolean
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.registrar_multa(v_acceso->>'usuario', $3, $4, $5, $6, $7, $8, $9, $10);
end;
$funcion$;

create or replace function public.registrar_multa_sesion(
  token text, jugadora_id uuid, concepto_id text, importe numeric,
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
  return crg_privado.registrar_multa(v_acceso->>'usuario', $2, $3, $4, $5, $6, $7, $8, $9);
end;
$funcion$;

create or replace function crg_privado.marcar_pagada(actor text, multa_id uuid, fecha_pago date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
begin

  update public.multas m
  set estado = 'pagada', fecha_pago = $3, cobrada_por = $1, cobrada_en = clock_timestamp(),
      importe_cobrado = m.importe * case when $3 > m.fecha + 15 then 2 else 1 end
  where m.id = $2 and m.estado = 'pendiente' and $3 between m.fecha and v_hoy;
  if not found then return '{"ok":false,"error":"Multa pendiente o fecha de cobro no válida"}'; end if;
  return '{"ok":true}';
end;
$funcion$;

create or replace function public.marcar_pagada(usuario text, pin text, multa_id uuid, fecha_pago date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.marcar_pagada(v_acceso->>'usuario', $3, $4);
end;
$funcion$;

create or replace function public.marcar_pagada_sesion(token text, multa_id uuid, fecha_pago date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := crg_privado.validar_sesion($1);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.marcar_pagada(v_acceso->>'usuario', $2, $3);
end;
$funcion$;

create or replace function crg_privado.verificar_pago(actor text, multa_id uuid, aceptar boolean, fecha_pago date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_multa public.multas%rowtype;
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
begin
  if $3 is null then return '{"ok":false,"error":"Indica si aceptas el pago"}'; end if;

  select m.* into v_multa from public.multas m where m.id = $2 and m.estado = 'pago_declarado' for update;
  if not found then return '{"ok":false,"error":"La multa no tiene un pago por verificar"}'; end if;

  if $3 then
    if $4 is null or $4 not between v_multa.fecha and v_hoy then
      return '{"ok":false,"error":"Fecha de cobro no válida"}';
    end if;
    update public.multas m
    set estado = 'pagada', fecha_pago = $4, cobrada_por = $1, cobrada_en = clock_timestamp(),
        importe_cobrado = m.importe * case when (m.declarada_en at time zone 'Europe/Madrid')::date > m.fecha + 15 then 2 else 1 end
    where m.id = v_multa.id;
  else
    update public.multas m set estado = 'pendiente', declarada_en = null where m.id = v_multa.id;
  end if;
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
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.verificar_pago(v_acceso->>'usuario', $3, $4, $5);
end;
$funcion$;

create or replace function public.verificar_pago_sesion(token text, multa_id uuid, aceptar boolean, fecha_pago date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := crg_privado.validar_sesion($1);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.verificar_pago(v_acceso->>'usuario', $2, $3, $4);
end;
$funcion$;

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
  update public.multas m
  set estado = 'anulada', motivo_anulacion = v_motivo, anulada_por = $1, anulada_en = clock_timestamp()
  where m.id = $2 and m.estado <> 'anulada';
  if not found then return '{"ok":false,"error":"Multa no disponible para anular"}'; end if;
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
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.anular_multa(v_acceso->>'usuario', $3, $4);
end;
$funcion$;

create or replace function public.anular_multa_sesion(token text, multa_id uuid, motivo text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := crg_privado.validar_sesion($1);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.anular_multa(v_acceso->>'usuario', $2, $3);
end;
$funcion$;

create or replace function crg_privado.registrar_gasto(actor text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_motivo text := nullif(btrim($4), '');
  v_id uuid;
begin
  if $3 is null or $3 not between 0.01 and 999999.99 or $3 <> round($3, 2)
    or v_motivo is null or $5 is null or not isfinite($5) then
    return '{"ok":false,"error":"El gasto requiere importe positivo, motivo y fecha"}';
  end if;

  perform 1 from public.temporadas t where t.id = $2 for key share;
  if not found then return '{"ok":false,"error":"Temporada no disponible"}'; end if;

  insert into public.gastos_hucha as g (temporada_id, importe, motivo, fecha, registrado_por)
  values ($2, $3, v_motivo, $5, $1) returning g.id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$funcion$;

create or replace function public.registrar_gasto(usuario text, pin text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.registrar_gasto(v_acceso->>'usuario', $3, $4, $5, $6);
end;
$funcion$;

create or replace function public.registrar_gasto_sesion(token text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := crg_privado.validar_sesion($1);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.registrar_gasto(v_acceso->>'usuario', $2, $3, $4, $5);
end;
$funcion$;

create or replace function crg_privado.editar_hucha_inicial(actor text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_motivo text := nullif(btrim($4), '');
begin
  if $3 is null or $3 not between -999999.99 and 999999.99 or $3 <> round($3, 2)
    or v_motivo is null or $5 is null or not isfinite($5) then
    return '{"ok":false,"error":"El ajuste de hucha requiere importe, motivo y fecha"}';
  end if;

  update public.temporadas t
  set hucha_inicial = $3,
      historial_hucha_inicial = t.historial_hucha_inicial || jsonb_build_array(jsonb_build_object(
        'anterior', t.hucha_inicial, 'nuevo', $3, 'motivo', v_motivo, 'fecha', $5,
        'usuario', $1, 'registrado_en', clock_timestamp()
      ))
  where t.id = $2;
  if not found then return '{"ok":false,"error":"Temporada no disponible"}'; end if;
  return '{"ok":true}';
end;
$funcion$;

create or replace function public.editar_hucha_inicial(usuario text, pin text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.editar_hucha_inicial(v_acceso->>'usuario', $3, $4, $5, $6);
end;
$funcion$;

create or replace function public.editar_hucha_inicial_sesion(token text, temporada_id uuid, importe numeric, motivo text, fecha date)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := crg_privado.validar_sesion($1);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.editar_hucha_inicial(v_acceso->>'usuario', $2, $3, $4, $5);
end;
$funcion$;

create or replace function crg_privado.crear_temporada(actor text, nombre text, hucha_inicial numeric)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_nombre text := nullif(btrim($2), '');
  v_inicial numeric := $3;
  v_id uuid;
begin
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

create or replace function public.crear_temporada(usuario text, pin text, nombre text, hucha_inicial numeric)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := public.login_staff($1, $2);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.crear_temporada(v_acceso->>'usuario', $3, $4);
end;
$funcion$;

create or replace function public.crear_temporada_sesion(token text, nombre text, hucha_inicial numeric)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $funcion$
declare
  v_acceso jsonb := crg_privado.validar_sesion($1);
begin
  if v_acceso->>'ok' is distinct from 'true' then return v_acceso; end if;
  return crg_privado.crear_temporada(v_acceso->>'usuario', $2, $3);
end;
$funcion$;

revoke all on all functions in schema crg_privado from public, anon, authenticated;

revoke all on function
  public.iniciar_sesion_staff(text),
  public.validar_sesion_staff(text),
  public.cerrar_sesion_staff(text),
  public.registrar_multa_sesion(text, uuid, text, numeric, integer, integer, date, text, boolean),
  public.marcar_pagada_sesion(text, uuid, date),
  public.verificar_pago_sesion(text, uuid, boolean, date),
  public.anular_multa_sesion(text, uuid, text),
  public.registrar_gasto_sesion(text, uuid, numeric, text, date),
  public.editar_hucha_inicial_sesion(text, uuid, numeric, text, date),
  public.crear_temporada_sesion(text, text, numeric)
from public, anon, authenticated;

grant execute on function
  public.iniciar_sesion_staff(text),
  public.validar_sesion_staff(text),
  public.cerrar_sesion_staff(text),
  public.registrar_multa_sesion(text, uuid, text, numeric, integer, integer, date, text, boolean),
  public.marcar_pagada_sesion(text, uuid, date),
  public.verificar_pago_sesion(text, uuid, boolean, date),
  public.anular_multa_sesion(text, uuid, text),
  public.registrar_gasto_sesion(text, uuid, numeric, text, date),
  public.editar_hucha_inicial_sesion(text, uuid, numeric, text, date),
  public.crear_temporada_sesion(text, text, numeric)
to anon;

commit;
