-- M8. Ejecutar como administrador después de 003_funciones.sql.
-- El entrenador, su PIN aleatorio y todos los datos de prueba se revierten al final.
begin;

do $pruebas$
declare
  v_usuario text := 'prueba_' || replace(gen_random_uuid()::text, '-', '');
  v_pin text := lpad(trunc(random() * 10000)::text, 4, '0');
  v_pin_incorrecto text := case when v_pin = '0000' then '9999' else '0000' end;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_temporada uuid;
  v_jugadora uuid;
  v_multa uuid;
  v_antigua uuid;
  v_nueva_temporada uuid;
  v_saldo_traspaso numeric;
  v_resultado jsonb;
  v_no_autorizado constant jsonb := '{"ok":false,"error":"No autorizado"}';
begin
  select t.id into strict v_temporada from public.temporadas t where t.activa;

  insert into public.staff (usuario, pin_hash)
  values (v_usuario, extensions.crypt(v_pin, extensions.gen_salt('bf')));
  insert into public.jugadoras (nombre, dorsal, capitana)
  select 'Prueba temporal', d.dorsal, false
  from generate_series(99, 199) as d(dorsal)
  where not exists (select 1 from public.jugadoras j where j.dorsal = d.dorsal and j.activa)
  limit 1 returning id into strict v_jugadora;

  set local role anon;

  -- M8.1. El PIN erróneo suma un fallo y no crea multas.
  v_resultado := public.registrar_multa(v_usuario, v_pin_incorrecto, v_jugadora,
    'ent_tarde', 2, 1, 1, v_hoy, null, false);
  if v_resultado is distinct from v_no_autorizado or exists (
    select 1 from public.multas m where m.jugadora_id = v_jugadora
  ) then
    raise exception 'M8.1: un PIN incorrecto no debe registrar una multa';
  end if;

  -- M8.2. El servidor valida la vista previa y registra el importe del catálogo.
  v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
    'ent_tarde', 1, 1, 1, v_hoy, null, false);
  if v_resultado->>'ok' is distinct from 'false' or exists (
    select 1 from public.multas m where m.jugadora_id = v_jugadora
  ) then
    raise exception 'M8.2: el importe manipulado debe rechazarse';
  end if;
  v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
    'ent_tarde', 2, 1, 1, v_hoy, null, false);
  v_multa := (v_resultado->>'id')::uuid;
  if v_resultado->>'ok' is distinct from 'true' or not exists (
    select 1 from public.multas m
    where m.id = v_multa and m.importe = 2 and m.estado = 'pendiente' and m.registrada_por = v_usuario
  ) then
    raise exception 'M8.2: falta la multa por 2 euros registrada por el entrenador';
  end if;

  -- M8.3. El acierto previo reinicia los fallos. El quinto fallo bloquea incluso el PIN correcto.
  for intento in 1..5 loop
    if public.login_staff(v_usuario, v_pin_incorrecto) is distinct from v_no_autorizado then
      raise exception 'M8.3: un PIN erróneo debe devolver el error genérico';
    end if;
  end loop;
  if public.login_staff(v_usuario, v_pin) is distinct from v_no_autorizado then
    raise exception 'M8.3: el PIN correcto también debe rechazarse durante el bloqueo';
  end if;
  reset role;
  if not exists (select 1 from public.staff s where s.usuario = v_usuario
    and s.intentos_fallidos = 5 and s.bloqueado_hasta > clock_timestamp() + interval '45 seconds'
    and s.bloqueado_hasta <= clock_timestamp() + interval '1 minute') then
    raise exception 'M8.3: falta el bloqueo de un minuto';
  end if;
  update public.staff s set bloqueado_hasta = clock_timestamp() - interval '1 second'
  where s.usuario = v_usuario;
  set local role anon;
  if public.login_staff(v_usuario, v_pin)->>'ok' is distinct from 'true' then
    raise exception 'M8.3: el PIN debe funcionar tras el bloqueo';
  end if;

  -- M8.4. El escalón requiere las faltas, es único y solo suma la diferencia.
  v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
    'esc_3', 4, 1, 1, v_hoy, null, false);
  if v_resultado->>'ok' is distinct from 'false' then
    raise exception 'M8.4: se ha admitido un escalón antes de alcanzar las faltas';
  end if;
  for falta in 1..6 loop
    v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
      'ent_falta_con_aviso', 0, 1, 1, v_hoy - falta, null, false);
    if v_resultado->>'ok' is distinct from 'true' or not exists (
      select 1 from public.multas m where m.id = (v_resultado->>'id')::uuid
        and m.estado = 'pagada' and m.importe_cobrado = 0
    ) then
      raise exception 'M8.4: las faltas de 0 euros deben quedar pagadas';
    end if;
    if falta = 3 then
      v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
        'esc_3', 4, 1, 1, v_hoy, null, false);
      if v_resultado->>'ok' is distinct from 'true' then
        raise exception 'M8.4: falta el escalón de 4 euros';
      end if;
      v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
        'esc_3', 4, 1, 1, v_hoy, null, false);
      if v_resultado->>'ok' is distinct from 'false' then
        raise exception 'M8.4: se ha duplicado el escalón de 3 faltas';
      end if;
    end if;
  end loop;
  v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
    'esc_6', 2, 1, 1, v_hoy, null, false);
  if v_resultado->>'ok' is distinct from 'true' then
    raise exception 'M8.4: al llegar a 6 faltas se deben registrar solo 2 euros más';
  end if;

  -- M8.5. La declaración es pública e idempotente.
  perform public.declarar_pago(v_multa);
  perform public.declarar_pago(v_multa);
  if not exists (select 1 from public.multas m where m.id = v_multa and m.estado = 'pago_declarado'
    and m.declarada_en is not null and m.importe = 2 and m.importe_cobrado is null) then
    raise exception 'M8.5: la declaración no debe registrar un cobro';
  end if;

  -- M8.6. Rechazo y aceptación. La aceptación tardía conserva el importe cobrado.
  perform public.verificar_pago(v_usuario, v_pin, v_multa, false, null);
  if not exists (select 1 from public.multas m where m.id = v_multa and m.estado = 'pendiente'
    and m.declarada_en is null) then
    raise exception 'M8.6: el rechazo debe volver a pendiente';
  end if;
  perform public.declarar_pago(v_multa);
  perform public.verificar_pago(v_usuario, v_pin, v_multa, true, v_hoy);
  if not exists (select 1 from public.multas m where m.id = v_multa and m.estado = 'pagada'
    and m.fecha_pago = v_hoy and m.cobrada_por = v_usuario and m.importe_cobrado = 2) then
    raise exception 'M8.6: la aceptación debe guardar el cobro y su trazabilidad';
  end if;
  v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
    'ent_tarde', 2, 1, 1, v_hoy - 16, null, false);
  v_antigua := (v_resultado->>'id')::uuid;
  perform public.declarar_pago(v_antigua);
  perform public.verificar_pago(v_usuario, v_pin, v_antigua, true, v_hoy);
  if not exists (select 1 from public.multas m where m.id = v_antigua
    and m.estado = 'pagada' and m.importe = 2 and m.importe_cobrado = 4) then
    raise exception 'M8.6: un pago declarado tarde conserva el doble como importe cobrado';
  end if;

  -- M8.7. La prueba de permisos comprueba también authenticated, sin tocar registros reales.
  if has_table_privilege('anon', 'public.multas', 'UPDATE')
    or has_table_privilege('anon', 'public.staff', 'SELECT')
    or has_function_privilege('authenticated', 'public.declarar_pago(uuid)', 'EXECUTE') then
    raise exception 'M8.7: se han concedido permisos directos o a un rol incorrecto';
  end if;
  begin
    update public.multas m set estado = 'pagada' where m.id = v_multa;
    raise exception 'M8.7: anon pudo escribir directamente';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.staff s where s.usuario = v_usuario;
    raise exception 'M8.7: anon pudo leer staff';
  exception when insufficient_privilege then null;
  end;

  -- Comprobaciones adicionales de los otros caminos de escritura.
  v_resultado := public.registrar_multa(v_usuario, v_pin, v_jugadora,
    'ajuste_manual', 12.50, 1, 1, v_hoy, 'Motivo de prueba', false);
  v_antigua := (v_resultado->>'id')::uuid;
  perform public.marcar_pagada(v_usuario, v_pin, v_antigua, v_hoy);
  perform public.anular_multa(v_usuario, v_pin, v_antigua, 'Anulación de prueba');
  if not exists (select 1 from public.multas m where m.id = v_antigua
    and m.estado = 'anulada' and m.importe_cobrado = 12.50 and m.anulada_por = v_usuario
    and m.anulada_en is not null) then
    raise exception 'Falla la auditoría del cobro directo o de la anulación';
  end if;

  v_resultado := public.registrar_gasto(v_usuario, v_pin, v_temporada, 3.50, 'Gasto de prueba', v_hoy);
  if v_resultado->>'ok' is distinct from 'true' then raise exception 'Falla el registro de gastos'; end if;
  v_resultado := public.editar_hucha_inicial(v_usuario, v_pin, v_temporada, 15, 'Ajuste de prueba', v_hoy);
  if v_resultado->>'ok' is distinct from 'true' or not exists (
    select 1 from public.temporadas t where t.id = v_temporada and t.hucha_inicial = 15
      and t.historial_hucha_inicial @> jsonb_build_array(jsonb_build_object('usuario', v_usuario, 'motivo', 'Ajuste de prueba'))
  ) then raise exception 'Falla el historial de hucha inicial'; end if;

  select t.hucha_inicial
    + coalesce((select sum(coalesce(m.importe_cobrado, m.importe)) from public.multas m where m.temporada_id = t.id and m.estado = 'pagada'), 0)
    - coalesce((select sum(g.importe) from public.gastos_hucha g where g.temporada_id = t.id), 0)
  into v_saldo_traspaso from public.temporadas t where t.id = v_temporada;

  v_resultado := public.crear_temporada(v_usuario, v_pin, 'Prueba ' || v_usuario, null);
  v_nueva_temporada := (v_resultado->>'id')::uuid;
  if not exists (select 1 from public.temporadas t where t.id = v_nueva_temporada and t.activa
    and t.hucha_inicial = v_saldo_traspaso)
    or exists (select 1 from public.temporadas t where t.id = v_temporada and t.activa) then
    raise exception 'Falla la activación o el traspaso de saldo de la nueva temporada';
  end if;
  reset role;
end
$pruebas$;

rollback;
select 'M8: siete pruebas y comprobaciones adicionales correctas; datos de prueba revertidos.' as resultado;
