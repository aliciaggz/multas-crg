# Plan técnico de la spec 002

La [spec 002](spec.md) define el alcance de esta entrega. La [spec 001](../001-multas/spec.md) sigue siendo la referencia de importes y reglas. El [diseño](design.md) describe los recorridos y [las tareas](task.md) fijan el orden de implementación y comprobación.

## Arquitectura

Se mantienen Lit, Vite, TypeScript, Vitest, la PWA y Supabase. El cliente sigue configurándose con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Se reutilizan los componentes y las reglas actuales.

| Área | Archivos de partida | Cambio previsto |
| --- | --- | --- |
| Perfiles, rutas y navegación | `crg-app.ts`, `crg-header.ts`, `crg-acceso.ts` | Separar la vista elegida de la autorización. Incorporar la elección inicial y las dos variantes de Inicio. |
| Acceso persistente | `src/lib/acceso-staff.ts`, `src/lib/supabase.ts`, SQL nuevo | Emitir, restaurar y revocar sesiones en el servidor. Pasar la credencial de sesión a las operaciones protegidas. |
| Destinatarios | `src/data/temporadas-demo.ts`, `src/lib/registro-multas.ts`, `src/lib/reglas.ts`, `src/lib/supabase.ts`, SQL nuevo | Dar de alta al cuerpo técnico y compartir las reglas de registro, escalones, saldos y pagos. |
| Pantallas de multas | `crg-jugadoras.ts`, `crg-detalle.ts`, `crg-nueva-sancion.ts`, `crg-pagos-pendientes.ts`, `crg-catalogo.ts` | Mostrar fichas y destinatarios, estados vacíos y orden por dorsal o importe. |
| Confirmaciones y conexión | `crg-app.ts`, componentes con operaciones de escritura, `src/lib/datos-guardados.ts` | Usar un diálogo común y guardar la fecha de cada copia pública por temporada. |

## Elección de vista y sesión

- Guardar la última vista en una clave local de preferencia independiente de la sesión. Tratarla como una indicación de navegación. Preservar la ruta pública solicitada en la primera visita y recuperar la ruta protegida después del PIN si procede. Mantener las rutas `#jugadora/…` y las de gestión existentes. `#jugadoras` abre la plantilla de Inicio y `#staff` abre el acceso o Inicio de Entrenadores.
- Reutilizar el menú de cabecera en ambas vistas. En la vista pública, «Jugadoras» abre «Acceder como entrenador». El formulario permite cancelar antes de autenticar. Dentro del área autenticada, «Coaches» abre el menú de cuenta. Enrutar la salida a Inicio de Jugadoras a través de «Cerrar sesión». Aplicar primero el cierre que limpia la sesión en memoria y añadir la revocación de la sesión de ese navegador al integrar el acceso persistente.
- La nueva función de acceso recibe solo el PIN. Identifica una única cuenta interna, comparando el PIN con los hashes en el servidor. Reutilizar las cuentas de Jaime, Nacho y Guada para conservar su identidad de auditoría. El alta y los cambios de PIN comprueban que ningún otro entrenador tenga ese PIN. Si por datos antiguos coinciden varias cuentas, se rechaza el acceso con el mismo mensaje genérico que para un PIN incorrecto. Tras validar el PIN, el servidor emite un token opaco aleatorio ligado a la cuenta. El cliente persiste el token en una clave local separada, acotada al proyecto y al navegador o instalación. El PIN solo se usa en el acceso y queda fuera del almacenamiento. Mantener token y PIN fuera de URL, registros, caché de la PWA y mensajes.
- Limitar los intentos antes de resolver la cuenta. Aplicar en el servidor una espera de un minuto tras cinco fallos de acceso por PIN, también si se cambia de navegador, y devolver un mensaje genérico. Este bloqueo de nuevos accesos es común para Coaches. Las sesiones ya válidas pueden seguir gestionando.
- La tabla privada de sesiones guarda el hash del token, la referencia a la cuenta y las fechas de creación y revocación. Cada operación protegida valida la sesión en el servidor y toma la identidad de auditoría de la cuenta asociada. La invalidación de una cuenta o el cambio de su PIN debe revocar sus sesiones. Al cerrar sesión se confirma la revocación, se limpia la credencial local, se guarda Jugadoras como vista y se abre su Inicio. Si falla la conexión, bloquear las acciones protegidas en esa vista y ofrecer reintentar el cierre, indicando que la revocación aún no está confirmada.
- Al reabrir, validar la sesión antes de habilitar gestión. Una respuesta de sesión inválida limpia el token. Un fallo de conexión conserva la credencial y permite leer la copia pública. Las pestañas del mismo navegador reaccionan al cierre de sesión local y el servidor sigue rechazando operaciones con un token revocado.
- Introducir las funciones de sesión junto a las firmas actuales durante la transición. Coordinar la publicación del cliente nuevo y un script de corte que retire el acceso a las antiguas firmas de escritura con usuario y PIN. Incluir una prueba que demuestre que las firmas antiguas quedan cerradas y que la declaración pública sigue disponible.

