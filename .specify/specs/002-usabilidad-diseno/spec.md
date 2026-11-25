# Spec 002: Usabilidad y diseño

## Estado y propósito

Borrador consolidado para revisión. Mejora la navegación y las tareas habituales de jugadoras y entrenadores en móvil. La spec 001 sigue rigiendo el catálogo, los importes, los cálculos, los permisos de operación, los pagos, las temporadas y la hucha. Esta iteración amplía el acceso con una sesión persistente e incorpora al cuerpo técnico como destinatario de multas.

## Diagnóstico de la aplicación actual

- Inicio ya contiene la búsqueda, los filtros y la lista de jugadoras; la pestaña «Jugadoras» vuelve a mostrar esa lista.
- «Staff» no explica claramente a quién se dirige y abre una pantalla separada que concentra el acceso, las acciones y el cierre de sesión.
- El inicio es el mismo para todos, aunque los entrenadores necesitan llegar rápidamente a tareas de gestión.
- El botón de cabecera no expresa cómo volver a la vista pública y, con sesión, muestra el usuario en vez de indicar el cambio de vista.
- Algunas pantallas y enlaces de vuelta apuntan a «Staff» o «Jugadoras»; deben adaptarse a la nueva navegación para que no queden recorridos duplicados o sin salida.

## Objetivos

1. Distinguir con claridad la vista de jugadoras y la de entrenadores.
2. Llegar a las acciones frecuentes con menos pasos y sin duplicar pantallas.
3. Mantener visibles el estado de la temporada, los pagos por verificar y las limitaciones de conexión.
4. Conseguir una experiencia coherente, accesible y cómoda en móvil.

## Vistas y acceso

- En la primera visita, una modal ofrece «Jugadora» y «Entrenador». La elección se guarda sin caducidad en el navegador o instalación. Si se borran los datos locales, se vuelve a preguntar.
- «Jugadora» abre la vista pública sin PIN y conserva el destino si se entró desde un enlace público válido. «Entrenador» abre el acceso por PIN cuando hace falta y, tras validarlo, abre Inicio de Entrenadores o la acción protegida que se solicitó.
- En Jugadoras, el botón «Jugadoras» de la cabecera abre un menú con «Acceder como entrenador», que lleva al formulario de PIN. Antes de iniciar sesión, «Volver a Jugadoras» permite cancelar el acceso y abre Inicio de Jugadoras. La preferencia guardada refleja el recorrido elegido.
- En la vista autenticada, el botón «Coaches» ocupa el mismo lugar en la cabecera y abre el menú de cuenta. Muestra el nombre de usuario y la acción «Cerrar sesión», que es la salida a la vista pública.
- Jaime, Nacho y Guada tienen PIN distintos y los mismos permisos. El formulario pide únicamente el PIN. El servidor identifica al entrenador y usa su cuenta interna para registrar la autoría de cada gestión. Las fichas públicas del cuerpo técnico siguen siendo independientes del acceso.
- La elección local solo indica qué vista abrir. La sesión de entrenador usa una credencial revocable emitida por el servidor y persiste al cerrar y reabrir la app en ese navegador o instalación. El PIN se usa para acceder y no se guarda de forma persistente. Las operaciones protegidas requieren una sesión válida verificada por el servidor. Se mantiene el bloqueo de un minuto tras cinco fallos de PIN en el acceso de Entrenadores. El servidor aplica el límite antes de identificar una cuenta, ya que el formulario solo recibe el PIN.
- Si se reabre la app con la vista Entrenadores recordada, una sesión válida permite continuar sin repetir el PIN. Si la sesión ya no es válida, se pide el PIN al intentar acceder a gestión. Sin conexión se permite consultar los datos públicos guardados y se indica que la gestión requiere conexión.
- «Cerrar sesión» lleva directamente a Inicio de Jugadoras al completar el cierre. Se elimina la credencial local, se guarda Jugadoras como vista de inicio y, con la sesión persistente, se revoca la credencial en el servidor. La modal de primera visita se reserva para una instalación sin elección guardada. Volver a Entrenadores requiere el PIN individual. El cierre afecta a la sesión de este navegador o instalación.

## Navegación e inicios

### Jugadoras

