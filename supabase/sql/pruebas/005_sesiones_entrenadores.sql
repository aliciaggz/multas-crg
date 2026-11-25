-- T002-05. Ejecutar después de 005 como administrador. Todas las modificaciones se revierten.
begin;

do $pruebas$
declare
  v_a text := 'prueba_a_' || gen_random_uuid();
  v_b text := 'prueba_b_' || gen_random_uuid();
  v_pin_a text;
  v_pin_b text;
  v_erroneo text;
  v_token_a text;
  v_otro_token_a text;
  v_token_b text;
  v_a_id uuid;
  v_res jsonb;
  v_multa uuid;
  v_jugadora uuid;
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
  v_rechazo constant jsonb := '{"ok":false,"error":"No autorizado"}';
begin
  if has_schema_privilege('anon', 'crg_privado', 'USAGE')
    or has_schema_privilege('authenticated', 'crg_privado', 'USAGE')
    or has_table_privilege('anon', 'crg_privado.sesiones_staff', 'SELECT')
    or has_table_privilege('authenticated', 'crg_privado.sesiones_staff', 'SELECT')
    or has_function_privilege('anon', 'crg_privado.validar_sesion(text)', 'EXECUTE')
    or has_function_privilege('anon', 'crg_privado.configurar_pin(text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'crg_privado.registrar_multa(text,uuid,text,numeric,integer,integer,date,text,boolean)', 'EXECUTE') then
    raise exception 'Los datos de sesión y las funciones internas deben ser privados';
  end if;

  -- Selecciona PIN temporales distintos de los ya activos, sin mostrar credenciales.
  for intento in 1..20 loop
    v_pin_a := lpad(trunc(random() * 10000)::text, 4, '0');
    v_pin_b := lpad(trunc(random() * 10000)::text, 4, '0');
    v_erroneo := lpad(trunc(random() * 10000)::text, 4, '0');
    exit when v_pin_a <> v_pin_b and v_erroneo not in (v_pin_a, v_pin_b) and not exists (
      select 1 from public.staff s where extensions.crypt(v_pin_a, s.pin_hash) = s.pin_hash
        or extensions.crypt(v_pin_b, s.pin_hash) = s.pin_hash
        or extensions.crypt(v_erroneo, s.pin_hash) = s.pin_hash
    );
    if intento = 20 then raise exception 'No se pudieron preparar PIN temporales'; end if;
  end loop;

  update crg_privado.limite_acceso_staff set fallos = 0, bloqueado_hasta = null;
  insert into public.staff (usuario, pin_hash)
    values (v_a, extensions.crypt(v_pin_a, extensions.gen_salt('bf'))) returning id into v_a_id;
  insert into public.staff (usuario, pin_hash)
    values (v_b, extensions.crypt(v_pin_b, extensions.gen_salt('bf')));
  if crg_privado.configurar_pin(v_b, v_pin_a)->>'ok' is distinct from 'false' then
    raise exception 'La configuración debe rechazar un PIN asignado a otra cuenta';
  end if;
  insert into public.jugadoras (nombre, dorsal)
    select 'Prueba temporal de sesión', n from generate_series(1000, 1100) n
    where not exists (select 1 from public.jugadoras j where j.dorsal = n and j.activa)
    limit 1 returning id into strict v_jugadora;

  set local role anon;
  if public.login_staff(v_a, v_pin_a)->>'ok' is distinct from 'true' then
    raise exception 'La aplicación anterior debe poder acceder durante la transición';
  end if;
  v_res := public.iniciar_sesion_staff(v_pin_a);
  if v_res->>'usuario' is distinct from v_a or v_res ? 'pin_hash' then
    raise exception 'El primer PIN debe identificar a su entrenador';
  end if;
  v_token_a := v_res->>'token';
  v_otro_token_a := public.iniciar_sesion_staff(v_pin_a)->>'token';
  v_res := public.iniciar_sesion_staff(v_pin_b);
  v_token_b := v_res->>'token';
  if v_res->>'usuario' is distinct from v_b or v_token_a is null or v_token_b is null
    or v_otro_token_a is null or v_token_a = v_otro_token_a or v_token_a = v_token_b then
    raise exception 'Cada acceso debe emitir una sesión independiente y conservar la identidad';
  end if;

  if public.registrar_multa_sesion('token-invalido', v_jugadora, 'ent_tarde', 2, 1, 1, v_hoy, null, false)
    is distinct from v_rechazo or exists (select 1 from public.multas where jugadora_id = v_jugadora) then
    raise exception 'Una sesión inválida no debe autorizar escrituras';
  end if;
  v_res := public.registrar_multa_sesion(v_token_a, v_jugadora, 'ent_tarde', 2, 1, 1, v_hoy, null, false);
  if v_res->>'ok' is distinct from 'true' then raise exception 'No se registró la multa de prueba'; end if;
  v_multa := (v_res->>'id')::uuid;

  perform public.declarar_pago(v_multa);
  v_res := public.verificar_pago_sesion(v_token_b, v_multa, true, v_hoy);
  if v_res->>'ok' is distinct from 'true'
    or not exists (select 1 from public.multas where id = v_multa and estado = 'pagada'
      and importe_cobrado = 2 and registrada_por = v_a and cobrada_por = v_b) then
    raise exception 'El pago público y las autorías deben mantenerse';
  end if;

  perform public.cerrar_sesion_staff(v_token_a);
  perform public.cerrar_sesion_staff(v_token_a);
  if public.validar_sesion_staff(v_token_a) is distinct from v_rechazo
    or public.anular_multa_sesion(v_token_a, v_multa, 'prueba') is distinct from v_rechazo
    or public.validar_sesion_staff(v_otro_token_a)->>'usuario' is distinct from v_a
    or public.validar_sesion_staff(v_token_b)->>'usuario' is distinct from v_b then
    raise exception 'Cerrar una sesión debe revocar solo su token';
  end if;

  for intento in 1..5 loop
    v_res := public.iniciar_sesion_staff(v_erroneo);
    if v_res->>'error' is distinct from 'No autorizado' then
      raise exception 'El PIN incorrecto debe devolver el error genérico';
    end if;
  end loop;
  v_res := public.iniciar_sesion_staff(v_pin_b);
  if v_res->>'error' is distinct from 'No autorizado' or not (v_res ? 'reintentar_en')
    or public.validar_sesion_staff(v_token_b)->>'usuario' is distinct from v_b then
    raise exception 'El bloqueo debe ser común al acceso y preservar sesiones existentes';
  end if;
  reset role;

  if not exists (select 1 from crg_privado.limite_acceso_staff where fallos = 5
    and bloqueado_hasta between clock_timestamp() + interval '45 seconds' and clock_timestamp() + interval '1 minute')
    or exists (select 1 from crg_privado.sesiones_staff where token_hash = convert_to(v_token_b, 'UTF8'))
    or not exists (select 1 from crg_privado.sesiones_staff
      where token_hash = extensions.digest(v_token_b, 'sha256')) then
    raise exception 'Falta el bloqueo de un minuto o el almacenamiento del hash';
  end if;

  update crg_privado.limite_acceso_staff set bloqueado_hasta = clock_timestamp() - interval '1 second';
  set local role anon;
  if public.iniciar_sesion_staff(v_pin_b)->>'usuario' is distinct from v_b then
    raise exception 'El PIN correcto debe volver a funcionar tras el bloqueo';
  end if;
  reset role;

  -- Simula un duplicado anterior y comprueba el cierre seguro y el cambio de PIN.
  update public.staff set pin_hash = extensions.crypt(v_pin_a, extensions.gen_salt('bf')) where usuario = v_b;
  set local role anon;
  if public.iniciar_sesion_staff(v_pin_a) is distinct from v_rechazo
    or public.validar_sesion_staff(v_token_b) is distinct from v_rechazo then
    raise exception 'Un PIN ambiguo se rechaza y las sesiones del PIN cambiado se invalidan';
  end if;
  reset role;

  delete from public.staff where id = v_a_id;
  set local role anon;
  if public.validar_sesion_staff(v_otro_token_a) is distinct from v_rechazo then
    raise exception 'Eliminar una cuenta invalida sus sesiones';
  end if;
  reset role;
end;
$pruebas$;

rollback;
select 'T002-05: sesiones, autoría, permisos y bloqueo comprobados' as resultado;
