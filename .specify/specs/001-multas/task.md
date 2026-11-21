# Tareas: Multas CR Guindalera

Orden: cada tarea depende de las anteriores salvo que se indique. Una tarea por sesión con la IA. En las tareas de reglas: tests primero, luego código, luego revisión humana del diff.

## Fase 0: Preparación

### T0. Repositorio y esqueleto

- Crear repo `multas-crg` con Vite + Lit + TypeScript.
- Copiar `constitution.md`, `spec.md`, `plan.md` a sus carpetas.
- **Hecho cuando:** `npm run dev` muestra "Multas CRG" y se ve bien en un móvil (DevTools, 375 px).

## Fase 1: Reglas de negocio (sin base de datos)

### T1. Catálogo fijo

- Crear `src/data/catalogo.json` con todos los conceptos del PDF: id, grupo, nombre, importe, tipo (fijo, por_prenda, escalon, tardanza).
- **Hecho cuando:** hay un test que comprueba que cada importe coincide con la spec.

### T2. Llegada tarde a partidos

- `calcularTardanzaPartido(minutos)`: 0–5 min → 0 €; 6–19 min → 3 €; 20 min o más → 7 € (sustituye, no suma).
- Escribir los tests antes: casos 0, 5, 6, 19, 20 y 45 minutos.
- **Hecho cuando:** todos los tests pasan. Llegar a las 15:05 para una convocatoria de las 15:00 da 0 €.

**T3. Contador y escalones.** `contarFaltas(multas)` (solo conceptos con `cuenta_asistencia`, sin anuladas) y `escalonesPendientes(faltas, registrados)` (propone la diferencia hasta el total del escalón más alto alcanzado). _Hecho cuando:_ tests para 0, 2, 3, 4, 6, 7, 9 y 12 faltas, con y sin escalones registrados. Si se llega a 9 sin ninguno registrado, la única propuesta es de 8 €.

**T4. Importes, vencimiento y estados.** `importeRegistro` (x cantidad, x2 capitana), `estaVencida`, `estadoMulta` e `importeActual` (duplica si vencida). _Hecho cuando:_ tests para pendiente a 14, 15 y 16 días; multa pagada; capitana vencida (x4); pago declarado a los 14 días y evaluado a los 20 (no vencida); pago declarado a los 16 días (vencida); pago rechazado evaluado a los 20 días (vencida).

### T5. Saldos y hucha

- `saldoJugadora(multas, hoy)`: suma de multas pendientes y de pagos por verificar con su importe actual.
- `saldoHucha(hucha_inicial, movimientos)`: inicial + suma de movimientos.
- **Hecho cuando:** tests con varios casos mezclados (pagadas, vencidas, pendientes, movimientos negativos).

## Fase 2: Base de datos y seguridad

### T6. Migración inicial

- Crear `supabase/migrations/001_init.sql` con las tablas del plan.
- Activar RLS en todas las tablas. Lectura pública en temporadas, jugadoras, multas y movimientos. Staff sin acceso público.
- Insertar la temporada 2026/27 como activa.
- **Hecho cuando:** desde el cliente anónimo se pueden leer las tablas públicas y no se puede escribir ni leer `staff`.

**T6. Tablas y permisos.** _IA:_ `supabase/sql/001_tablas.sql` y `002_permisos.sql`. _Tú:_ M1, M2, M3, M4, M5. _Hecho cuando:_ las pruebas de M4 dan lo esperado y hay una temporada activa.

### T7. Usuarios staff

- Función SQL para crear un usuario de staff con PIN hasheado (`crypt`, `gen_salt('bf')`).
- Insertar los usuarios del cuerpo técnico y capitanas directamente en Supabase (nunca en el repo).
- **Hecho cuando:** `staff` contiene solo hashes y no es legible desde la API pública.

**T7. Entrenadores.** _Tú:_ M6 (entera manual, nada que escribir para la IA). _Hecho cuando:_ `staff` contiene solo hashes.

### T8. Funciones de escritura

- `registrar_multa`, `marcar_pagada`, `movimiento_hucha`, `crear_temporada`, todas `security definer`.
- Cada función: verifica usuario y PIN, copia el importe desde el catálogo (no lo acepta del cliente), y devuelve error genérico si el PIN no es válido.
- **Hecho cuando:** probado desde SQL que con PIN incorrecto no escribe nada, con PIN correcto sí, y el importe no se puede falsificar.

**T8. Funciones.** _IA:_ `003_funciones.sql` con las nueve funciones. _Tú:_ M7 y M8. _Hecho cuando:_ las siete pruebas de M8 dan lo esperado.

### T9. Cliente Supabase

- `src/lib/supabase.ts` con la URL y la clave anónima desde variables `VITE_*`.
- Funciones de lectura: temporadas, jugadoras, multas, movimientos de hucha de una temporada.
- **Hecho cuando:** la app muestra en consola los datos reales de la temporada activa.

