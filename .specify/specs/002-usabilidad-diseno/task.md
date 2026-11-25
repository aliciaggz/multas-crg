# Tareas de la spec 002

Ejecutar una tarea por sesión. Antes de editar, mostrar los archivos previstos. Al cerrar, mostrar el diff, indicar las pruebas y describir la comprobación manual. Para las reglas de negocio, escribir y ejecutar primero los tests y confirmar que fallan antes de cambiar la implementación. La numeración de los criterios remite a [spec.md](spec.md#criterios-de-aceptación).

## Navegación y consulta pública

- [x] **T002-01. Elección inicial y navegación.** Añadir la preferencia local, la modal y el selector. Ocultar el acceso duplicado a la plantilla conservando el código, mantener enlaces antiguos y separar el modo público de la vista de gestión con el acceso actual. **Hecho cuando** la elección se recuerda, un enlace a una ficha conserva su destino y la vista pública muestra solo acciones públicas. Criterios 1, 2 y 6.
- [x] **T002-02. Inicios y accesos de entrenadores.** Aplicar azul marino y granate a la tarjeta según la vista y mostrar los cuatro accesos. Mantener visible el contador de la temporada seleccionada, incluido cero, y la vuelta a Inicio desde cada acción. **Hecho cuando** funcionan también el acceso a revisión y el aviso al elegir una temporada previa. Depende de T002-01. Criterios 5, 7 y 16.
- [x] **T002-03. Plantilla, filtros y dorsal.** Añadir el control subrayado, los tres mensajes de lista vacía y la conservación de búsqueda y filtro al volver de una ficha. **Hecho cuando** el orden numérico respeta el filtro y la consulta activa y las tres causas de vacío son distinguibles. Depende de T002-01. Criterios 6, 14 y 15.
- [x] **T002-04. Fecha de la copia pública.** Guardar un sello por temporada y mostrar el aviso con fecha u opción genérica para copias antiguas. **Hecho cuando** dos temporadas con copias distintas muestran su propia fecha en modo avión y se retira el aviso tras una lectura correcta. Criterio 8.

- [x] **T002-01a. Ajustar entrada y salida de Entrenadores.** Sustituir el selector por un menú común en cabecera. «Jugadoras» abre «Acceder como entrenador» y «Coaches» abre «Cerrar sesión» en la vista autenticada. Mantener «Volver a Jugadoras» durante el acceso. Al cerrar la sesión actual en memoria, abrir Inicio de Jugadoras y recordar esa vista. **Hecho cuando** se puede salir desde cualquier pantalla autenticada mediante «Cerrar sesión» y volver a gestión exige el PIN. Depende de T002-01. Criterios 2 a 4.

## Sesión de entrenador

- [x] **T002-05. Funciones SQL de sesión.** Preparar scripts numerados de ampliación y corte. Añadir sesión privada, identificación por PIN individual, validación, revocación y firmas protegidas de transición. Preparar pruebas de PIN distintos y duplicados, límite de intentos antes de identificar la cuenta, autoría en escrituras, revocación de una sola sesión y conservación de la declaración pública. **Paso manual** ejecutar solo la ampliación y sus pruebas, comprobar que las tres cuentas tienen PIN distintos y confirmar el resultado. Configurar los PIN en Supabase sin compartirlos en el chat ni guardarlos en el repositorio. La ejecución del corte pertenece a T002-11. Criterios 2 a 4.
- [x] **T002-06. Sesión persistente en el cliente.** Quitar «Usuario» del formulario y enviar solo el PIN al acceso nuevo. Integrar la validación al reabrir y la revocación al cerrar sesión desde el menú de cuenta. Mantener la preferencia separada de la credencial. **Hecho cuando** una recarga recupera una sesión válida, el cierre revoca el acceso y una sesión inválida vuelve a pedir PIN al gestionar. **Paso manual** probar desde navegador y PWA instalada, incluyendo cierre en otra pestaña y fallo de conexión al cerrar. Depende de T002-01a y la confirmación manual de T002-05. Criterios 3 y 4.

### Aplicación manual de T002-05

1. En el SQL Editor de Supabase, ejecutar [005_sesiones_entrenadores.sql](../../../supabase/sql/005_sesiones_entrenadores.sql).
2. En otra consulta, ejecutar [pruebas/005_sesiones_entrenadores.sql](../../../supabase/sql/pruebas/005_sesiones_entrenadores.sql). Debe devolver «T002-05: sesiones, autoría, permisos y bloqueo comprobados». La prueba usa datos temporales y hace rollback. Ante un error, ejecutar `rollback;` en esa conexión si la transacción sigue abierta y comunicar el error sin credenciales.
3. Confirmar que Jaime, Nacho y Guada tienen PIN distintos de cuatro dígitos. Si hay que cambiar alguno, en el SQL Editor ejecutar `select crg_privado.configurar_pin('cuenta_existente', 'nuevo_pin');` con los valores reales sustituidos localmente. Esta función devuelve si el cambio se pudo aplicar y revoca las sesiones de esa cuenta al cambiar el PIN. Seguir la [guía manual](../001-multas/supabase/supabase-manual.md) respecto al historial del editor.
4. Tras confirmar ambas ejecuciones y los PIN distintos, empezar T002-06. [099_corte_acceso_legacy.sql](../../../supabase/sql/099_corte_acceso_legacy.sql) y [su prueba](../../../supabase/sql/pruebas/099_corte_acceso_legacy.sql) quedan para T002-11, después de publicar y comprobar el cliente nuevo.

## Cuerpo técnico y multas

- [x] **T002-07. Destinatarios en Supabase.** Añadir cuerpo técnico, referencia de multa, restricciones, registro y carga repetible de Jaime, Nacho y Guada. Escribir primero pruebas transaccionales para el ×2, una excepción de ajuste manual, escalones por destinatario, vencimiento, transiciones de pago y separación de temporadas. **Paso manual** confirmar el fallo previsto antes de la implementación y ejecutar después el script y las pruebas en el orden indicado. **Hecho cuando** se confirma el resultado y la lectura de multas anteriores sigue disponible. Depende de T002-05. Criterios 13 y 16.
- [x] **T002-08. Fichas, formulario y pagos del cuerpo técnico.** Leer y conservar los dos tipos de destinatario. Adaptar bloque público, fichas, formulario, lista de revisión y Hucha. Confirmar que ambas clases usan la misma lógica y que el servidor autoriza las escrituras. **Hecho cuando** se registra una multa ×2 a un entrenador, se declara su pago desde la ficha y se verifica desde la lista habitual. Depende de T002-02, T002-04, T002-06 y de la confirmación manual de T002-07. Criterios 1, 13 y 16.
- [x] **T002-09. Orden por importe.** Aplicar orden ascendente al Catálogo, conceptos del formulario, fichas y pagos por verificar. **Hecho cuando** se respeta el importe mostrado, incluidos vencidas, pagadas, conceptos con varias tarifas, empates y ajuste manual. Depende de T002-08. Criterio 14.

### Aplicación manual de T002-07

1. Después de confirmar 005, ejecutar [006_cuerpo_tecnico.sql](../../../supabase/sql/006_cuerpo_tecnico.sql) en el SQL Editor de Supabase.
2. En otra consulta, ejecutar [pruebas/006_cuerpo_tecnico.sql](../../../supabase/sql/pruebas/006_cuerpo_tecnico.sql). Debe devolver «T002-07: destinatarios, escalones, cobros y temporadas comprobados». Los datos temporales se revierten al terminar. Ante un error, ejecutar `rollback;` en esa conexión si la transacción sigue abierta.
3. Confirmar que `cuerpo_tecnico` muestra a Jaime, Nacho y Guada y que las multas anteriores siguen disponibles. La prueba ya se ejecutó en local antes de la migración y falló por la ausencia de la tabla. En Supabase se ejecuta después de aplicar 006. Con la confirmación se puede empezar T002-08.

## Feedback y entrega

- [x] **T002-10. Modales de operación.** Crear el diálogo común y conectar el registro, declaración, revisión, cobro, anulación, hucha y temporada. Mantener el contexto, distinguir fallo confirmado de resultado incierto y mostrar el aviso al tercer fallo. **Hecho cuando** se comprueban carga, éxito, fallo, tercer fallo, pérdida de respuesta y confirmación de escalón, con foco y teclado. Depende de T002-08. Criterios 9 a 12 y 16.
- [ ] **T002-11. Verificación y corte de acceso.** Ejecutar `npm test` y `npm run build`. Comprobar los criterios de la spec a 375 px, con teclado, lector de pantalla y PWA instalada, incluido el presupuesto de 150 KB de JS comprimido de la constitución. **Paso manual** confirmar el cliente nuevo, ejecutar el script de corte revisado y sus pruebas, y comprobar que la versión nueva permite gestionar, la firma anterior rechaza escrituras y la declaración pública sigue funcionando. Depende de T002-03, T002-04, T002-06, T002-09 y T002-10.

### Cierre manual de T002-11

1. Publicar la compilación del cliente nuevo. En el móvil, abrir la versión publicada e instalada, entrar con el PIN y comprobar una gestión y la consulta sin conexión. Revisar también que el diálogo anuncia su estado con el lector de pantalla del dispositivo.
2. Tras comprobar el cliente, ejecutar [099_corte_acceso_legacy.sql](../../../supabase/sql/099_corte_acceso_legacy.sql), seguido de [su prueba transaccional](../../../supabase/sql/pruebas/099_corte_acceso_legacy.sql). El resultado esperado es «T002-11: corte comprobado, escritura por sesión y declaración pública operativas».
3. Confirmar que el cliente publicado permite gestionar y que la prueba del corte confirma que las firmas anteriores han perdido el permiso de escritura.

Las ejecuciones de SQL y la publicación del cliente se coordinan por separado. Los resultados de las pruebas y los pasos confirmados se registran al completar cada tarea.
