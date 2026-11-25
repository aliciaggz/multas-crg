# Bugs observados y seguimiento

Registro de los bugs comunicados durante la revisión posterior a las specs 001 y 002. Las specs no se modifican como parte de este seguimiento.

## 1. Bordes rojos en móvil

- **Observación:** aparecen líneas rojas parecidas a bordes al pulsar algunos elementos o, a veces, por defecto; solo se observan en móvil.
- **Estado:** corregido. Se eliminaron los contornos de foco visibles en las pantallas y el contorno interno del PIN que aparecían al tocar controles en móvil. Los rojos que representan estados reales se conservan.

## 2. Faltas con aviso y escalones de asistencia

- **Observación:** las faltas registradas como «avisando con 4 horas o más» aparecen como pagadas; al llegar a tres faltas, el escalón no queda guardado como pendiente. El texto debe indicar que corresponde a un bono, por ejemplo «(bono)».
- **Estado:** corregido. La falta de 0 € sigue registrándose para contar la asistencia. Al seleccionar a la persona, el formulario calcula bonos pendientes aunque las faltas ya estuvieran registradas; el bono también se puede elegir en Concepto. Tras registrarlo, abre la ficha para mostrarlo en Sanciones pendientes con las acciones de entrenador. La ficha distingue bonos pendientes y completados.

## 3. Búsqueda de plantilla al salir de Inicio

- **Observación:** limpiar la consulta de búsqueda al salir de Inicio, incluso al abrir la ficha de una jugadora.
- **Estado:** implementado en esta sesión. El texto buscado se borra al salir de Inicio; los filtros y el orden se conservan.
