# Plan técnico: Multas CR Guindalera

## Stack

- **Frontend:** Lit + Vite (TypeScript)
- **PWA:** vite-plugin-pwa (manifest, service worker, instalable, lectura sin conexión)
- **Backend:** Supabase (Postgres + RLS + funciones SQL)
- **Hosting:** Netlify o Vercel (gratis, despliegue automático desde GitHub)
- **Tests:** Vitest para las reglas de cálculo

## Reparto de responsabilidades

| Qué                                                       | Dónde                                               | Por qué                                                              |
| --------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| Catálogo de multas (conceptos e importes)                 | Fijo en el repo (`src/data/catalogo.json`)          | Es el reglamento. Cambia una vez por temporada, con revisión en Git. |
| Reglas de cálculo (cortesía, escalones, plazo de 15 días) | Código en `src/lib/reglas.ts`                       | Lógica pura, testeable, sin base de datos.                           |
| Jugadoras, temporadas, multas registradas, pagos, hucha   | Supabase                                            | Datos que cambian y necesitan ser compartidos.                       |
| Acceso del staff (usuario + PIN)                          | Supabase (PIN como hash, comprobado en el servidor) | El PIN no puede vivir en el navegador.                               |

## Catálogo

Cada entrada: `id`, `grupo` (entreno | escalon | partido), `nombre`, `descripcion`, `importe`, `tipo` (fijo | por_prenda) y `cuenta_asistencia` (boolean). Los 18 conceptos de la spec.

**Modelo de confianza.** El catálogo vive en el código, así que la base de datos no lo conoce. `registrar_multa` guarda el importe que envía el entrenador autenticado. La protección es el PIN, el bloqueo por intentos y los campos de trazabilidad.

## Modelo de datos (Supabase)

```sql
create table temporadas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,             -- '2026/27'
  activa boolean not null default false,
  hucha_inicial numeric(8,2) not null default 0
);

create table jugadoras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                    -- solo nombre, sin apellidos
  dorsal int not null,
  capitana boolean not null default false, -- multiplicador x2
  activa boolean not null default true
);
create unique index jugadoras_dorsal_activa on jugadoras(dorsal) where activa;

create table multas (
  id uuid primary key default gen_random_uuid(),
  temporada_id uuid not null references temporadas(id),
  jugadora_id uuid not null references jugadoras(id),
  concepto_id text not null,               -- id del catálogo o 'ajuste_manual'
  importe numeric(8,2) not null check (importe >= 0), -- final, ya con x2 y cantidad
  multiplicador int not null default 1,
  cantidad int not null default 1,
  fecha date not null,
  observacion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','pago_declarado','pagada','anulada')),
  declarada_en timestamptz,                -- cuándo la jugadora declaró el pago
  fecha_pago date,
  cobrada_por text,                        -- entrenador que aceptó o cobró
  motivo_anulacion text,
  anulada_por text,
  registrada_por text not null,
  created_at timestamptz default now()
);
-- Cada escalón se cobra una sola vez por jugadora y temporada
create unique index multas_escalon_unico
  on multas(temporada_id, jugadora_id, concepto_id)
  where concepto_id in ('esc_3','esc_6','esc_9') and estado <> 'anulada';

create table gastos_hucha (
  id uuid primary key default gen_random_uuid(),
  temporada_id uuid not null references temporadas(id),
  fecha date not null,
  importe numeric(8,2) not null check (importe > 0),
  motivo text not null,
  registrado_por text not null,
  created_at timestamptz default now()
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  pin_hash text not null,                  -- crypt(pin, gen_salt('bf'))
  intentos_fallidos int not null default 0,
  bloqueado_hasta timestamptz
);
```

## Seguridad (RLS)

- Lectura pública de `temporadas`, `jugadoras`, `multas` y `gastos_hucha`.
- `staff`: sin ningún acceso público.
- Sin escritura directa desde el navegador. Todo pasa por funciones `security definer`.
- **Funciones con PIN** (reciben `usuario` y `pin`):
  - `login_staff(usuario, pin)`
  - `registrar_multa(usuario, pin, jugadora_id, concepto_id, importe, multiplicador, cantidad, fecha, observacion, pagada_ahora)`
  - `marcar_pagada(usuario, pin, multa_id, fecha_pago)`: cobro directo desde Pendiente.
  - `verificar_pago(usuario, pin, multa_id, aceptar, fecha_pago)`: solo sobre multas en `pago_declarado`. Si acepta, pasa a `pagada` con `fecha_pago` y `cobrada_por`. Si rechaza, vuelve a `pendiente` y borra `declarada_en`.
  - `anular_multa(usuario, pin, multa_id, motivo)`
  - `registrar_gasto(usuario, pin, temporada_id, importe, motivo, fecha)`
  - `editar_hucha_inicial(usuario, pin, temporada_id, importe)`
  - `crear_temporada(usuario, pin, nombre, hucha_inicial)`
