# Guía manual de Supabase (lo que haces tú)

## 1. Reparto

- **La IA** escribe los scripts en `supabase/sql/` (numerados) y el código del cliente. No tiene acceso a tu Supabase.
- **Tú** creas el proyecto, ejecutas los scripts, das de alta a los entrenadores, pruebas y cargas los datos.
- **Regla 1:** a la IA y al repositorio solo van la Project URL y la clave publicable. Nunca la clave secreta, la `service_role` ni la contraseña de la base de datos. Si se te cuela una, rótala en Settings > API Keys.
- **Regla 2:** los scripts se ejecutan en orden. Un script ya ejecutado no se edita: cualquier cambio es un script nuevo (004, 005...).
- **Después de cada paso,** dile a la IA qué has ejecutado y qué resultado dieron las comprobaciones ("He ejecutado 001 y 002 y las pruebas M4 salen bien").

## 2. Calendario

| Cuándo                            | Qué haces tú              |
| --------------------------------- | ------------------------- |
| Mientras la IA hace T0 a T5       | M1, M2                    |
| Tras T6 (la IA entrega 001 y 002) | M3, M4, M5                |
| T7                                | M6 (entera manual)        |
| Tras T8 (la IA entrega 003)       | M7, M8                    |
| T9                                | M9                        |
| Tras T17b                         | M10 (opcional), M11       |
| T22                               | M12                       |
| Siempre                           | Sección 5 (mantenimiento) |

## 3. Pasos

### M1. Crear el proyecto

1. Entra en supabase.com, inicia sesión y pulsa **New project**.
2. Nombre `multas-crg`, plan **Free**, región de Europa lo más cercana a Madrid (por ejemplo Frankfurt).
3. Genera una contraseña de base de datos fuerte y guárdala en tu gestor de contraseñas. La app no la usa.
4. Si el asistente ofrece "Automatically expose new tables" o "Automatically enable RLS", da igual cómo queden: nuestros scripts fijan los permisos de forma explícita.
5. Espera uno o dos minutos.

_Hecho cuando:_ el panel del proyecto abre y el Table Editor está vacío.

### M2. Copiar las claves

