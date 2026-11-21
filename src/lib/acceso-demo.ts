export type AccesoDemo = ReturnType<typeof crearAccesoDemo>;

/** Simula el acceso de la maqueta. El resultado solo sirve para la sesión de demostración. */
export function crearAccesoDemo() {
  const usuario = 'demo';
  const pin = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
  let fallos = 0;
  let bloqueadoHasta = 0;

  function segundosRestantes(ahora = Date.now()) {
    return Math.max(0, Math.ceil((bloqueadoHasta - ahora) / 1000));
  }

  function intentar(nombre: string, codigo: string, ahora = Date.now()) {
    if (segundosRestantes(ahora) > 0) return 'bloqueado';
    if (nombre === usuario && codigo === pin) {
      fallos = 0;
      return 'correcto';
    }

    fallos++;
    if (fallos === 5) {
      bloqueadoHasta = ahora + 60_000;
      fallos = 0;
      return 'bloqueado';
    }
    return 'incorrecto';
  }

  return { usuario, pin, intentar, segundosRestantes };
}
