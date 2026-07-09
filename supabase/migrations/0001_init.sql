-- Cállate y Lanza — esquema inicial (spec §6). Full schema; Fase 1 uses a subset.
-- Requires Supabase (pgcrypto/gen_random_uuid available by default).

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
create type user_rol           as enum ('admin', 'operador', 'cliente');
create type project_estado     as enum ('onboarding', 'en_produccion', 'en_revision', 'entregado', 'activo_seguimiento', 'cerrado');
create type deliverable_tipo   as enum ('D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8');
create type deliverable_estado as enum ('pendiente', 'generando', 'borrador', 'en_edicion', 'listo_para_revision', 'aprobado', 'publicado', 'rechazado');
create type input_tipo         as enum ('transcripcion', 'conclusiones', 'foto_referencia', 'otro');
create type voice_estado       as enum ('borrador', 'en_edicion', 'aprobado');
create type generado_por       as enum ('ia', 'humano');
create type asset_tipo         as enum ('foto', 'video', 'pdf', 'otro');
create type library_seccion    as enum ('onboarding', 'curso1', 'curso2', 'curso3');

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table users (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  email      text unique not null,
  rol        user_rol not null default 'operador',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table clients (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text unique not null,
  email      text,
  ciudad     text,
  rubro      text,
  foto_url   text,
  user_id    uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table projects (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  nombre       text not null,
  estado       project_estado not null default 'onboarding',
  fecha_inicio date not null default current_date,
  fecha_dia7   date,
  paleta_marca jsonb,
  notas        text,
  created_at   timestamptz not null default now()
);
-- landing "día 7" deadline defaults to fecha_inicio + 7 days
create or replace function set_fecha_dia7() returns trigger language plpgsql as $$
begin
  if new.fecha_dia7 is null then new.fecha_dia7 := new.fecha_inicio + 7; end if;
  return new;
end $$;
create trigger trg_projects_dia7 before insert on projects
  for each row execute function set_fecha_dia7();

create table inputs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  tipo           input_tipo not null,
  titulo         text not null,
  contenido_texto text,
  file_url       text,
  subido_por     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table voice_docs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null unique references projects(id) on delete cascade,
  lexicon        jsonb not null default '[]',
  citas_canon    jsonb not null default '[]',
  registro_si_no jsonb not null default '{"si": [], "no": []}',
  lineas_rojas   jsonb not null default '[]',
  estado         voice_estado not null default 'borrador',
  version        int not null default 1,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create table module_templates (
  id                uuid primary key default gen_random_uuid(),
  tipo              deliverable_tipo not null,
  version           int not null default 1,
  nombre            text not null,
  prompt_sistema    text not null,
  estructura_output text,
  inputs_requeridos jsonb not null default '[]',   -- e.g. ["D0"] deliverable tipos this module reads
  checklist_calidad jsonb not null default '[]',   -- array of strings
  activa            boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tipo, version)
);
-- at most one active version per module tipo
create unique index module_templates_one_active on module_templates (tipo) where activa;

create table deliverables (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  tipo           deliverable_tipo not null,
  titulo         text not null,
  estado         deliverable_estado not null default 'pendiente',
  contenido_md   text,
  version_actual int not null default 0,
  aprobado_por   uuid references users(id) on delete set null,
  aprobado_at    timestamptz,
  publicado_at   timestamptz,
  pdf_url        text,
  orden          int not null default 0,
  gate_bloqueado boolean not null default false,  -- D2-D8 start blocked until D1 aprobado
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, tipo)
);

create table deliverable_versions (
  id                      uuid primary key default gen_random_uuid(),
  deliverable_id          uuid not null references deliverables(id) on delete cascade,
  version                 int not null,
  contenido_md            text not null default '',
  generado_por            generado_por not null,
  prompt_template_version int,
  instrucciones           text,          -- operator's extra instructions for this generation
  created_by              uuid references users(id) on delete set null,
  created_at              timestamptz not null default now(),
  unique (deliverable_id, version)
);

