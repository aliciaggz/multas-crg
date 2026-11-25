-- T002-07. Ejecutar después de 006 como administrador. Los datos de prueba se revierten.
begin;

do $pruebas$
declare
  v_jaime uuid;
  v_nacho uuid;
  v_guada uuid;
  v_equipo uuid;
  v_temporada uuid;
  v_temporada_nueva uuid;
  v_jugadora uuid;
  v_multa_jugadora uuid;
  v_multa uuid;
  v_ajuste uuid;
  v_escalon uuid;
  v_cuenta uuid;
  v_usuario text := 'prueba_tecnico_' || gen_random_uuid();
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_res jsonb;
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
  v_no_autorizado constant jsonb := '{"ok":false,"error":"No autorizado"}';
begin
  select id into strict v_temporada from public.temporadas where activa;
  select id into strict v_jaime from public.cuerpo_tecnico where nombre = 'Jaime' and activo;
  select id into strict v_nacho from public.cuerpo_tecnico where nombre = 'Nacho' and activo;
  select id into strict v_guada from public.cuerpo_tecnico where nombre = 'Guada' and activo;
  if not (select relrowsecurity from pg_class where oid = 'public.cuerpo_tecnico'::regclass)
    or not has_table_privilege('anon', 'public.cuerpo_tecnico', 'SELECT')
    or has_table_privilege('anon', 'public.cuerpo_tecnico', 'INSERT, UPDATE, DELETE')
    or has_table_privilege('authenticated', 'public.cuerpo_tecnico', 'INSERT, UPDATE, DELETE')
    or has_table_privilege('anon', 'public.staff', 'SELECT')
    or has_function_privilege('authenticated',
      'public.registrar_multa_tecnico_sesion(text,uuid,text,numeric,integer,integer,date,text,boolean)', 'EXECUTE') then
    raise exception 'Los permisos deben permitir solo lectura pública del cuerpo técnico y las RPC previstas';
  end if;

  insert into public.staff (usuario, pin_hash)
    values (v_usuario, extensions.crypt(encode(extensions.gen_random_bytes(16), 'hex'), extensions.gen_salt('bf')))
    returning id into v_cuenta;
  insert into crg_privado.sesiones_staff (token_hash, staff_id)
    values (extensions.digest(v_token, 'sha256'), v_cuenta);
  insert into public.jugadoras (nombre, dorsal)
    select 'Prueba destinatarios', n from generate_series(1000, 1100) n
    where not exists (select 1 from public.jugadoras j where j.dorsal = n and j.activa)
    limit 1 returning id into strict v_jugadora;
  insert into public.cuerpo_tecnico (nombre, activo)
    values ('Prueba inactiva ' || gen_random_uuid(), false) returning id into v_equipo;

  begin
    insert into public.multas (temporada_id, jugadora_id, tecnico_id, concepto_id, importe, fecha, registrada_por)
      values (v_temporada, v_jugadora, v_jaime, 'ent_tarde', 2, v_hoy, v_usuario);
    raise exception 'No debe haber dos destinatarios en una multa';
  exception when check_violation then null;
  end;
  begin
    insert into public.multas (temporada_id, concepto_id, importe, fecha, registrada_por)
      values (v_temporada, 'ent_tarde', 2, v_hoy, v_usuario);
    raise exception 'Toda multa debe tener destinatario';
  exception when check_violation then null;
  end;

  set local role anon;

  if (select count(*) from public.cuerpo_tecnico where id in (v_jaime, v_nacho, v_guada)) <> 3 then
    raise exception 'Las fichas de Jaime, Nacho y Guada deben poder leerse sin sesión';
  end if;
  if public.registrar_multa_tecnico_sesion('invalido', v_jaime, 'ent_tarde', 4, 2, 1, v_hoy, null, false)
    is distinct from v_no_autorizado then
    raise exception 'Registrar a un entrenador requiere sesión válida';
  end if;
  if public.registrar_multa_tecnico_sesion(v_token, v_equipo, 'ent_tarde', 4, 2, 1, v_hoy, null, false)->>'ok'
    is distinct from 'false' then
    raise exception 'Un destinatario inactivo no puede recibir multas nuevas';
  end if;

  v_res := public.registrar_multa_sesion(v_token, v_jugadora, 'ent_tarde', 2, 1, 1, v_hoy, null, false);
  v_multa_jugadora := (v_res->>'id')::uuid;
  if not exists (select 1 from public.multas where id = v_multa_jugadora
    and jugadora_id = v_jugadora and tecnico_id is null and importe = 2) then
    raise exception 'La firma usada por la aplicación actual debe seguir registrando multas de jugadoras';
  end if;

  if public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'ent_tarde', 2, 1, 1, v_hoy, null, false)->>'ok'
    is distinct from 'false' then
    raise exception 'La base de datos debe rechazar la multa de catálogo sin multiplicador de entrenador';
  end if;
  v_res := public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'ent_tarde', 4, 2, 1, v_hoy - 16, null, false);
  v_multa := (v_res->>'id')::uuid;
  if not exists (select 1 from public.multas where id = v_multa and temporada_id = v_temporada
    and tecnico_id = v_jaime and jugadora_id is null and importe = 4 and multiplicador = 2 and registrada_por = v_usuario) then
    raise exception 'Falta una multa de 4 euros para el entrenador con la autoría de la sesión';
  end if;
  v_res := public.registrar_multa_tecnico_sesion(v_token, v_nacho, 'ajuste_manual', 3.5, 1, 1, v_hoy, 'Prueba', false);
  v_ajuste := (v_res->>'id')::uuid;
  if not exists (select 1 from public.multas where id = v_ajuste and tecnico_id = v_nacho
    and importe = 3.5 and multiplicador = 1) then
    raise exception 'El ajuste manual debe conservar su importe sin multiplicador';
  end if;

  perform public.declarar_pago(v_multa);
  if not exists (select 1 from public.multas where id = v_multa and estado = 'pago_declarado'
      and declarada_en is not null and importe_cobrado is null) then
    raise exception 'La declaración pública no debe convertir la multa en ingreso';
  end if;
  perform public.verificar_pago_sesion(v_token, v_multa, false, null);
  if not exists (select 1 from public.multas where id = v_multa and estado = 'pendiente' and declarada_en is null) then
    raise exception 'El rechazo debe devolver la multa a pendiente';
  end if;
  perform public.declarar_pago(v_multa);
  perform public.verificar_pago_sesion(v_token, v_multa, true, v_hoy);
  if not exists (select 1 from public.multas where id = v_multa and estado = 'pagada'
      and importe = 4 and importe_cobrado = 8 and cobrada_por = v_usuario) then
    raise exception 'El cobro de la declaración tardía debe duplicar el importe vigente y conservar la autoría';
  end if;
  perform public.marcar_pagada_sesion(v_token, v_ajuste, v_hoy);
  if not exists (select 1 from public.multas where id = v_ajuste and estado = 'pagada' and importe_cobrado = 3.5) then
    raise exception 'Debe poder cobrarse directamente a un entrenador';
  end if;
  perform public.anular_multa_sesion(v_token, v_ajuste, 'Duplicada');
  if not exists (select 1 from public.multas where id = v_ajuste and estado = 'anulada'
      and anulada_por = v_usuario and motivo_anulacion = 'Duplicada') then
    raise exception 'Debe poder anularse una multa de entrenador y conservar la trazabilidad';
  end if;

  for n in 1..6 loop
    v_res := public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'ent_falta_con_aviso', 0, 2, 1, v_hoy - n, null, false);
    if not exists (select 1 from public.multas where id = (v_res->>'id')::uuid and estado = 'pagada' and importe_cobrado = 0) then
      raise exception 'Las faltas de 0 euros deben guardarse como pagadas y contar para la asistencia';
    end if;
    if n = 3 then
      v_res := public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'esc_3', 8, 2, 1, v_hoy, null, false);
      if v_res->>'ok' is distinct from 'true' then raise exception 'El primer escalón del técnico debe ser de 8 euros'; end if;
      if public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'esc_3', 8, 2, 1, v_hoy, null, false)->>'ok'
        is distinct from 'false' then
        raise exception 'Un escalón no puede inscribirse dos veces';
      end if;
    end if;
  end loop;
  v_res := public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'esc_6', 4, 2, 1, v_hoy, null, false);
  v_escalon := (v_res->>'id')::uuid;
  if not exists (select 1 from public.multas where id = v_escalon and importe = 4 and tecnico_id = v_jaime) then
    raise exception 'El segundo escalón debe cobrar solo la diferencia de 4 euros';
  end if;
  if public.registrar_multa_tecnico_sesion(v_token, v_guada, 'esc_3', 8, 2, 1, v_hoy, null, false)->>'ok'
    is distinct from 'false' then
    raise exception 'El contador debe ser independiente para cada destinatario';
  end if;
  reset role;

  begin
    insert into public.multas (temporada_id, tecnico_id, concepto_id, importe, fecha, registrada_por)
      values (v_temporada, v_jaime, 'esc_6', 4, v_hoy, v_usuario);
    raise exception 'El índice debe impedir duplicar un escalón aunque se escriba como administrador';
  exception when unique_violation then null;
  end;

  set local role anon;
  v_res := public.crear_temporada_sesion(v_token, 'Prueba ' || gen_random_uuid(), null);
  v_temporada_nueva := (v_res->>'id')::uuid;
  if not exists (select 1 from public.temporadas t where t.id = v_temporada_nueva and t.activa
      and hucha_inicial = (select origen.hucha_inicial + coalesce((select sum(coalesce(m.importe_cobrado, m.importe))
        from public.multas m where m.temporada_id = origen.id and m.estado = 'pagada'), 0)
        - coalesce((select sum(g.importe) from public.gastos_hucha g where g.temporada_id = origen.id), 0)
        from public.temporadas origen where origen.id = v_temporada)) then
    raise exception 'La hucha debe arrastrar los cobros vigentes de ambos tipos de destinatario';
  end if;
  if public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'esc_3', 8, 2, 1, v_hoy, null, false)->>'ok'
    is distinct from 'false' then
    raise exception 'El contador de faltas se reinicia con la temporada';
  end if;
  v_res := public.registrar_multa_tecnico_sesion(v_token, v_jaime, 'ent_tarde', 4, 2, 1, v_hoy, null, false);
  if not exists (select 1 from public.multas where id = (v_res->>'id')::uuid and temporada_id = v_temporada_nueva)
    or not exists (select 1 from public.multas where id = v_multa and temporada_id = v_temporada) then
    raise exception 'Las multas deben quedar en la temporada en la que se registran';
  end if;
  reset role;
end;
$pruebas$;

rollback;
select 'T002-07: destinatarios, escalones, cobros y temporadas comprobados' as resultado;
