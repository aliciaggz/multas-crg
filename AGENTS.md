# Multas CR Guindalera

Antes de actuar, lee `.specify/memory/constitution.md` y `specs/001-multas/{spec,plan,design,tasks}.md`. En tareas de base de datos, lee también `specs/001-multas/supabase-manual.md`.

Reglas de trabajo:

- Una sola tarea de `tasks.md` por sesión. No adelantes otras.
- Importes y reglas salen solo de `spec.md`. Las imágenes de `specs/001-multas/design/` son referencia visual (distribución, colores, tipografía). Si contradicen la spec, gana la spec. Ignora en las imágenes cualquier Bizum, objetivo de hucha, Face ID, fotos de jugadoras, perfil Capitanía, consecuencias de escalones e iconos de voleibol (el deporte es fútbol).
- En las tareas de reglas, escribe los tests primero y confirma que fallan antes de implementar.
- Stack: Lit + Vite + TypeScript. No añadas dependencias sin preguntarme.
- Muéstrame el plan de archivos antes de crear nada y el diff antes de dar la tarea por hecha.
- Textos de la interfaz en español.
- No tienes acceso a Supabase. Escribe los scripts SQL en `supabase/sql/` y espera a que yo los ejecute y te confirme el resultado.
- Nunca pidas ni uses clave secreta, service_role ni contraseña de la base de datos. El cliente solo usa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.
- Los requisitos de seguridad del SQL están en `supabase-manual.md`, sección 4. Cúmplelos.
- Al terminar cada tarea, dime qué pasos manuales me tocan y qué comprobación debo hacer.
