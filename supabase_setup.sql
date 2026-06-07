-- CUADRANTE UPO4 · Base compartida Supabase
-- Ejecutar completo en Supabase > SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table if not exists public.upo4_settings (
  id integer primary key default 1,
  general_password_hash text not null,
  updated_at timestamptz not null default now(),
  constraint upo4_settings_single_row check (id = 1)
);

create table if not exists public.upo4_users (
  nip text primary key,
  password_hash text,
  is_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.upo4_sessions (
  token uuid primary key default gen_random_uuid(),
  nip text not null references public.upo4_users(nip),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.upo4_annotations (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nip text not null references public.upo4_users(nip),
  tipo text not null check (tipo in ('V', 'VA', 'AP', 'APA', 'Lc', 'FH', 'C')),
  hora_inicio text,
  hora_fin text,
  nip_cambio text,
  creado_por text not null,
  actualizado_por text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fecha, nip)
);

alter table public.upo4_settings enable row level security;
alter table public.upo4_users enable row level security;
alter table public.upo4_sessions enable row level security;
alter table public.upo4_annotations enable row level security;

insert into public.upo4_settings (id, general_password_hash)
values (1, crypt('2026', gen_salt('bf')))
on conflict (id) do nothing;

insert into public.upo4_users (nip, password_hash, is_admin, active) values
('56', null, false, true),
('114', null, false, true),
('221', null, false, true),
('101', null, false, true),
('143', crypt('2302', gen_salt('bf')), true, true),
('215', null, false, true),
('145', null, false, true),
('146', null, false, true),
('193', null, false, true),
('214', null, false, true),
('223', null, false, true),
('41', null, false, true),
('190', null, false, true),
('151', null, false, true)
on conflict (nip) do nothing;

create or replace function public.upo4_active_nips()
returns table (nip text)
language sql
security definer
set search_path = public
as $$
  select u.nip
  from public.upo4_users u
  where u.active = true
  order by u.nip::integer;
$$;

create or replace function public.upo4_login(p_nip text, p_password text)
returns table (token uuid, nip text, is_admin boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.upo4_users%rowtype;
  v_general_hash text;
  v_hash text;
  v_token uuid;
begin
  delete from public.upo4_sessions where expires_at < now();

  select * into v_user
  from public.upo4_users
  where upo4_users.nip = p_nip and active = true;

  if not found then
    return;
  end if;

  select general_password_hash into v_general_hash
  from public.upo4_settings
  where id = 1;

  v_hash := coalesce(v_user.password_hash, v_general_hash);

  if v_hash is null or crypt(p_password, v_hash) <> v_hash then
    return;
  end if;

  insert into public.upo4_sessions (nip, is_admin)
  values (v_user.nip, v_user.is_admin)
  returning upo4_sessions.token into v_token;

  token := v_token;
  nip := v_user.nip;
  is_admin := v_user.is_admin;
  return next;
end;
$$;

create or replace function public.upo4_get_session(p_token uuid)
returns table (nip text, is_admin boolean)
language sql
security definer
set search_path = public
as $$
  select s.nip, s.is_admin
  from public.upo4_sessions s
  where s.token = p_token and s.expires_at > now();
$$;

create or replace function public.upo4_get_annotations(p_token uuid, p_year integer, p_month integer)
returns table (
  id uuid,
  fecha date,
  nip text,
  tipo text,
  hora_inicio text,
  hora_fin text,
  nip_cambio text,
  creado_por text,
  actualizado_por text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_start date;
  v_end date;
begin
  select * into v_session from public.upo4_get_session(p_token) limit 1;
  if not found then
    raise exception 'Sesión no válida';
  end if;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month')::date;

  return query
  select a.id, a.fecha, a.nip, a.tipo, a.hora_inicio, a.hora_fin, a.nip_cambio,
         a.creado_por, a.actualizado_por, a.created_at, a.updated_at
  from public.upo4_annotations a
  where a.fecha >= v_start and a.fecha < v_end
  order by a.fecha, a.nip::integer;
end;
$$;

create or replace function public.upo4_save_annotation(
  p_token uuid,
  p_fecha date,
  p_nip text,
  p_tipo text,
  p_hora_inicio text default null,
  p_hora_fin text default null,
  p_nip_cambio text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_target_exists boolean;
begin
  select * into v_session from public.upo4_get_session(p_token) limit 1;
  if not found then
    raise exception 'Sesión no válida';
  end if;

  if not v_session.is_admin and v_session.nip <> p_nip then
    raise exception 'Sin permiso para editar anotaciones de otro NIP';
  end if;

  if p_tipo not in ('V', 'VA', 'AP', 'APA', 'Lc', 'FH', 'C') then
    raise exception 'Tipo no válido';
  end if;

  select exists(select 1 from public.upo4_users where nip = p_nip and active = true) into v_target_exists;
  if not v_target_exists then
    raise exception 'NIP no habilitado';
  end if;

  if p_tipo = 'FH' and (coalesce(p_hora_inicio, '') = '' or coalesce(p_hora_fin, '') = '') then
    raise exception 'FH requiere hora de inicio y fin';
  end if;

  if p_tipo = 'C' and coalesce(p_nip_cambio, '') = '' then
    raise exception 'C requiere NIP de cambio';
  end if;

  insert into public.upo4_annotations (
    fecha, nip, tipo, hora_inicio, hora_fin, nip_cambio, creado_por, actualizado_por
  ) values (
    p_fecha,
    p_nip,
    p_tipo,
    case when p_tipo = 'FH' then p_hora_inicio else null end,
    case when p_tipo = 'FH' then p_hora_fin else null end,
    case when p_tipo = 'C' then p_nip_cambio else null end,
    v_session.nip,
    v_session.nip
  )
  on conflict (fecha, nip) do update set
    tipo = excluded.tipo,
    hora_inicio = excluded.hora_inicio,
    hora_fin = excluded.hora_fin,
    nip_cambio = excluded.nip_cambio,
    actualizado_por = v_session.nip,
    updated_at = now();
end;
$$;

create or replace function public.upo4_delete_annotation(p_token uuid, p_annotation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_annotation record;
begin
  select * into v_session from public.upo4_get_session(p_token) limit 1;
  if not found then
    raise exception 'Sesión no válida';
  end if;

  select * into v_annotation from public.upo4_annotations where id = p_annotation_id;
  if not found then
    return;
  end if;

  if not v_session.is_admin and v_session.nip <> v_annotation.nip then
    raise exception 'Sin permiso para borrar esta anotación';
  end if;

  delete from public.upo4_annotations where id = p_annotation_id;
end;
$$;

create or replace function public.upo4_admin_create_user(p_token uuid, p_nip text, p_password text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_hash text;
begin
  select * into v_session from public.upo4_get_session(p_token) limit 1;
  if not found or not v_session.is_admin then
    raise exception 'Solo administrador';
  end if;

  if coalesce(trim(p_nip), '') = '' then
    raise exception 'NIP obligatorio';
  end if;

  v_hash := case when coalesce(p_password, '') = '' then null else crypt(p_password, gen_salt('bf')) end;

  insert into public.upo4_users (nip, password_hash, is_admin, active)
  values (p_nip, v_hash, false, true)
  on conflict (nip) do update set
    password_hash = coalesce(v_hash, upo4_users.password_hash),
    active = true,
    updated_at = now();
end;
$$;

create or replace function public.upo4_admin_change_general_password(p_token uuid, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  select * into v_session from public.upo4_get_session(p_token) limit 1;
  if not found or not v_session.is_admin then
    raise exception 'Solo administrador';
  end if;

  if length(coalesce(p_new_password, '')) < 3 then
    raise exception 'Contraseña demasiado corta';
  end if;

  update public.upo4_settings
  set general_password_hash = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.upo4_admin_delete_month(p_token uuid, p_year integer, p_month integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_start date;
  v_end date;
begin
  select * into v_session from public.upo4_get_session(p_token) limit 1;
  if not found or not v_session.is_admin then
    raise exception 'Solo administrador';
  end if;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month')::date;

  delete from public.upo4_annotations
  where fecha >= v_start and fecha < v_end;
end;
$$;

revoke all on table public.upo4_settings from anon, authenticated;
revoke all on table public.upo4_users from anon, authenticated;
revoke all on table public.upo4_sessions from anon, authenticated;
revoke all on table public.upo4_annotations from anon, authenticated;

grant execute on function public.upo4_active_nips() to anon;
grant execute on function public.upo4_login(text, text) to anon;
grant execute on function public.upo4_get_annotations(uuid, integer, integer) to anon;
grant execute on function public.upo4_save_annotation(uuid, date, text, text, text, text, text) to anon;
grant execute on function public.upo4_delete_annotation(uuid, uuid) to anon;
grant execute on function public.upo4_admin_create_user(uuid, text, text) to anon;
grant execute on function public.upo4_admin_change_general_password(uuid, text) to anon;
grant execute on function public.upo4_admin_delete_month(uuid, integer, integer) to anon;
