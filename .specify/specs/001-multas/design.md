# Diseño: Multas CR Guindalera

Las maquetas generadas con IA son referencia de estructura y estilo. Importes, textos de reglas y permisos salen de `spec.md`.

## Principios visuales

- Paleta del club: azul marino oscuro en tarjetas destacadas, rojo para alertas y acción principal, dorado en detalles, fondo claro.
- Móvil primero (375 px), botones de 44 px mínimo, contraste AA, importes en formato es-ES (12,50 €).
- Iconografía de **fútbol**.
- **Sin fotos.** Cada jugadora se identifica con un círculo con su dorsal. Las capitanas llevan una pequeña "C".
- Solo se muestran nombre y dorsal.
- El estado nunca depende solo del color: Al día, Pendiente, "Quedan N días", Vencida, No convocable.

## Navegación global

- Cabecera: escudo, "CR GUINDALERA", "Senior femenino · [temporada]" (tocarla abre el selector de temporada) y botón Staff. Con sesión, el botón muestra el usuario y permite cerrar sesión.
- Barra inferior: Inicio, Jugadoras, Hucha, Catálogo.

## Pantallas

### 1. Inicio (público)

Tarjeta de hucha (saldo, temporada, nº de multas pendientes), buscador por nombre o dorsal, filtros Todas / Pendientes / Al día con contador, y lista de jugadoras con dorsal, nombre, subtexto (faltas, multas pendientes o "No convocable"), saldo y etiqueta de estado. Las filas vencidas se resaltan. Tareas: T10, T11.

### 2. Detalle de jugadora (público)

- Banner rojo "No convocable (+15 días sin pagar)" si hay multas vencidas.
- Tarjeta: círculo con dorsal, nombre, "Capitana · multas x2" si aplica, nº de multas vencidas y total de deuda.
- Faltas de asistencia: contador "N de [siguiente escalón]" y tres casillas 3 / 6 / 9 con 4 €, 6 € y 8 € (el doble en capitanas).
- Sanciones activas: concepto, estado ("Quedan N días" o Vencida) e importe. En las vencidas, importe duplicado con el original tachado.
- Desplegable "N pagadas (importe)".
- Con sesión de entrenador, cada multa pendiente muestra "Marcar como pagada" y "Anular".
- Sin botón ni bloque de pago. Tareas: T12, T17.

### 3. Catálogo (público)

Pestañas Todas / Entrenos / Partidos. Aviso: "Multa impagada pasados 15 días: importe doble y no convocable". Bloque de escalones de asistencia (3, 6 y 9 faltas) con 4 €, 6 € y 8 €. Conceptos con nombre, descripción corta e importe ("por prenda" donde aplica). Nota: "Cuerpo técnico y capitanes x2". Tarea: T13.

### 4. Acceso entrenador

Campo de usuario, PIN de 4 dígitos con teclado numérico (borrar y confirmar), título "Acceso entrenadores" y temporada activa. Error de PIN genérico. Tras 5 fallos, mensaje de espera de 1 minuto. Sin Face ID, sin perfil Capitanía. "¿Olvidaste el PIN?" indica que lo restablece quien administra el sistema. Tarea: T15.

### 5. Panel: nueva sanción (entrenador)

1. **Jugadora:** buscador y chips con dorsal.
2. **Concepto:** pestañas Entrenamiento / Partido con el importe de cada concepto (ya duplicado si es capitana), selección única. Cantidad si es por prenda. Minutos si es llegada tarde a partido (el concepto se calcula solo). Al final, "Ajuste manual" con importe y motivo obligatorios.
3. **Fecha y observaciones:** hoy por defecto.

- Barra inferior fija: resumen, casilla "Pagar ahora" y botón "Guardar multa (importe)".
- Si la falta hace llegar a 3, 6 o 9, aparece una confirmación: "[Nombre] llega a N faltas: corresponde escalón de X €. ¿Registrar?". Tarea: T16.

### 6. Hucha

Tarjeta con bote, ingresado (inicial + multas cobradas) y gastado. Movimientos con filtros Todos / Ingresos (multas) / Gastos; cada fila con concepto, dorsal, fecha e importe. Con sesión: "+ Registrar gasto" y "Editar importe inicial". Sin objetivo de hucha. Tareas: T14, T18.

## Pantallas pendientes de diseñar

1. Jugadoras (lista completa).
2. Registrar gasto y editar importe inicial.
3. Crear y cambiar de temporada.
4. Confirmar pago (fecha) y anular multa (motivo).
5. Confirmación de escalón.
6. Estados: lista vacía, sin conexión ("Mostrando datos guardados"), error de carga, PIN incorrecto y bloqueo.
7. Icono PWA y pantalla de carga.

## Componentes (Lit)

`crg-header`, `crg-bottom-nav`, `crg-hucha-card`, `crg-player-row`, `crg-dorsal-badge`, `crg-status-badge`, `crg-fine-card`, `crg-attendance-progress`, `crg-catalog-item`, `crg-pin-pad`, `crg-fine-form`, `crg-movement-row`.
