# Spec 001: Gestión de multas

## Contexto

El equipo senior femenino del CR Guindalera aplica un reglamento de multas (ver PDF de normas). Hoy se lleva a mano. Esta app centraliza las multas para que cada jugadora vea lo que debe, avise cuando paga y los entrenadores registren y verifiquen.

## Flujo principal

1. El entrenador entra en la zona staff y registra la multa. Queda **Pendiente**.
2. La jugadora entra, busca su nombre, abre su multa y pulsa "Ya he pagado". Pasa a **Pago pendiente de verificar**.
3. El entrenador recibe el aviso, abre "Pendientes de verificar" y comprueba el pago fuera de la app.
4. Si está verificado, pulsa **Aceptar**: la multa pasa a **Pagada**, sale de la deuda, queda en el historial y suma a la hucha. Si no, pulsa **Rechazar** y vuelve a **Pendiente**.

## Roles

- **Jugadora / público (sin login):** ve jugadoras, saldos, multas, catálogo y hucha. Puede declarar el pago de una multa pendiente.
- **Entrenador (usuario y PIN):** registra, cobra, verifica y anula multas, registra gastos, edita la hucha inicial y gestiona temporadas.
- **Capitana:** es una jugadora con multiplicador x2. No tiene permisos especiales.
- El cuerpo técnico no aparece en la lista de jugadoras.

## Catálogo de multas

| Concepto                                        | Importe            |
| ----------------------------------------------- | ------------------ |
| **Entrenos**                                    |                    |
| Llegar tarde                                    | 2 € (sin cortesía) |
| Faltar sin avisar                               | 5 €                |
| Faltar avisando con menos de 4 h de antelación  | 3 €                |
| Mal uniformado (por prenda)                     | 1 €                |
| Falta de respeto                                | 6 €                |
| Escalón de asistencia: 3 faltas                 | 4 €                |
| Escalón de asistencia: 6 faltas                 | 6 €                |
| Escalón de asistencia: 9 faltas                 | 8 €                |
| **Partidos**                                    |                    |
| Llegar tarde (hasta 5 min de cortesía)          | 3 €                |
| Llegar 20 min o más tarde (sustituye a los 3 €) | 7 €                |
| No asistir siendo local                         | 5 €                |
| Faltar sin avisar o avisando el mismo día       | 20 €               |
| Convocatoria incorrecta (por prenda)            | 1 €                |
| Equipación del partido incorrecta (por prenda)  | 3 €                |
| Falta de respeto a entrenador, árbitro o rival  | 5 €                |
| Amarilla por protestar                          | 5 €                |
| Expulsión sin lance de juego                    | 10 €               |

## Catálogo de multas (fijo)

| id                          | Concepto                                                                                       | Importe        | Suma al contador de faltas |
| --------------------------- | ---------------------------------------------------------------------------------------------- | -------------- | -------------------------- |
| **Entrenos**                |                                                                                                |                |                            |
| ent_tarde                   | Llegar tarde (sin cortesía)                                                                    | 2 €            | No                         |
| ent_falta_sin_aviso         | Faltar sin avisar                                                                              | 5 €            | Sí                         |
| ent_falta_menos_4h          | Faltar avisando con menos de 4 h de antelación                                                 | 3 €            | Sí                         |
| ent_falta_con_aviso         | Faltar avisando con 4 h o más de antelación                                                    | 0 €            | Sí                         |
| ent_uniforme                | Mal uniformado (botas, ropa, pendientes, etc.)                                                 | 1 € por prenda | No                         |
| ent_respeto                 | Falta de respeto                                                                               | 6 €            | No                         |
| **Escalones de asistencia** |                                                                                                |                |                            |
| esc_3                       | 3 faltas de asistencia                                                                         | 4 €            | No                         |
| esc_6                       | 6 faltas de asistencia                                                                         | 6 €            | No                         |
| esc_9                       | 9 faltas de asistencia                                                                         | 8 €            | No                         |
| **Partidos**                |                                                                                                |                |                            |
| par_tarde                   | Llegar tarde (5 min de cortesía)                                                               | 3 €            | No                         |
| par_tarde_20                | Llegar 20 minutos o más tarde                                                                  | 7 €            | No                         |
| par_no_asiste_local         | No asistir al partido siendo local (las desconvocadas deben ir a la grada)                     | 5 €            | No                         |
| par_falta                   | Faltar sin avisar o avisando ese mismo día (este año sin excepciones)                          | 20 €           | No                         |
| par_convocatoria            | No traer ropa de convocatoria correcta                                                         | 1 € por prenda | No                         |
| par_equipacion              | No llevar correctamente la ropa del partido (botas, medias, camiseta, pantalón o espinilleras) | 3 € por prenda | No                         |
| par_respeto                 | Falta de respeto a entrenador, árbitro o rival                                                 | 5 €            | No                         |
| par_amarilla                | Amarilla por protestar                                                                         | 5 €            | No                         |
| par_expulsion               | Expulsión sin lance de juego                                                                   | 10 €           | No                         |

