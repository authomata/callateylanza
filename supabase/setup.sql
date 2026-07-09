-- ============================================================================
-- Cállate y Lanza — setup completo. Pega TODO esto en Supabase → SQL Editor → Run.
-- Genera: esquema + RLS + hook de auth + plantillas D0/D1. (Ejecutar una vez.)
-- ============================================================================

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

-- ─── 0002_auth_hook ───

-- Auto-provision a public.users row whenever someone authenticates for the first time.
-- Role is derived from an admin allowlist; everyone else starts as 'operador'.
-- (Clients get their role set to 'cliente' by the app when their project is created.)
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  assigned user_rol := 'operador';
begin
  if new.email = any (array['andres@authomata.io']) then
    assigned := 'admin';
  end if;

  insert into public.users (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    assigned
  )
  on conflict (id) do nothing;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── seed (plantillas D0/D1) ───

-- Seed: module_templates v1 (D0 + D1 active, D2–D8 inactive stubs).
-- Prompts distilled from spec §5. Prompts-as-data: edit these from the admin panel, never in code.
-- Idempotent: safe to re-run.

-- ── D0 — Extracción & Documento de Voz (interno) ─────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D0', 1, 'Extracción & Documento de Voz',
$prompt$Eres el motor de extracción de "Cállate y Lanza". A partir de las transcripciones de las sesiones y del documento de conclusiones de Andrés, produces DOS cosas: (A) la MATERIA PRIMA estructurada del cliente y (B) el DOCUMENTO DE VOZ.

REGLA ABSOLUTA: nada se inventa. Todo dato, historia, cita o expresión proviene textualmente de las transcripciones o de las conclusiones. Si falta material para un campo, decláralo explícitamente como vacío a resolver — NUNCA lo rellenes con suposiciones.

Devuelve tu respuesta en dos bloques markdown claramente separados:

## A. MATERIA PRIMA
- **Datos base:** nombre, ciudad, rubro, trayectoria, hitos verificables.
- **Historias con potencial de ancla:** para cada una — título corto, resumen en 2-3 líneas, de qué sesión sale, y la cita textual asociada. Prioriza historias concretas y sensoriales (ej. "el avión sin comunicaciones", "el arriero de la cordillera").
- **Ejes de autoridad detectados:** los 3-4 pilares biográficos que existen pero están dispersos.
- **Tensiones / posturas:** lo que el cliente critica y lo que defiende.
- **Audiencia mencionada:** a quién quiere hablarle, con quién quiere sentarse.
- **Lo que explícitamente NO quiere ser.**
- **Preguntas abiertas / vacíos de información** para que Andrés los resuelva.

## B. DOCUMENTO DE VOZ
Devuelve también un bloque de código ```json``` con esta forma exacta, poblado SOLO con material textual:
{
  "lexicon": [{ "expresion": "", "significado": "", "de_donde_viene": "", "como_usarla": "" }],   // mínimo 6 entradas
  "citas_canon": [{ "cita": "", "contexto": "" }],
  "registro_si_no": { "si": ["suena a él..."], "no": ["nunca suena a él..."] },
  "muletillas": [""],
  "lineas_rojas": ["ej: de prácticas, nunca de personas"]
}

Español de Chile, tuteo. Operativo, no presentacional.$prompt$,
$est$Markdown con secciones "## A. MATERIA PRIMA" y "## B. DOCUMENTO DE VOZ" + un bloque ```json``` con el Documento de Voz estructurado.$est$,
'["transcripcion","conclusiones"]'::jsonb,
$chk$["Cada historia tiene cita textual y sesión de origen","Lexicón con mínimo 6 entradas textuales","Vacíos de información listados, no rellenados","Ninguna afirmación inventada: todo trazable a los insumos","Español de Chile / tuteo (sin voseo)"]$chk$::jsonb,
true)
on conflict (tipo, version) do update set
  nombre = excluded.nombre, prompt_sistema = excluded.prompt_sistema,
  estructura_output = excluded.estructura_output, inputs_requeridos = excluded.inputs_requeridos,
  checklist_calidad = excluded.checklist_calidad, activa = excluded.activa, updated_at = now();

-- ── D1 — Manual Maestro de Marca (fuente de verdad + GATE) ───────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D1', 1, 'Manual Maestro de Marca',
$prompt$Eres el redactor del Manual Maestro de Marca de "Cállate y Lanza": la fuente de verdad de la que se alimentan todos los demás entregables. Escribes a partir de la MATERIA PRIMA (D0) y el DOCUMENTO DE VOZ del cliente.