- **Función pública, sin PIN:** `declarar_pago(multa_id)`. Es la única. Solo actúa si la multa está `pendiente`: pone `estado = 'pago_declarado'` y `declarada_en = now()`. No toca importes ni ningún otro campo. Si la multa no está pendiente, no hace nada.
- Las funciones con PIN verifican el hash. Tras 5 fallos, `bloqueado_hasta = now() + 1 minuto`. El error es genérico. Un acierto reinicia el contador.
- El PIN vive solo en la memoria de la pestaña durante la sesión.
- Las multas de 0 € se insertan con `estado = 'pagada'` y `fecha_pago = fecha`.
- Las fechas se evalúan en la zona horaria Europe/Madrid.

## Reglas que calcula el código (`reglas.ts`)

- **Llegada tarde a partidos:** hasta 5 min no genera multa. Del minuto 6 al 19, 3 €. A partir de 20 min, 7 € (sustituye, no suma).
- **Escalones de asistencia:** se cuentan las faltas de asistencia de la jugadora en la temporada. Al llegar a 3, 6 o 9, la app propone el escalón (4 €, 6 € u 8 €) y el staff confirma. Cada escalón se cobra una sola vez por temporada.
- **Plazo de 15 días:** calculado en la vista, no guardado. Pasado el plazo sin pagar, el importe se duplica y la jugadora aparece como no convocable.
- **Saldo de jugadora:** suma de multas pendientes de la temporada activa.
- **Hucha:** `hucha_inicial` + movimientos de la temporada.

## Reglas en `reglas.ts`

`importeRegistro(concepto, cantidad, capitana)`, `conceptoTardanzaPartido(minutos)`, `contarFaltas(multas)`, `escalonesPendientes(faltas, cobrados)`, `estaVencida(multa, hoy)`, `estadoMulta(multa, hoy)`, `importeActual(multa, hoy)`, `saldoJugadora(multas, hoy)`, `noConvocable(multas, hoy)`, `saldoHucha(inicial, multasPagadas, gastos)`.

Regla de vencimiento (spec, regla 7):
`estaVencida = (estado == 'pendiente' && hoy > fecha + 15 días) || (estado == 'pago_declarado' && declarada_en > fecha + 15 días)`

## Aviso al entrenador

- **v1:** insignia en el botón Staff con el número de multas en `pago_declarado` y pantalla "Pendientes de verificar". Los datos se refrescan al abrir la app y cada minuto mientras está abierta.
- **Después de v1 (push):** Web Push con service worker, tabla `push_suscripciones` (staff, endpoint, claves), claves VAPID y una Edge Function de Supabase disparada cuando una multa pasa a `pago_declarado`. En iPhone solo funciona con la PWA instalada en la pantalla de inicio (iOS 16.4 o superior).

## Estructura del repositorio

```
multas-crg/
├── .specify/memory/constitution.md
├── specs/001-multas/{spec,design,plan,tasks}.md
├── specs/001-multas/design/        ← imágenes de referencia
├── src/
│   ├── data/catalogo.json
│   ├── lib/{reglas.ts, supabase.ts}
│   ├── components/
│   └── main.ts
├── supabase/migrations/001_init.sql
├── tests/reglas.test.ts
├── public/
└── vite.config.ts
```

## Riesgos

- **Supabase pausa el plan gratuito tras 7 días sin actividad.** Mitigación: una tarea programada de GitHub Actions que haga una consulta cada pocos días.
- **PIN de 4 dígitos.** Mitigado con el bloqueo de 1 minuto tras 5 fallos.
- **Importe enviado por el cliente.** Mitigado con PIN, trazabilidad y posibilidad de anular.
- **Declaraciones de pago falsas.** Cualquiera puede declarar un pago, pero el entrenador siempre verifica, así que solo genera un aviso que se rechaza. Si hubiera abusos, se añade un límite.
- **Datos visibles para cualquiera con el enlace.** Solo nombre, dorsal y multas.