Nota del PDF: "Cuerpo técnico y capitanes x2".

## Reglas de cálculo

1. **Multiplicador de capitanas.** El importe registrado es el del catálogo × 2, escalones incluidos.
2. **Por prenda.** Importe × cantidad de prendas.
3. **Llegada tarde a partidos.** Los minutos se cuentan desde la hora de convocatoria. Hasta 5 min: sin multa. De 6 a 19 min: `par_tarde` (3 €). Desde 20 min: `par_tarde_20` (7 €, sustituye a los 3 €, no se suma).
4. **Llegada tarde a entrenos.** Sin tiempo de cortesía: cualquier retraso son 2 €.
5. **Contador de faltas de asistencia.** Cuenta solo faltas a entrenos, justificadas o no (los tres conceptos marcados "Sí"). Las faltas a partidos no cuentan. Las multas anuladas no cuentan. Se reinicia cada temporada.
6. **Escalones.** Son cobros independientes: 4 € al llegar a 3 faltas, 6 € a las 6 y 8 € a las 9 (18 € en total a las 9 faltas). Cada escalón se cobra una sola vez por temporada. No hay escalones más allá de 9. La app propone el escalón al alcanzarlo y el entrenador lo confirma. Si falta algún escalón anterior sin registrar, se proponen todos los pendientes.
7. **Plazo de pago y vencimiento.** El plazo es de 15 días desde la fecha de la multa. Una multa está **vencida** cuando han pasado más de 15 días y:
   - está Pendiente, o
   - está pendiente de verificar y la jugadora declaró el pago **después** de esos 15 días.

   Si la jugadora declara el pago a tiempo, la multa no vence mientras espera la verificación. Si ya estaba vencida, sigue vencida hasta que el entrenador la acepte. Si el entrenador rechaza, vuelve a Pendiente y se evalúa desde la fecha original. Una multa vencida duplica su importe y la jugadora queda **no convocable** hasta pagar. En una capitana el importe se multiplica por 2 por el rol y por 2 por vencimiento.

8. **Multas de 0 €.** Se guardan ya como pagadas. No suman deuda; solo cuentan para el contador.
9. **Ajuste manual.** Concepto especial solo para entrenadores, con importe y motivo obligatorios (por ejemplo, mentira demostrada o decisión sobre justificaciones dudosas). No aplica multiplicador automático.
10. **Anulación.** Una multa registrada por error se anula con motivo. No se borra y no cuenta para saldo, contador ni hucha.
11. **Saldo de jugadora.** Suma de los importes actuales de sus multas pendientes y pendientes de verificar en la temporada. La jugadora sigue debiendo hasta que un entrenador acepte el pago.
12. **Hucha.** Importe inicial de la temporada + multas pagadas − gastos. Las multas pendientes de verificar no suman.
13. **Cobro.** Se hace fuera de la app. Hay dos vías: la jugadora declara el pago y el entrenador lo verifica (regla 15), o el entrenador marca la multa como pagada directamente con su fecha.
14. **Temporada.** Contador, saldos y hucha son independientes por temporada. La app muestra la temporada activa.
15. **Declaración de pago.** Cualquier persona con el enlace puede declarar el pago de una multa Pendiente, sin login. La declaración queda registrada con su hora. No cambia saldo, hucha ni convocabilidad (salvo lo que dice la regla 7 sobre el plazo). Solo un entrenador puede aceptarla o rechazarla.
16. **Aviso al entrenador.** En la v1, una insignia con contador en el botón Staff y una pantalla "Pendientes de verificar". La notificación push al móvil llega después de la v1.