- **Inicio** reúne la tarjeta de hucha y la lista de jugadoras con búsqueda por nombre o dorsal, filtros, saldos y estados existentes.
- Se ocultan de la interfaz la pantalla duplicada «Jugadoras» y su pestaña inferior: toda su funcionalidad permanece en Inicio. Por ahora se conserva su código; ocultarla no implica eliminarlo. La navegación principal pública queda en **Inicio**, **Hucha** y **Catálogo**.
- Por defecto, la plantilla muestra primero a las jugadoras con multas pendientes o por verificar, de mayor a menor saldo. Después aparecen las que están al día. En empate se mantiene el orden previo de la plantilla.
- «Ordenar por dorsal» aparece como un texto subrayado discreto con área táctil accesible. Al activarlo, ordena los resultados visibles de menor a mayor dorsal y conserva la búsqueda y el filtro aplicados.
- Inicio incluye un bloque público separado «Cuerpo técnico» con acceso a las fichas y multas de Jaime, Nacho y Guada. La plantilla de jugadoras conserva su propia lista.
- Desde la lista se sigue accediendo al detalle de cada jugadora y a la declaración de pago. Volver desde el detalle lleva a Inicio, conservando búsqueda y filtro cuando sea posible durante la navegación de la sesión.
- Los enlaces guardados a la antigua lista de jugadoras deben seguir llevando a la lista de Inicio.

### Entrenadores

- Ambos inicios comparten estructura e identidad visual. La tarjeta «La hucha de Nacho» usa azul marino en Jugadoras y granate en Entrenadores. La cabecera identifica la vista con texto.
- Inicio de Entrenadores presenta accesos directos a **Nueva multa**, **Pagos por verificar**, **Gestionar hucha** y **Crear temporada**.
- «Pagos por verificar» muestra el contador de la temporada visible, incluido «0 pagos por verificar», y abre la lista de revisión existente. Los pagos se verifican desde esa lista. Al terminar una acción se puede volver al inicio de Entrenadores.
- La lista y el detalle de jugadoras siguen siendo accesibles para consultar y gestionar multas. Hucha y Catálogo siguen disponibles. La navegación debe hacer visible dónde está el usuario sin duplicar la lista.
- La temporada seleccionada permanece visible. Si una acción requiere la temporada activa y hay otra seleccionada, se explica y se ofrece cambiar a la activa, sin realizar la acción de forma inesperada.
- Los enlaces antiguos a la pantalla de staff y a sus acciones siguen funcionando: solicitan acceso cuando corresponda y conducen a la tarea adecuada tras autenticarse.

## Multas a entrenadores

- En «Nueva multa», una sesión de entrenador permite seleccionar a una jugadora o a un miembro del cuerpo técnico como destinatario. La búsqueda del formulario muestra coincidencias al escribir y mantiene visible la persona seleccionada hasta que se cambie.
- A Jaime, Nacho y Guada se les aplican las mismas reglas de multas que a las jugadoras, incluidos el contador de asistencia, los escalones, los plazos, el incremento por vencimiento y el aviso «No convocable». Reciben el multiplicador ×2 en los mismos supuestos que las capitanas, con las excepciones de la spec 001, como el ajuste manual. Saldos, cobros y hucha siguen las reglas de la temporada correspondiente.
- Cada ficha pública muestra el nombre indicado en el bloque «Cuerpo técnico», las multas y el saldo de la temporada visible. «Ya he pagado» permite declarar el pago de una multa pendiente con el mismo flujo que en las fichas de jugadoras. Los nombres públicos se mantienen separados de las cuentas de acceso. La verificación, el cobro directo y la anulación requieren una sesión autorizada.

## Orden de las multas

- Cuando una lista muestra precios o importes de multas, se ordena de menor a mayor por el importe que se muestra. Se aplica al Catálogo, al selector de conceptos de «Nueva multa», a las listas de las fichas y a «Pagos por verificar».
- Si la pantalla separa los elementos por grupo o estado, se ordena dentro de cada grupo o estado. Una multa vencida se ordena por el importe vigente que se muestra como principal. En caso de empate se conserva el orden previo de la lista.
- En el selector de conceptos se ordena por el primer precio mostrado cuando una opción tiene varias tarifas. Los ajustes con importe por introducir se sitúan al final.

## Mejoras adicionales

