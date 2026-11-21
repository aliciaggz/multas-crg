-- Crea las tablas, los índices y pgcrypto. Activa RLS y cierra los permisos iniciales.
-- Ejecutar antes de 002_permisos.sql. La temporada inicial se crea en M5.
begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.temporadas (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default false,
  hucha_inicial numeric(8,2) not null default 0 check (hucha_inicial <> 'NaN'::numeric),
  historial_hucha_inicial jsonb not null default '[]'::jsonb
    check (jsonb_typeof(historial_hucha_inicial) = 'array')
);

create unique index if not exists temporadas_activa_unica
  on public.temporadas (activa) where activa;

create table if not exists public.jugadoras (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  nombre text not null,
  dorsal integer not null,
  capitana boolean not null default false,
  activa boolean not null default true
);

create unique index if not exists jugadoras_dorsal_activa
  on public.jugadoras (dorsal) where activa;

create table if not exists public.multas (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  temporada_id uuid not null references public.temporadas (id),
  jugadora_id uuid not null references public.jugadoras (id),
  concepto_id text not null,
  importe numeric(8,2) not null check (importe >= 0 and importe <> 'NaN'::numeric),
  multiplicador integer not null default 1 check (multiplicador in (1, 2)),
  cantidad integer not null default 1 check (cantidad > 0),
  fecha date not null,
  observacion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pago_declarado', 'pagada', 'anulada')),
  declarada_en timestamptz,
  fecha_pago date,
  cobrada_por text,
  cobrada_en timestamptz,
  motivo_anulacion text,
  anulada_por text,
  anulada_en timestamptz,
  registrada_por text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists multas_escalon_unico
  on public.multas (temporada_id, jugadora_id, concepto_id)
  where concepto_id in ('esc_3', 'esc_6', 'esc_9') and estado <> 'anulada';

create table if not exists public.gastos_hucha (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  temporada_id uuid not null references public.temporadas (id),
  fecha date not null,
  importe numeric(8,2) not null check (importe > 0 and importe <> 'NaN'::numeric),
  motivo text not null,
  registrado_por text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  usuario text not null unique check (usuario = lower(usuario) and usuario ~ '^[^[:space:]]+$'),
  pin_hash text not null check (pin_hash ~ '^[$]2[aby][$][0-9]{2}[$][./A-Za-z0-9]{53}$'),
  intentos_fallidos integer not null default 0 check (intentos_fallidos between 0 and 5),
  bloqueado_hasta timestamptz
);

alter table public.temporadas enable row level security;
alter table public.jugadoras enable row level security;
alter table public.multas enable row level security;
alter table public.gastos_hucha enable row level security;
alter table public.staff enable row level security;

-- Algunos proyectos conceden permisos automáticamente a las tablas nuevas.
revoke all privileges on table
  public.temporadas, public.jugadoras, public.multas, public.gastos_hucha, public.staff
  from public, anon, authenticated;

commit;
