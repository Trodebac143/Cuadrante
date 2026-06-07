-- CUADRANTE UPO4 V2.1 SIMPLE
-- Pega todo este bloque en Supabase > SQL Editor > New query > Run.
-- Esta versión evita funciones SQL y contraseñas cifradas para que la prueba sea más sencilla.

create extension if not exists pgcrypto;

-- Limpieza de versión anterior, si existe.
drop table if exists public.upo4_annotations cascade;
drop table if exists public.upo4_users cascade;
drop table if exists public.upo4_settings cascade;

create table public.upo4_settings (
  id integer primary key default 1,
  general_password text not null default '2026',
  updated_at timestamptz not null default now()
);

create table public.upo4_users (
  nip text primary key,
  password text,
  is_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.upo4_annotations (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nip text not null references public.upo4_users(nip) on update cascade,
  tipo text not null check (tipo in ('V','VA','AP','APA','Lc','FH','C')),
  hora_inicio text,
  hora_fin text,
  nip_cambio text,
  creado_por text,
  actualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fecha, nip)
);

insert into public.upo4_settings (id, general_password)
values (1, '2026');

insert into public.upo4_users (nip, password, is_admin, active) values
('56', null, false, true),
('114', null, false, true),
('221', null, false, true),
('101', null, false, true),
('143', '2302', true, true),
('215', null, false, true),
('145', null, false, true),
('146', null, false, true),
('193', null, false, true),
('214', null, false, true),
('223', null, false, true),
('41', null, false, true),
('190', null, false, true),
('151', null, false, true);

-- Permisos simples para la prueba con GitHub Pages.
-- La seguridad principal en esta V2.1 la hace la app. Es suficiente para probar, no para una versión definitiva.
alter table public.upo4_settings disable row level security;
alter table public.upo4_users disable row level security;
alter table public.upo4_annotations disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.upo4_settings to anon, authenticated;
grant select, insert, update, delete on public.upo4_users to anon, authenticated;
grant select, insert, update, delete on public.upo4_annotations to anon, authenticated;
