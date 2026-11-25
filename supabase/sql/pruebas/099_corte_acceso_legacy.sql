-- T002-11. Ejecutar después del corte. Prueba de permisos y flujos con reversión.
begin;

do $pruebas$
declare
  v_firma regprocedure;
  v_usuario text := 'prueba_corte_' || gen_random_uuid();
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_cuenta uuid;
  v_jugadora uuid;
  v_multa uuid;
  v_hoy date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
  v_resultado jsonb;
begin
  foreach v_firma in array array[
    'public.login_staff(text,text)'::regprocedure,
    'public.registrar_multa(text,text,uuid,text,numeric,integer,integer,date,text,boolean)'::regprocedure,
    'public.marcar_pagada(text,text,uuid,date)'::regprocedure,
    'public.verificar_pago(text,text,uuid,boolean,date)'::regprocedure,
    'public.anular_multa(text,text,uuid,text)'::regprocedure,
    'public.registrar_gasto(text,text,uuid,numeric,text,date)'::regprocedure,
    'public.editar_hucha_inicial(text,text,uuid,numeric,text,date)'::regprocedure,
    'public.crear_temporada(text,text,text,numeric)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_firma, 'EXECUTE')
      or has_function_privilege('authenticated', v_firma, 'EXECUTE') then
      raise exception 'Una firma anterior sigue abierta: %', v_firma;
    end if;
  end loop;

  insert into public.staff (usuario, pin_hash)
    values (v_usuario, extensions.crypt(encode(extensions.gen_random_bytes(16), 'hex'), extensions.gen_salt('bf')))
    returning id into v_cuenta;
  insert into crg_privado.sesiones_staff (token_hash, staff_id)
    values (extensions.digest(v_token, 'sha256'), v_cuenta);
  insert into public.jugadoras (nombre, dorsal)
    select 'Prueba temporal de corte', n from generate_series(1000, 1100) n
    where not exists (select 1 from public.jugadoras j where j.dorsal = n and j.activa)
    limit 1 returning id into strict v_jugadora;

  set local role anon;
  v_resultado := public.registrar_multa_sesion(v_token, v_jugadora, 'ent_tarde', 2, 1, 1, v_hoy, null, false);
  if v_resultado->>'ok' is distinct from 'true' then
    raise exception 'Las escrituras con sesión deben seguir funcionando tras el corte';
  end if;
  v_multa := (v_resultado->>'id')::uuid;
  perform public.declarar_pago(v_multa);
  if not exists (select 1 from public.multas where id = v_multa and estado = 'pago_declarado') then
    raise exception 'La declaración debe seguir siendo pública tras el corte';
  end if;
  reset role;
end;
$pruebas$;

rollback;
select 'T002-11: corte comprobado, escritura por sesión y declaración pública operativas' as resultado;