**T9. Cliente Supabase.** _IA:_ `supabase.ts`, lecturas de temporadas, jugadoras, multas y gastos, y refresco cada minuto y al volver a la pestaña. _Tú:_ M9. _Hecho cuando:_ la consola muestra los datos de la temporada activa.

## Pasos manuales en otras fases

- Tras T17b: **M11**, prueba con dos móviles. M10 (Realtime) es opcional.
- En T22: **M12**, carga de jugadoras, hucha inicial y multas en curso.

## Fase 3: Interfaz pública (sin login)

### T10. Cabecera y selector de temporada

- Muestra el nombre del club y la temporada activa. Selector para cambiar de temporada.
- **Hecho cuando:** al cambiar de temporada cambian los datos mostrados.

### T11. Buscar jugadora (HU-1)

- Lista de jugadoras con búsqueda por nombre. Cada fila muestra saldo pendiente.
- **Hecho cuando:** buscar "Ana" filtra en tiempo real y la lista funciona con el móvil en modo avión tras la primera carga (T18).

### T12. Detalle de jugadora (HU-1)

- Saldo pendiente destacado, multas pendientes con días restantes o aviso de vencida, historial de pagadas y contador de faltas hacia el siguiente escalón.
- **Hecho cuando:** los importes coinciden con los tests de T4 y T5 para datos de prueba.

### T13. Catálogo (HU-2)

- Lista de conceptos agrupados en Entrenos y Partidos, con importe.
- **Hecho cuando:** coincide con `catalogo.json` y con la tabla de la spec.

### T14. Hucha (HU-6)

- Importe total de la temporada. Historial de movimientos sin nombres de jugadoras si se decide ocultarlos.
- **Hecho cuando:** el total coincide con T5.

## Fase 4: Panel entrenador

**T15. Acceso (HU-5).** Usuario y teclado de PIN; mensajes de error y de bloqueo. _Hecho cuando:_ PIN incorrecto no desbloquea nada y tras 5 fallos hay espera de 1 minuto.
**T16. Registrar multa (HU-3).** Jugadora, concepto, cantidad, minutos si es tardanza a partido, fecha, observación, "Pagar ahora", ajuste manual con importe y motivo, y aviso de escalón al alcanzarlo. _Hecho cuando:_ la multa aparece en el saldo y el importe de una capitana sale con x2.
**T17. Cobrar y anular (HU-4, HU-9).** Marcar como pagada con fecha y anular con motivo. _Hecho cuando:_ el saldo y la convocabilidad se actualizan.
**T17b. Pendientes de verificar (HU-11).** Insignia con contador en el botón Staff, pantalla "Pendientes de verificar" con Aceptar (fecha de pago) y Rechazar, y refresco cada minuto. _Hecho cuando:_ una declaración desde otro móvil aparece en la lista; aceptar la pasa a Pagada y suma a la hucha; rechazar la devuelve a Pendiente.
**T18. Gastos, hucha inicial y temporadas (HU-7, HU-8).** _Hecho cuando:_ un gasto sin motivo se rechaza y una temporada nueva propone el saldo final de la anterior.

## Fase 5: PWA y calidad

**T19. PWA.** Manifest, iconos del escudo, service worker, aviso "Mostrando datos guardados" sin conexión. _Hecho cuando:_ se instala en Android e iOS y se consulta en modo avión.
**T20. Rendimiento y accesibilidad.** JS inicial por debajo de 150 KB comprimido, botones de 44 px, contraste AA. _Hecho cuando:_ Lighthouse supera 90 en rendimiento, PWA y accesibilidad.
**T21. Despliegue.** Netlify con variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y README (cómo crear temporada, cambiar catálogo y dar de alta entrenadores). _Hecho cuando:_ el enlace público y el panel funcionan en el móvil.
**T22. Carga de datos reales.** Jugadoras (nombre y dorsal), capitanas marcadas y multas en curso. _Hecho cuando:_ los entrenadores comprueban 5 saldos al azar.

## Fase 6: Después de la v1

**T23. Notificaciones push a entrenadores.** Service worker con push, tabla `push_suscripciones`, claves VAPID y Edge Function disparada al pasar una multa a `pago_declarado`. _Hecho cuando:_ un entrenador con la PWA instalada recibe el aviso con la app cerrada.

## Dependencias (sustituye la línea anterior)

T0 → T1 → T2–T5 → (M1, M2) → T6 (M3–M5) → T7 (M6) → T8 (M7, M8) → T9 (M9) → T10–T14 (con T12b tras T12) → T15 → T16–T18 (con T17b tras T17, luego M11) → T19 → T20 → T21 → T22 (M12) → T23