1. En el proyecto, pulsa **Connect** o ve a **Settings > API Keys**. Si no existe clave publicable, pulsa **Create new API Keys**.
2. Copia solo la **Project URL** y la **publishable key** (`sb_publishable_...`).
3. Crea `.env.local` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
```

4. Comprueba que `.env.local` está en `.gitignore` antes de hacer commit. Donde publiques la app tendrás que definir estas mismas dos variables.

_Hecho cuando:_ `git status` no muestra `.env.local`.

### M3. Ejecutar tablas y permisos (001 y 002)

1. Antes de ejecutar, revisa los scripts con los puntos 1 a 4 de la sección 4.
2. En el panel, abre **SQL Editor > New query**, pega `001_tablas.sql` y pulsa **Run**.
3. Repite con `002_permisos.sql`.
4. Si hay un error, mira en el Table Editor qué se creó antes de volver a ejecutar, y pásale a la IA el mensaje completo para que te dé un script corregido.

### M4. Comprobar permisos

1. En **Table Editor** deben verse 5 tablas (`temporadas`, `jugadoras`, `multas`, `gastos_hucha`, `staff`), todas con RLS activado.
2. En el SQL Editor, ejecuta:

```sql
set role anon;
select count(*) from public.temporadas;        -- debe funcionar
select count(*) from public.staff;             -- debe dar "permission denied"
insert into public.jugadoras (nombre, dorsal) values ('x', 99);  -- debe fallar
reset role;
```

_Hecho cuando:_ la primera consulta funciona y las otras dos fallan.

### M5. Crear la temporada

```sql
insert into public.temporadas (nombre, activa, hucha_inicial)
values ('2026/27', true, 0);   -- sustituye 0 por lo que lleváis acumulado
```

_Hecho cuando:_ `select * from public.temporadas;` muestra una fila activa.

### M6. Dar de alta a los entrenadores (T7)

Para cada entrenador:

```sql
insert into public.staff (usuario, pin_hash)
values ('nombre', extensions.crypt('4821', extensions.gen_salt('bf')));
```

- Usuario en minúsculas y sin espacios. Cada entrenador elige su PIN de 4 dígitos (nada de 1234 ni fechas de cumpleaños).
- El SQL Editor guarda historial de consultas: bórralas de la lista tras ejecutarlas, porque contienen el PIN en claro.
- Nunca guardes PIN en el repo ni los pegues en el chat con la IA.

_Hecho cuando:_ `select usuario, left(pin_hash, 7) from public.staff;` muestra los usuarios y un hash que empieza por `$2`.

### M7. Ejecutar las funciones (003)

1. Revisa `003_funciones.sql` con los puntos 3 a 10 de la sección 4.
2. Ejecútalo en el SQL Editor como en M3.

### M8. Pruebas de seguridad

Crea antes un entrenador de prueba y una jugadora de prueba:

```sql
insert into public.staff (usuario, pin_hash)
values ('prueba', extensions.crypt('4821', extensions.gen_salt('bf')));
insert into public.jugadoras (nombre, dorsal) values ('Prueba', 99) returning id;
```

Anota el `id` de la jugadora como `<JUGADORA_ID>`. Ejecuta cada bloque por separado (selecciona el texto y pulsa Run).

**Prueba 1: PIN incorrecto no escribe nada**

```sql
set role anon;
select public.registrar_multa('prueba', '0000', '<JUGADORA_ID>', 'ent_tarde', 2, 1, 1, current_date, null, false);
reset role;
select count(*) from public.multas;   -- 0
```

Esperado: respuesta `ok: false` con mensaje genérico, y 0 multas.

**Prueba 2: PIN correcto**

```sql
set role anon;
select public.registrar_multa('prueba', '4821', '<JUGADORA_ID>', 'ent_tarde', 2, 1, 1, current_date, 'prueba', false);
reset role;
select id, estado, importe, registrada_por from public.multas;   -- pendiente, 2, prueba
```

Anota el `id` como `<MULTA_ID>`.

**Prueba 3: bloqueo por intentos**

```sql
set role anon;
select public.login_staff('prueba', '0000') from generate_series(1, 5);
select public.login_staff('prueba', '4821');   -- debe rechazar aunque el PIN sea correcto
reset role;
select intentos_fallidos, bloqueado_hasta from public.staff where usuario = 'prueba';  -- 5 y una hora futura
update public.staff set intentos_fallidos = 0, bloqueado_hasta = null where usuario = 'prueba';
```

**Prueba 4: escalón único**

```sql
set role anon;
select public.registrar_multa('prueba', '4821', '<JUGADORA_ID>', 'esc_3', 4, 1, 1, current_date, null, false);
select public.registrar_multa('prueba', '4821', '<JUGADORA_ID>', 'esc_3', 4, 1, 1, current_date, null, false);
reset role;
```

Esperado: la segunda se rechaza.

**Prueba 5: declarar pago (sin PIN)**

```sql
set role anon;
select public.declarar_pago('<MULTA_ID>');   -- pasa a pago_declarado
select public.declarar_pago('<MULTA_ID>');   -- segunda vez: no cambia nada
reset role;
select estado, declarada_en from public.multas where id = '<MULTA_ID>';
```

**Prueba 6: verificar pago**

```sql
set role anon;
select public.verificar_pago('prueba', '4821', '<MULTA_ID>', false, null);            -- rechaza: vuelve a pendiente
select public.declarar_pago('<MULTA_ID>');
select public.verificar_pago('prueba', '4821', '<MULTA_ID>', true, current_date);     -- acepta: pagada
reset role;
select estado, fecha_pago, cobrada_por from public.multas where id = '<MULTA_ID>';
```

**Prueba 7: escritura directa bloqueada**

```sql
set role anon;
update public.multas set estado = 'pagada';   -- debe fallar
select * from public.staff;                    -- debe fallar
reset role;
```

**Limpieza**

```sql
delete from public.multas where jugadora_id = '<JUGADORA_ID>';
delete from public.jugadoras where id = '<JUGADORA_ID>';
delete from public.staff where usuario = 'prueba';
```

_Hecho cuando:_ las siete pruebas dan lo esperado. Si alguna falla, pasa a la IA el resultado y pídele un script 004 de corrección.

### M9. Conectar la app (T9)

1. Con `.env.local` de M2, arranca la app (`npm run dev`).
2. Abre la consola del navegador: deben aparecer la temporada activa y las jugadoras.
3. Si ves el error `42501 permission denied`, falta un permiso: pide a la IA un script nuevo. Si ves `401` o "invalid API key", la clave está mal copiada.

### M10. Tiempo real instantáneo (opcional)

Por defecto, los datos se refrescan al abrir la app, al volver a la pestaña y cada minuto. Si prefieres que la insignia del entrenador se actualice al instante, ejecuta:

```sql
alter publication supabase_realtime add table public.multas;
```

y pide a la IA que añada la suscripción en el cliente (T17b).

### M11. Prueba con dos móviles (tras T17b)

1. Móvil A (entrenador): entra con usuario y PIN, registra una multa a una jugadora.
2. Móvil B (jugadora, sin login): busca el nombre, abre la multa y pulsa "Ya he pagado".
3. Móvil A: la insignia pasa a 1 y la multa aparece en "Pendientes de verificar". Pulsa Aceptar.
4. Móvil B: la multa aparece en pagadas. Repite rechazando.

### M12. Cargar los datos reales (T22)

1. **Jugadoras:** en Table Editor, abre `jugadoras` > **Insert** > **Import data from CSV** con las columnas `nombre,dorsal,capitana,activa`. Los dorsales no se pueden repetir entre jugadoras activas.
2. **Hucha inicial:** si ya existe la temporada, ajústala con "Editar importe inicial" desde la app.
3. **Multas en curso:** regístralas desde el panel del entrenador, no por SQL, para que se apliquen el x2 de las capitanas, el contador de faltas y los escalones.
4. Cuando carguen los datos, revisad 5 saldos al azar.

## 4. Requisitos de seguridad del SQL (para la IA y para tu revisión)

1. RLS activado en las 5 tablas. Lectura pública (`using (true)`) solo en `temporadas`, `jugadoras`, `multas` y `gastos_hucha`. `staff` no tiene ninguna política.
2. Permisos explícitos: `revoke all` de las 5 tablas a `anon` y `authenticated`, y después `grant select` solo de las 4 públicas a `anon`.
3. Las funciones son `security definer` con `set search_path = public, extensions`. Se hace `revoke all ... from public, anon, authenticated` y `grant execute ... to anon` en las nueve.
4. `create extension if not exists pgcrypto with schema extensions;` y llamadas a `extensions.crypt` y `extensions.gen_salt('bf')`.
5. Un PIN incorrecto **no lanza excepción**: devuelve `{"ok": false, "error": "No autorizado"}`. Si lanzara excepción, la transacción se desharía y el contador de intentos nunca subiría.
6. Bloqueo: 5 fallos fijan `bloqueado_hasta = now() + 1 minuto`. Mientras dura, se rechaza incluso el PIN correcto. Un acierto reinicia el contador.
7. Solo puede haber una temporada activa (índice único parcial). `registrar_multa` usa la temporada activa y `crear_temporada` desactiva la anterior en la misma operación.
8. `declarar_pago` no pide PIN, solo actúa si el estado es `pendiente` y no devuelve datos sensibles.
9. `verificar_pago` solo actúa sobre `pago_declarado` y bloquea la fila mientras opera.
10. Ninguna función ni vista devuelve `pin_hash`.
11. Cada script lleva un comentario inicial con qué hace y es repetible donde sea posible.

## 5. Mantenimiento

**Cambiar un PIN o desbloquear a un entrenador**

```sql
update public.staff
set pin_hash = extensions.crypt('nuevo', extensions.gen_salt('bf')),
    intentos_fallidos = 0, bloqueado_hasta = null
