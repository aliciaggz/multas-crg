import type { CredencialesStaff, RespuestaRpc } from "./supabase";

export type AccesoStaff = ReturnType<typeof crearAccesoStaff>;
type ResultadoAcceso =
  | { estado: "correcto"; usuario: string }
  | { estado: "incorrecto" | "bloqueado" };

/** Supabase decide si permite el acceso. La espera local solo informa a quien usa esta pestaña. */
export function crearAccesoStaff(
  verificar: (
    credenciales: CredencialesStaff,
  ) => Promise<RespuestaRpc<{ usuario: string }>>,
  ahora = () => Date.now(),
) {
  const intentos = new Map<string, { fallos: number; hasta: number }>();

  function segundosRestantes(usuario: string): number {
    const intento = intentos.get(usuario.trim().toLowerCase());
    return intento
      ? Math.max(0, Math.ceil((intento.hasta - ahora()) / 1000))
      : 0;
  }

  async function intentar(
    nombre: string,
    pin: string,
  ): Promise<ResultadoAcceso> {
    const usuario = nombre.trim().toLowerCase();
    if (segundosRestantes(usuario)) return { estado: "bloqueado" };

    const respuesta = await verificar({ usuario, pin });
    if (respuesta.ok) {
      intentos.delete(usuario);
      return { estado: "correcto", usuario: respuesta.usuario };
    }

    const anterior = intentos.get(usuario);
    const fallos = (anterior?.hasta ? 0 : (anterior?.fallos ?? 0)) + 1;
    const hasta = fallos === 5 ? ahora() + 60_000 : 0;
    intentos.set(usuario, { fallos, hasta });
    return { estado: hasta ? "bloqueado" : "incorrecto" };
  }

  return { intentar, segundosRestantes };
}
