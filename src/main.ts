import "./styles/tokens.css";
import "./components/crg-app";
// import { leerTemporadaActiva } from "./lib/supabase";

// if (import.meta.env.DEV) {
//   let consultaEnCurso = false;

//   const refrescar = async () => {
//     if (consultaEnCurso || document.hidden) return;
//     consultaEnCurso = true;

//     try {
//       const datos = await leerTemporadaActiva();
//       console.info(
//         `[Supabase] Temporada activa: ${datos.activa.nombre}`,
//         datos,
//       );
//     } catch (error) {
//       console.error(error);
//       alert(error instanceof Error ? error.message : String(error));
//     } finally {
//       consultaEnCurso = false;
//     }
//   };

//   const intervalo = setInterval(refrescar, 60_000);
//   document.addEventListener("visibilitychange", refrescar);
//   void refrescar();

//   import.meta.hot?.dispose(() => {
//     window.clearInterval(intervalo);
//     document.removeEventListener("visibilitychange", refrescar);
//   });
// }