where usuario = 'nombre';
```

**Desbloquear sin cambiar el PIN**

```sql
update public.staff set intentos_fallidos = 0, bloqueado_hasta = null where usuario = 'nombre';
```

**Dar de baja a un entrenador**

```sql
delete from public.staff where usuario = 'nombre';
```

**Dar de baja a una jugadora** (no se borra, para conservar su historial)

```sql
update public.jugadoras set activa = false where dorsal = 7 and activa;
```

**Pausa por inactividad**

- Supabase avisa por correo antes de pausar el proyecto. Si se pausa, se reanuda desde el panel con **Resume project**.
- Lo normal es que la app tenga uso diario. En periodos sin actividad (verano), abre el panel de Supabase o la app al menos una vez a la semana. Si queréis evitarlo del todo, pasar a un plan de pago o añadir más adelante una tarea de ping programado.

**Copias de seguridad**

- Revisa en **Database > Backups** qué incluye tu plan. Por si acaso, al acabar cada temporada exporta cada tabla a CSV desde el Table Editor (menú de exportación de la tabla) y guarda los archivos.

**Problemas frecuentes**

- `permission denied for table ...`: falta un GRANT. Pide a la IA un script nuevo.
- `401` o "invalid API key": la clave de `.env.local` está mal copiada o es la secreta.
- La app muestra datos viejos: espera al refresco de 1 minuto o recarga.
- Las jugadoras no ven nada: puede que el proyecto esté pausado.