## Destinatarios de multas

- Añadir una tabla pública de cuerpo técnico con ID estable, nombre visible y estado de actividad, separada de la tabla privada `staff`. Un script repetible da de alta a Jaime, Nacho y Guada como destinatarios. El dorsal sigue siendo un dato de las jugadoras.
- Conservar la referencia existente `jugadora_id` y añadir una referencia nullable `tecnico_id` a las multas. Una restricción exige exactamente un destinatario válido. Conservar las multas anteriores y su identidad. Añadir al cuerpo técnico la misma protección de unicidad de escalón vigente por temporada y destinatario.
- Representar en TypeScript los dos tipos de destinatario de forma explícita. Adaptar lectura de Supabase, copia pública, fichas, pagos por verificar y movimientos de hucha para resolver ambos tipos. Reutilizar la ficha existente y los cálculos de saldo, asistencia, hucha y vencimiento. La ficha del entrenador identifica a la persona por su nombre.
- El servidor resuelve el destinatario activo, calcula el precio y el ×2 cuando corresponda y mantiene la trazabilidad. Extender al cuerpo técnico el bloqueo que serializa las altas de escalones. Aplicar el mismo flujo de pago y anulación a ambas clases de multa. Particularmente, las operaciones sobre una multa existente usan su ID y respetan su estado y su temporada.
- El cliente muestra la vista previa con las mismas reglas. Conservar el ajuste manual, las multas de 0 €, los importes por prenda y el incremento por vencimiento de la spec 001. Escribir primero los tests de reglas y confirmar el fallo antes de implementar.

## Orden, conexión y operaciones

- Ordenar copias de las listas por el importe numérico que las genera. Separar primero por los grupos o estados ya visibles. Mantener el orden previo en empates. Usar el importe vigente de una multa vencida y el importe abonado de una pagada. En «Nueva multa», ordenar por la primera tarifa visible de los conceptos con varias y colocar el ajuste manual al final.
- Guardar un sello de lectura correcta junto a los datos públicos de cada temporada. Actualizarlo al completar una lectura remota correcta. Admitir copias anteriores sin sello. Mostrar la hora de los datos visibles en horario de Madrid y retirar el aviso tras recargarlos correctamente.
- Centralizar los estados de escritura en un diálogo Lit compartido. Distinguir un rechazo confirmado de una respuesta incierta, incluso si falla la recarga posterior a un éxito del servidor. Guardar el contexto durante los reintentos y bloquear envíos concurrentes. Si se desconoce el resultado, ofrecer una lectura actualizada del detalle o de la sección afectada y habilitar el reenvío solo tras comprobar el resultado o contar con garantía de que no duplicará la operación.
- Mantener la confirmación de escalón como una decisión posterior al registro. Usar la lista actual para verificar pagos.

## Supabase y puesta en marcha

Los scripts nuevos van en `supabase/sql/`, numerados a partir del siguiente número disponible. Las pruebas transaccionales van en `supabase/sql/pruebas/`. Los scripts ya aplicados quedan como referencia. Cumplir la [sección 4 del manual](../001-multas/supabase/supabase-manual.md#4-requisitos-de-seguridad-del-sql-para-la-ia-y-para-tu-revisión). Activar RLS, conceder permisos expresos sobre la lectura pública y sobre las funciones necesarias, y mantener privadas las cuentas, las sesiones y los hashes. Las funciones de escritura conservan la validación de permisos, trazabilidad y bloqueos.

El usuario revisa y ejecuta cada script desde Supabase y confirma el resultado antes de integrar el cliente que lo requiere. Se verifica la base en una transacción de prueba con reversión. En el corte, comprobar con la app actualizada y una pestaña antigua el comportamiento de ambas rutas de acceso.
