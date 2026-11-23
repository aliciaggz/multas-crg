# Multas CRG

Aplicación web para consultar y gestionar las multas de un equipo de fútbol. La interfaz está en español y se adapta a móviles y pantallas grandes.

## Funcionalidades

- Consulta de jugadoras, temporadas y multas.
- Búsqueda y vista detallada de cada jugadora.
- Catálogo de conceptos y consulta de la hucha del equipo.
- Acceso de staff para registrar y gestionar multas, pagos, gastos y temporadas.
- Actualización periódica de los datos mientras la aplicación está abierta.

La aplicación obtiene los datos de Supabase. Para utilizarla, necesitas acceso a un proyecto Supabase configurado para esta aplicación.

## Requisitos

- Node.js compatible con la versión de Vite del proyecto.
- npm.
- Un proyecto Supabase y sus credenciales publicables.

## Inicio rápido

1. Instala las dependencias:

   ```sh
   npm install
   ```

2. Crea un archivo `.env.local` en la raíz del proyecto con la URL del proyecto Supabase y su clave publicable:

   ```dotenv
   VITE_SUPABASE_URL=
   VITE_SUPABASE_PUBLISHABLE_KEY=
   ```

   Completa los valores desde la configuración de tu proyecto Supabase. No añadas comillas ni incluyas estas credenciales en el repositorio.

3. Inicia el servidor de desarrollo:

   ```sh
   npm run dev
   ```

   Vite mostrará en la terminal la dirección local para abrir la aplicación.

La base de datos debe estar preparada antes de usar la aplicación. Los scripts SQL versionados están en [`supabase/sql/`](supabase/sql/).

## Comandos

| Comando         | Descripción                                                       |
| --------------- | ----------------------------------------------------------------- |
| `npm run dev`   | Inicia el servidor local de desarrollo.                           |
| `npm test`      | Ejecuta las pruebas con Vitest.                                   |
| `npm run build` | Comprueba los tipos y genera la versión de producción en `dist/`. |

## Estructura del proyecto

```text
src/
  components/   Componentes de interfaz basados en Lit
  data/         Catálogo y tipos/datos de temporada
  lib/          Acceso a datos y lógica compartida
  styles/       Estilos globales y variables visuales
  main.ts       Punto de entrada de la aplicación
tests/          Pruebas automatizadas
supabase/sql/   Scripts SQL del backend
public/         Recursos estáticos
```