create table assets (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  deliverable_id uuid references deliverables(id) on delete set null,
  tipo           asset_tipo not null,
  categoria      text,
  file_url       text not null,
  aprobado       boolean not null default false,
  publicado      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table library_items (
  id          uuid primary key default gen_random_uuid(),
  seccion     library_seccion not null,
  titulo      text not null,
  embed_url   text,
  descripcion text,
  orden       int not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table comments (
  id             uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  user_id        uuid references users(id) on delete set null,
  texto          text not null,
  resuelto       boolean not null default false,
  created_at     timestamptz not null default now()
);

create table activity_log (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id    uuid references users(id) on delete set null,
  accion     text not null,
  detalle    text,
  created_at timestamptz not null default now()
);

create index idx_projects_client       on projects(client_id);
create index idx_inputs_project        on inputs(project_id);
create index idx_deliverables_project  on deliverables(project_id);
create index idx_versions_deliverable  on deliverable_versions(deliverable_id);
create index idx_assets_project        on assets(project_id);
create index idx_activity_project      on activity_log(project_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers & invariants
-- ─────────────────────────────────────────────────────────────────────────────
-- role lookup that bypasses RLS (avoids recursive policies on users)
create or replace function public.user_rol(uid uuid)
  returns user_rol language sql stable security definer set search_path = public as $$
  select rol from public.users where id = uid
$$;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.user_rol(auth.uid()) in ('admin', 'operador')
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.user_rol(auth.uid()) = 'admin'
$$;

-- DB-level gate: a deliverable can only reach 'aprobado' if its approver is an admin.
create or replace function public.enforce_approval_gate() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.estado = 'aprobado' and old.estado is distinct from 'aprobado' then
    if new.aprobado_por is null or public.user_rol(new.aprobado_por) <> 'admin' then
      raise exception 'Solo un admin puede aprobar un entregable';
    end if;
    if new.aprobado_at is null then new.aprobado_at := now(); end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_deliverables_gate before update on deliverables
  for each row execute function public.enforce_approval_gate();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table users                enable row level security;
alter table clients              enable row level security;
alter table projects             enable row level security;
alter table inputs               enable row level security;
alter table voice_docs           enable row level security;
alter table module_templates     enable row level security;
alter table deliverables         enable row level security;
alter table deliverable_versions enable row level security;
alter table assets               enable row level security;
alter table library_items        enable row level security;
alter table comments             enable row level security;
alter table activity_log         enable row level security;

-- users: any authenticated user may read names; only admin manages.
create policy users_select on users for select to authenticated using (true);
create policy users_admin  on users for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- staff (admin+operador) get full CRUD on production tables.
-- Approval on deliverables is additionally constrained by the enforce_approval_gate trigger.
do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','inputs','voice_docs','deliverables',
    'deliverable_versions','assets','comments','activity_log'
  ] loop
    execute format(
      'create policy %1$s_staff on %1$s for all to authenticated using (public.is_staff()) with check (public.is_staff());',
      t);
  end loop;
end $$;

-- module_templates: staff read, admin write (prompts-as-data admin panel).
create policy templates_select on module_templates for select to authenticated using (public.is_staff());
create policy templates_admin  on module_templates for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- library: staff manage; clients read active (portal, Fase 3).
create policy library_staff  on library_items for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy library_client on library_items for select to authenticated using (activo);

-- client portal (Fase 3): a cliente sees only their own published deliverables/assets.
create policy deliverables_client on deliverables for select to authenticated using (
  estado = 'publicado' and exists (
    select 1 from projects p join clients c on c.id = p.client_id
    where p.id = deliverables.project_id and c.user_id = auth.uid()
  )
);
create policy assets_client on assets for select to authenticated using (
  publicado and exists (
    select 1 from projects p join clients c on c.id = p.client_id
    where p.id = assets.project_id and c.user_id = auth.uid()
  )
);
