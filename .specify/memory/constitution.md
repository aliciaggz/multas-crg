# Principios del proyecto: Multas CR Guindalera (fútbol, senior femenino)

1. **El PDF y la spec mandan.** Los importes y reglas salen de `spec.md`. Las maquetas son referencia visual y nunca fijan importes.
2. **Sin registro para leer.** Cualquiera con el enlace ve jugadoras (nombre y dorsal), multas y hucha, sin login ni descarga.
3. **Escritura protegida.** Solo los entrenadores registran, cobran, verifican, anulan y editan la hucha, con usuario y PIN comprobado en el servidor. Las capitanas no registran. La única escritura pública es declarar el pago de una multa pendiente, y no cambia saldos ni hucha hasta que un entrenador la verifica.
4. **Datos mínimos.** Solo nombre y dorsal. Sin apellidos, fotos ni datos de contacto.
5. **Ligera.** PWA instalable, lectura sin conexión, menos de 150 KB de JavaScript comprimido.
6. **Móvil primero y en español.**
7. **Catálogo fijo en el código,** igual para todas las jugadoras.
8. **Sin pagos en la app.** El cobro se hace fuera. La jugadora puede avisar de que ha pagado y el entrenador lo verifica antes de aceptarlo.
9. **Trazabilidad.** Cada multa, cobro, anulación y gasto guarda quién lo hizo, cuándo y por qué.
10. **Cambios pequeños y probados.** Una tarea por sesión, con tests de las reglas de cálculo.