Le hablas al cliente en SEGUNDA PERSONA ("Marcelo, tienes...") y lo citas con sus PALABRAS TEXTUALES como epígrafes. La voz de Andrés, cuando aparece, es primera persona singular. Español de Chile, tuteo. Toda reflexión va anclada a un hecho, historia o caso real del cliente (Gancho → Ancla → Bajada). Nada se inventa: todo es trazable a D0 o al Documento de Voz.

Produce el documento en markdown con esta estructura calcada de los kits premium:

1. **Cómo leer y usar este documento** — dos niveles de lectura; qué NO contiene porque vive en otros entregables; regla: ante contradicción, gana el maestro.
2. **Síntesis ejecutiva en 1 página** — quién es, qué hace hoy, para quién, diferenciador, arquitectura arquetipal resumida, promesa de marca, movimiento estratégico inmediato.
3. **Diagnóstico** — los ejes de autoridad dispersos (con citas textuales); la brecha actual (2-3 problemas concretos y solucionables); la oportunidad de mercado (el lugar vacante).
4. **Sistema arquetipal** — Arquetipo rector (deseo central, por qué encaja con evidencia biográfica, **"por qué X y no Y"** contrastando con el vecino, sombra y antídoto); Arquetipo secundario (misma estructura); Dimensión cultural / cuota de voz (misma estructura); **Anti-arquetipo** (tabla "lo que NO es / lo que NO hace"); Personalidad de marca vs. personalidad de la audiencia.
5. **Storyframe** — protagonista (la audiencia como héroe), el problema en 3 capas (externa/interna/de fondo), el guía (el cliente, con autoridad vivida), la propuesta en una línea, CTAs escalonados sin venta evidente, éxito vs. fracaso.
6. **Identidad narrativa** — tono y estilo no negociables (tabla sí/no), técnica conversacional propia si existe, lexicón (referencia al Documento de Voz), claims y frases de poder (canon), **manifiesto versión larga y versión corta**.
7. **Sistema conceptual** — 5-6 pilares temáticos con qué cubre + ángulos de ejemplo + la regla editorial que los cruza (reflexión anclada).
8. **Anexo — Glosario operativo** para que operador y cliente hablen igual.

Empieza con una portada: nombre del cliente y una frase canon textual suya como epígrafe.$prompt$,
$est$Documento markdown de 8 secciones numeradas + portada con frase canon. Segunda persona al cliente; citas textuales como epígrafes.$est$,
'["D0"]'::jsonb,
$chk$["Portada con frase canon textual del cliente","Arquetipo rector con 'por qué X y no Y' y evidencia biográfica","Anti-arquetipo explícito (lo que NO es / NO hace)","Storyframe con problema en 3 capas","Manifiesto en versión larga y corta","5-6 pilares con regla de reflexión anclada","Segunda persona + epígrafes textuales","Español de Chile / tuteo (sin voseo)"]$chk$::jsonb,
true)
on conflict (tipo, version) do update set
  nombre = excluded.nombre, prompt_sistema = excluded.prompt_sistema,
  estructura_output = excluded.estructura_output, inputs_requeridos = excluded.inputs_requeridos,
  checklist_calidad = excluded.checklist_calidad, activa = excluded.activa, updated_at = now();

-- ── D2–D8 — stubs inactivos (Fase 2/3). Nombre + inputs; prompt se afina luego. ──
insert into module_templates (tipo, version, nombre, prompt_sistema, inputs_requeridos, activa) values
  ('D2', 1, 'Plan de Medios + Calendario 60 días', 'PENDIENTE — afinar en Fase 2.', '["D1"]'::jsonb, false),
  ('D3', 1, 'Oferta & Framework',                  'PENDIENTE — afinar en Fase 2.', '["D1"]'::jsonb, false),
  ('D4', 1, 'Masterclass / Lead Magnet',           'PENDIENTE — afinar en Fase 2.', '["D1","D3"]'::jsonb, false),
  ('D5', 1, 'Landing Page',                        'PENDIENTE — afinar en Fase 3.', '["D1","D3"]'::jsonb, false),
  ('D6', 1, 'Banco Visual',                        'PENDIENTE — afinar en Fase 3.', '["D1"]'::jsonb, false),
  ('D7', 1, 'System Prompt del Asistente',         'PENDIENTE — afinar en Fase 2.', '["D1","D2","D3"]'::jsonb, false),
  ('D8', 1, '6 Videos Verticales',                 'PENDIENTE — afinar en Fase 3.', '["D1","D2"]'::jsonb, false)
on conflict (tipo, version) do nothing;