- **Estados claros:** diferenciar con texto, además de color, pendiente, pago por verificar, pagada, vencida y no convocable. Explicar que declarar un pago no reduce la deuda ni suma a la hucha hasta su aceptación.
- **Confirmación y errores útiles:** tras guardar o verificar, mostrar el resultado y un siguiente paso claro. Si no se puede confirmar una operación, pedir que se revise el estado antes de reintentarlo para evitar duplicados.
- **Conexión.** Al consultar sin conexión, se muestra la fecha y hora de la última actualización correcta de los datos visibles. Si se desconoce, se muestra «Sin conexión. Mostrando datos guardados». El aviso se retira tras actualizar correctamente. El acceso y las operaciones de escritura requieren conexión.
- **Listas vacías y búsqueda.** Se distingue «Todavía no hay jugadoras registradas», «No encontramos jugadoras con ese nombre o dorsal» y «No hay jugadoras que coincidan con el filtro seleccionado». Se usan los controles existentes para cambiar la búsqueda y el filtro.
- **Formularios.** La opción de cobro directo se llama «La jugadora ya ha pagado» al registrar para una jugadora y «El entrenador ya ha pagado» al registrar para un entrenador. Conservar lo introducido ante errores de validación, señalar el campo y explicar cómo corregirlo; mantener visibles el resumen y el importe antes de guardar. Evitar envíos repetidos mientras se procesa la acción.
- **Navegación accesible:** controles con nombre claro, foco visible y orden lógico; anunciar cambios de estado y errores, permitir teclado y no depender solo del color. Controles táctiles de al menos 44 px, contraste AA y diseño adaptable desde 375 px sin desplazamiento horizontal.
- **Consistencia visual:** mantener la identidad del club, jerarquía clara, textos en español y componentes coherentes. Usar iconos de fútbol cuando aporten significado, sin fotos de jugadoras ni nuevos datos personales.

## Modales y señales de operación

Se propone un patrón coherente para las operaciones de escritura, empezando por el registro de multas. Los mensajes aparecen en un diálogo centrado y visible sin desplazarse. Cada estado tiene icono y texto; el color nunca es la única señal.

### Registro de una multa

1. **Guardando:** al enviar un formulario válido, se abre el diálogo con un indicador de carga y el texto «Guardando multa…». Se impide volver a enviar mientras se espera la respuesta. No se anuncia el éxito antes de confirmarlo.
2. **Guardada:** cuando el servidor confirma el registro, se sustituye el indicador por un check verde y «Multa registrada». Se ofrece un botón «Aceptar» para cerrar el diálogo y continuar. Si corresponde proponer un escalón, se presenta después de cerrar esta confirmación y se mantiene su confirmación independiente.
3. **Error:** si se confirma que el registro no se realizó, aparece un icono de error, una explicación clara y la opción «Reintentar», conservando los datos introducidos. También se permite cerrar el diálogo para revisar o corregir el formulario. Un reintento vuelve a mostrar el estado de carga y no permite envíos simultáneos.
4. **Tercer fallo:** tras tres intentos fallidos consecutivos de la misma operación, el mensaje indica «Contacta con la persona responsable de la aplicación». No se muestra ningún dato de contacto. El mensaje conserva la posibilidad de cerrar el diálogo y revisar los datos.
5. **Resultado incierto:** si se pierde la conexión o no llega confirmación, la app no puede asegurar si la multa se guardó. El diálogo lo explica y ofrece revisar el detalle de la jugadora o actualizar los datos antes de volver a intentarlo. Solo se ofrece un reintento directo si se puede garantizar que no duplicará la operación; en otro caso se exige comprobar primero el resultado. Los resultados inciertos también cuentan para informar del tercer fallo.

### Comportamiento común

- Aplicar el mismo lenguaje visual de carga, éxito y error a declaración y verificación de pagos, cobros, anulaciones, gastos, ajustes de hucha y creación de temporadas, adaptando el texto y las acciones a cada operación.
- El diálogo identifica qué operación está en curso o ha terminado. El éxito se muestra solo con confirmación; un error conserva el contexto necesario para recuperarse. Los mensajes no exponen credenciales ni detalles técnicos innecesarios.
- El diálogo es accesible: nombre y descripción asociados, foco dentro al abrir, navegación con teclado, anuncio de cambios de estado y retorno del foco a un lugar lógico al cerrar. El cierre durante una operación en curso no debe permitir otro envío ni hacer creer que se canceló en el servidor.
- La propuesta del tercer fallo se refiere a intentos de la misma operación, no a errores de validación del formulario; el contador se reinicia al completar la operación o abandonarla expresamente.

