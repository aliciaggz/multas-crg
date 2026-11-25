# Diseño de la spec 002

La [spec 002](spec.md) determina los recorridos. El [diseño de la spec 001](../001-multas/design.md) aporta la identidad del club. Mantener la tipografía, el escudo y los componentes actuales. Usar azul marino para la tarjeta principal de Jugadoras y granate para la de Entrenadores. El nombre de la vista aparece en texto. Diseñar primero para 375 px, con contraste AA y controles táctiles de al menos 44 px.

## Primera visita y cabecera

- Diálogo centrado «¿Cómo quieres entrar?» con dos acciones, «Jugadora» y «Entrenador». El fondo queda inactivo mientras se elige. Si se abre un enlace a una ficha pública, «Jugadora» lleva a esa ficha. «Entrenador» lleva al formulario de acceso cuando corresponde.
- La cabecera conserva escudo, club y temporada. En Jugadoras, el botón «Jugadoras» con una flecha hacia abajo despliega «Acceder como entrenador». El formulario ofrece «Volver a Jugadoras» mientras se está iniciando sesión. Muestra la etiqueta «PIN», el teclado numérico existente y la acción «Entrar». Cada entrenador escribe su PIN y el nombre de cuenta aparece en el menú «Coaches» tras el acceso. Para un PIN rechazado se muestra «PIN incorrecto» y, durante el bloqueo, el aviso de espera.
- Con sesión iniciada, el botón «Coaches» ocupa el mismo lugar y abre el menú de cuenta. El menú muestra el nombre de usuario y «Cerrar sesión» al final. Al completar el cierre se abre directamente Inicio de Jugadoras.
- La barra inferior muestra **Inicio · Hucha · Catálogo**. La ficha indica «Volver a Inicio» cuando se llega desde la plantilla y ofrece la vuelta a pagos por verificar cuando ese es el contexto de origen. Las pantallas de gestión ofrecen vuelta a Inicio de Entrenadores.

## Inicio de Jugadoras

| De arriba abajo | Contenido |
| --- | --- |
| Hucha | Tarjeta azul marino «La hucha de Nacho» con resumen y enlace a Hucha. |
| Plantilla | Buscador por nombre o dorsal, filtros actuales, título y contador, y filas con dorsal, nombre, estado y saldo. Por defecto aparecen primero las deudas más altas y después las jugadoras al día. «Ordenar por dorsal» aparece subrayado junto al título o contador. El área pulsable conserva el tamaño táctil y el foco visible. |
| Cuerpo técnico | Bloque independiente con filas para Jaime, Nacho y Guada. Cada fila comparte el formato de la plantilla. Muestra el nombre, el saldo pendiente, el estado y la imagen del cerdo entrenador dentro del círculo del dorsal. Abre la ficha en la temporada visible. |

Mensajes en la zona de resultados:

| Situación | Texto |
| --- | --- |
| Plantilla vacía | «Todavía no hay jugadoras registradas». |
| La consulta no encuentra a ninguna jugadora | «No encontramos jugadoras con ese nombre o dorsal». |
| Hay jugadoras que coinciden con la consulta, pero el filtro no deja resultados | «No hay jugadoras que coincidan con el filtro seleccionado». |

Los controles ya visibles permiten editar la búsqueda y escoger otro filtro.

## Inicio de Entrenadores

Tras la tarjeta granate de la hucha, mostrar **Nueva multa** como acción principal. A continuación, **Pagos por verificar** con el número en el texto, incluido «0 pagos por verificar», y los accesos **Gestionar hucha** y **Crear temporada**. Mantener un acceso a la plantilla dentro de Inicio para abrir fichas en gestión. En una temporada anterior, explicar la restricción al entrar en una acción que requiere la temporada activa y ofrecer «Cambiar a la temporada activa».

## Fichas, catálogo y formulario

- Las fichas comparten cabecera, saldo, asistencia, multas activas e historial. Las jugadoras conservan su dorsal. En las fichas del cuerpo técnico la identificación se hace por nombre. Mostrar «Ya he pagado» en una multa pendiente cuando esté disponible y explicar que el pago queda por verificar.
- Mostrar «Pendiente», «Por verificar», «Pagada», «Vencida», «Anulada» y «No convocable» donde corresponda, con texto además de color. Una declaración tardía puede mostrar a la vez «Por verificar» y «Vencida». Los avisos se sitúan junto al saldo o la multa correspondiente.
- «Nueva multa» comienza con el buscador y una indicación para escribir. Buscar por nombre para el cuerpo técnico y por nombre o dorsal para jugadoras. Identificar el grupo en los resultados. Tras elegir, mostrar la persona seleccionada y una acción para cambiarla. Mantener visible el resumen con el importe antes de guardar. Usar «La jugadora ya ha pagado» o «El entrenador ya ha pagado» para el cobro directo.
- Catálogo, selector de conceptos, fichas y pagos por verificar presentan el precio ascendente dentro de cada grupo existente. El importe vigente se destaca sobre el original tachado en una multa vencida. La lista actual de verificación conserva sus controles de aceptar y rechazar.

## Diálogos de escritura

| Estado | Contenido y acción |
| --- | --- |
| En curso | Indicador de carga y «Guardando multa…». Bloquear envíos repetidos. |
| Éxito confirmado | Check verde, «Multa registrada» y «Aceptar». Presentar el escalón, si aplica, después de cerrar este diálogo. |
| Fallo confirmado | Icono y explicación. «Reintentar» si procede y opción para volver al formulario con los datos conservados. |
| Resultado incierto | «No podemos confirmar si se guardó la multa». Ofrecer revisar la ficha o actualizar los datos antes de repetir. |
| Tercer fallo | «Contacta con la persona responsable de la aplicación». Mantener la opción de cerrar y revisar los datos. |

Adaptar el título y las acciones al resto de operaciones con el mismo diseño. Los iconos acompañan el texto. Al abrir un diálogo, llevar el foco a su contenido, mantenerlo dentro, anunciar cambios y devolverlo a la acción que lo abrió o al siguiente paso si ya no está disponible.

## Sin conexión

Mostrar un aviso por encima del contenido con la fecha de la copia de la temporada visible. Ejemplo «Sin conexión. Mostrando datos guardados el 24/11/2026 a las 18:30». Para una copia sin fecha, mostrar «Sin conexión. Mostrando datos guardados». Las acciones que requieren conexión indican su estado y el aviso desaparece al completar una actualización correcta.