## Historias de usuario

**HU-1 Ver mis multas (público).** Busco por nombre o dorsal y veo saldo pendiente, multas con días restantes, vencidas o pendientes de verificar, historial de pagadas y contador de faltas hacia el siguiente escalón. Funciona sin conexión con los últimos datos cargados.

**HU-2 Consultar el catálogo (público).** Veo conceptos agrupados en Entrenos, Escalones y Partidos, con sus importes.

**HU-3 Registrar una multa (entrenador).** Elijo jugadora, concepto, cantidad si es por prenda, fecha y observación. El importe se calcula solo (con x2 si es capitana) y lo veo antes de guardar. Puedo marcar "Pagar ahora" para registrarla ya cobrada.

**HU-4 Cobrar directamente (entrenador).** Marco una multa como pagada con su fecha de pago. La jugadora vuelve a ser convocable si no le quedan multas vencidas.

**HU-5 Acceder como entrenador.** Entro con usuario y PIN. Tras 5 intentos fallidos hay una espera de 1 minuto.

**HU-6 Ver la hucha (público).** Veo el saldo, lo ingresado, lo gastado y los movimientos de la temporada.

**HU-7 Gestionar la hucha (entrenador).** Registro gastos con importe, motivo y fecha obligatorios, y edito el importe inicial de la temporada.

**HU-8 Gestionar temporadas (entrenador).** Creo una temporada nueva. Su importe inicial de hucha se propone con el saldo final de la anterior y es editable.

**HU-9 Anular una multa (entrenador).** Indico el motivo y la multa deja de contar.

**HU-10 Declarar mi pago (jugadora).** Abro mi multa pendiente y pulso "Ya he pagado", con una confirmación previa. La multa pasa a "Pago pendiente de verificar".

**HU-11 Verificar pagos (entrenador).** Veo la insignia con el número de pagos por verificar y abro la lista. Para cada uno, acepto (con fecha de pago) o rechazo. Al aceptar pasa a Pagada; al rechazar vuelve a Pendiente.

## Fuera de alcance (v1)

Pagos online o Bizum, notificaciones push (se hacen después de la v1), estadísticas, fotos, biometría, objetivos de hucha, consecuencias asociadas a los escalones, gestión de convocatorias y cuerpo técnico en la lista.

## Supuestos a confirmar

1. Escalones acumulativos: 18 € en total a las 9 faltas (regla 6).
2. Las faltas con aviso de 4 h o más suman al contador aunque no tengan multa (regla 5).

## Fuera de alcance (v1)

- Notificaciones automáticas por WhatsApp o email.
- Pagos online.
- Estadísticas por temporada.
- Gestión de convocatorias o asistencia completa.

## Temporada

- La app muestra la temporada activa (ej. 2026/27) en la cabecera.
- El staff puede cambiar de temporada o crear una nueva.
- Contadores de faltas, saldos y hucha son independientes por temporada.

## Hucha

- Cada temporada tiene un importe inicial (puede ser 0 €).
- Saldo de hucha = inicial + multas cobradas − gastos registrados.
- Edición manual solo para staff, con importe, motivo y fecha obligatorios.
- Todo movimiento manual queda en un historial visible.