## Criterios de aceptación

1. Una persona sin sesión puede consultar Inicio, detalle, Hucha y Catálogo y declarar un pago con el flujo vigente.
2. Se pregunta por el perfil una sola vez por navegador o instalación. La elección se recuerda al reabrir. Un enlace público válido conserva su destino al elegir Jugadora. Un acceso fallido mantiene las protecciones existentes.
3. Una sesión persistente válida permite reabrir Entrenadores en el mismo navegador o instalación sin repetir el PIN. El botón «Jugadoras» abre el menú con «Acceder como entrenador». El formulario de acceso solo pide el PIN y permite volver a Inicio de Jugadoras antes de autenticarse. Dos PIN distintos identifican a sus respectivos entrenadores, con los mismos permisos y autoría separada.
4. En todas las pantallas de Entrenadores con sesión iniciada, el botón «Coaches» abre el menú de cuenta y la salida a Jugadoras se hace con «Cerrar sesión». Al completar el cierre, se abre directamente Inicio de Jugadoras, se recuerda la vista pública y una acción protegida vuelve a requerir autenticación. Con la sesión persistente, el servidor rechaza la credencial revocada.
5. El inicio de entrenadores da acceso a las cuatro tareas indicadas y muestra el número de pagos por verificar, incluido cero. Cada tarea permite volver al inicio de entrenadores.
6. La navegación pública no muestra una segunda pantalla o pestaña con la misma lista y se conserva el código existente de esa pantalla. El enlace antiguo de jugadoras abre la lista de Inicio, y los enlaces de gestión conservan acceso protegido.
7. Al elegir una temporada no activa, las acciones sujetas a la temporada activa explican la limitación y permiten cambiar a ella.
8. En modo avión, los datos guardados muestran su última fecha y hora de actualización correcta, o el aviso genérico si se desconoce. Al actualizar correctamente se retira el aviso.
9. Los estados, errores, confirmaciones, resultados vacíos y controles se entienden en móvil y con teclado o lector de pantalla; la información relevante no depende solo del color.
10. Al registrar una multa, el diálogo centrado muestra carga mientras se procesa y un check verde con confirmación cuando se guarda, sin exigir desplazamiento. La propuesta de escalón, si existe, sigue siendo independiente.
11. Ante un fallo confirmado se conservan los datos y se puede reintentar; al tercer fallo consecutivo se indica contactar con la persona responsable de la aplicación, sin mostrar datos de contacto. Un resultado incierto se comunica y no permite un reintento que pueda duplicar la operación sin comprobarla.
12. Los diálogos funcionan con teclado y lector de pantalla y devuelven el foco a un lugar lógico al cerrarse.
13. El bloque público «Cuerpo técnico» muestra a Jaime, Nacho y Guada. Cada ficha muestra sus multas, saldo, contador de asistencia y avisos de vencimiento. Se puede declarar un pago pendiente desde la ficha y verificarlo desde la lista actual. Al registrar multas, el ×2 se aplica en los mismos supuestos que a una capitana, incluidos los escalones.
14. Una lista con importes muestra los menores primero dentro de cada grupo. El control «Ordenar por dorsal» ordena la plantilla de menor a mayor y mantiene la búsqueda y el filtro activos.
15. Plantilla vacía, búsqueda sin coincidencias y filtro sin resultados muestran mensajes distintos. La búsqueda y los filtros existentes permiten ajustar la consulta.
16. La verificación de pagos se realiza en la lista actual y conserva las transiciones de la spec 001.

## Fuera de alcance

«Últimas multas», verificación de pagos desde otras tarjetas, pagos online, notificaciones push, gestión de varios equipos, reinicio de datos, estadísticas, fotos y gestión de convocatorias.

## Preparación de datos

El plan técnico debe concretar el alta de Jaime, Nacho y Guada como destinatarios de multas y su separación de las cuentas de acceso.
