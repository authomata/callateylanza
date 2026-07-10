-- Cállate y Lanza — setup completo (fresh install). Pega en SQL Editor → Run.

-- ─── 0001_init.sql ───

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

-- ─── 0002_auth_hook.sql ───

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

-- ─── 0003_fase2.sql ───

-- Fase 2 — override de camino + notificaciones.

-- Override admin del gate de dependencias (botón "Desbloquear").
alter table deliverables add column if not exists desbloqueo_manual boolean not null default false;

-- Notificaciones (campanita). Dirigidas a un rol (ej. todos los operadores) o a un user puntual.
create table if not exists notifications (
  id             uuid primary key default gen_random_uuid(),
  target_rol     user_rol,
  user_id        uuid references users(id) on delete cascade,
  project_id     uuid references projects(id) on delete cascade,
  deliverable_id uuid references deliverables(id) on delete cascade,
  tipo           text not null,
  texto          text not null,
  leido          boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_notif_target on notifications (target_rol, leido, created_at desc);
create index if not exists idx_notif_user on notifications (user_id, leido, created_at desc);

alter table notifications enable row level security;

-- staff ve/actualiza las dirigidas a su rol o a su propio user_id; staff puede insertarlas.
drop policy if exists notif_read on notifications;
create policy notif_read on notifications for select to authenticated using (
  public.is_staff() and (target_rol = public.user_rol(auth.uid()) or user_id = auth.uid())
);
drop policy if exists notif_update on notifications;
create policy notif_update on notifications for update to authenticated using (
  public.is_staff() and (target_rol = public.user_rol(auth.uid()) or user_id = auth.uid())
);
drop policy if exists notif_insert on notifications;
create policy notif_insert on notifications for insert to authenticated with check (public.is_staff());

-- ─── 0004_templates_v2.sql ───

-- Fase 2 — activar generadores D2–D8 con prompts v1 reales (destilados de spec §5).
-- inputs_requeridos siguen el DAG de lib/pipeline.ts. Idempotente (upsert por tipo,version).

-- Helper: upsert que activa la versión 1 con contenido real.
-- (Se repite por módulo con on conflict do update.)

-- ── D3 — Oferta & Framework ──────────────────────────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D3', 1, 'Oferta & Framework',
$p$Diseñas la OFERTA y el FRAMEWORK del cliente a partir del Manual Maestro (D1) aprobado y del Documento de Voz. Le hablas al cliente en segunda persona; citas sus palabras textuales. Español de Chile, tuteo. Todo trazable; nada inventado.

Produce en markdown:
1. **Método propio con nombre** — un framework de 3–5 pilares con nombre memorable, tagline, y la frase diferenciadora "a diferencia de X, mi método Y porque Z".
2. **Escalera de valor completa** — lead magnet gratis → producto puerta de entrada → producto core → premium/1:1. Cada peldaño con: nombre, precio sugerido (CLP), formato, promesa concreta y contenido.
3. **Rito de entrada** — filtro de calificación de clientes que protege el tiempo del cliente y eleva la percepción de valor.
4. **Stack de valor del producto core** — estilo Hormozi pero sin exagerar; cada componente con su valor percibido.
5. **Mensajes** — elevator pitch, frase de autoridad, statement diferenciador.
6. **CTAs por nivel** — suave / medio / fuerte, ninguno rompe el tono de la marca.
7. **Naming** — 3 opciones para el producto core con justificación breve de cada una.$p$,
$e$Markdown con las 7 secciones. Precios en CLP. Segunda persona + citas textuales.$e$,
'["D1"]'::jsonb,
$c$["Método con nombre + frase 'a diferencia de X, mi método Y porque Z'","Escalera de 4 peldaños con precio, formato y promesa","Rito de entrada explícito","CTAs suave/medio/fuerte sin romper tono","3 nombres para el core justificados","Español de Chile / tuteo (sin voseo)"]$c$::jsonb,
true)
on conflict (tipo, version) do update set nombre=excluded.nombre, prompt_sistema=excluded.prompt_sistema, estructura_output=excluded.estructura_output, inputs_requeridos=excluded.inputs_requeridos, checklist_calidad=excluded.checklist_calidad, activa=true, updated_at=now();

-- ── D6 — Banco Visual ────────────────────────────────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D6', 1, 'Banco Visual',
$p$Diseñas el BANCO VISUAL del cliente a partir del Manual Maestro (D1) y su paleta/tono de marca. Español de Chile, tuteo, en la parte de instrucciones; los prompts de imagen van en inglés técnico.

Produce en markdown:
1. **Paleta de marca** — 3–4 colores con hex, derivados del tono de la marca (justifica cada uno en una línea).
2. **15 prompts** organizados en 3 categorías (Autoridad / Cercano y humano / Contenido y redes), 5 por categoría. Cada prompt: nombre, uso sugerido, y el prompt completo en inglés técnico.
   OBLIGATORIO en TODOS los prompts, textual: "preserving his/her exact facial features, expression, skin tone and identity, do not alter features" y "natural skin texture, no beauty filter, no plastic smoothing".
3. **Instrucciones de uso** — subir foto real como referencia, generar 3–4 variaciones; herramientas: Higgsfield / Nano Banana Pro / Midjourney.
4. **Guía de personalización** — ropa, fondos, iluminación, expresiones, ángulos.
5. **Combinaciones recomendadas** por plataforma.$p$,
$e$Markdown. Paleta con hex. 15 prompts (3×5) en inglés técnico, cada uno con las 2 frases obligatorias de preservación de identidad y textura de piel.$e$,
'["D1"]'::jsonb,
$c$["Paleta 3-4 colores con hex justificados","15 prompts (5 por categoría)","TODOS los prompts incluyen preservación de identidad + textura de piel natural","Prompts en inglés técnico","Instrucciones de uso y herramientas"]$c$::jsonb,
true)
on conflict (tipo, version) do update set nombre=excluded.nombre, prompt_sistema=excluded.prompt_sistema, estructura_output=excluded.estructura_output, inputs_requeridos=excluded.inputs_requeridos, checklist_calidad=excluded.checklist_calidad, activa=true, updated_at=now();

-- ── D4 — Masterclass / Lead Magnet ───────────────────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D4', 1, 'Masterclass / Lead Magnet',
$p$Creas la MASTERCLASS / LEAD MAGNET (slides) a partir del Manual Maestro (D1) y la Oferta & Framework (D3). Listo para pegar en Gamma. Segunda persona al cliente; citas textuales. Español de Chile, tuteo. Reflexión anclada.

Produce en markdown, slide por slide (14–16 slides):
portada → introducción emocional → cambio de paradigma → errores comunes → framework general → un slide por cada pilar del método (D3) → conexión entre pilares → ejercicio práctico → herramientas → casos → cierre inspirador → CTA hacia la escalera de valor (D3) → autoridad.
Cada slide: **título** + 5–7 bullets + **sugerencia visual**.
Después de las slides:
- **Guion narrativo** para versión video (apertura, desarrollo, cierre).
- **Metadata**: título completo, duración estimada, keywords, thumbnail sugerido.$p$,
$e$14–16 slides (título + 5-7 bullets + sugerencia visual c/u) + guion de video + metadata. Formato pegable en Gamma.$e$,
'["D1","D3"]'::jsonb,
$c$["14-16 slides con un slide por pilar del método","Cada slide: título + 5-7 bullets + sugerencia visual","CTA hacia la escalera de valor de D3","Guion narrativo para video","Metadata completa (título, duración, keywords, thumbnail)","Español de Chile / tuteo (sin voseo)"]$c$::jsonb,
true)
on conflict (tipo, version) do update set nombre=excluded.nombre, prompt_sistema=excluded.prompt_sistema, estructura_output=excluded.estructura_output, inputs_requeridos=excluded.inputs_requeridos, checklist_calidad=excluded.checklist_calidad, activa=true, updated_at=now();

-- ── D2 — Plan de Medios + Calendario 60 días ─────────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D2', 1, 'Plan de Medios + Calendario 60d',
$p$Creas el PLAN DE MEDIOS + CALENDARIO 60 DÍAS a partir del Manual Maestro (D1), la Oferta & Framework (D3) y la Masterclass/Lead Magnet (D4). El calendario DEBE integrar la oferta y el lead magnet: hay piezas que promueven el lead magnet, presentan el método y conducen a la escalera de valor. Segunda persona; citas textuales. Español de Chile, tuteo.

REGLA DURA: cada pieza del calendario lleva un **Ancla** no vacía — un hecho, historia o caso real del cliente (referencia las historias de la materia prima D0). Ninguna reflexión flota.

## Parte 1 — Plan de medios (estrategia)
- Mezcla de contenido con % y pilares (ej. 35% historia anclada, 30% día a día, 20% postura, 15% humano).
- Canales con rol estratégico, qué vive en cada uno, frecuencia.
- El principio de los dos registros (Instagram humano / LinkedIn autoridad).
- Esqueleto semanal (plantilla, no camisa de fuerza).
- Sistema de producción batch: reparto explícito (minutos/semana del cliente, qué sostiene el equipo, qué hace el asistente IA).
- Métricas con criterio (conversaciones que abre > vistas; quién recomienda; consistencia; engagement por formato).
- Curva de arranque: primeras 4 semanas.

## Parte 2 — Calendario 60 días (operativo)
60 días en semanas temáticas con arco narrativo (S1 quién soy → S2 de dónde vengo → S3 lo que veo → S4 hacia dónde voy → repetir profundizando en el mes 2). Incluye piezas que activan el lead magnet (D4) y la oferta (D3).
Cada pieza: **Día · Formato · Canal(es) · Pilar · Gancho** (primera línea que detiene el scroll) · **Ancla** (hecho/historia real, obligatoria) · **Bajada** (idea final).
Cierra con un **banco de 10+ ideas evergreen** de reserva.$p$,
$e$Dos partes: Plan (estrategia con % y sistema batch) + Calendario 60d (cada pieza con Día/Formato/Canal/Pilar/Gancho/Ancla/Bajada) + banco de 10+ evergreen.$e$,
'["D1","D3","D4"]'::jsonb,
$c$["Mezcla de contenido con % por pilar","Sistema de producción batch con reparto explícito","60 días con arco narrativo por semanas","CADA pieza tiene Gancho, Ancla (no vacía) y Bajada","El calendario integra lead magnet (D4) y oferta (D3)","Banco de 10+ evergreen","Español de Chile / tuteo (sin voseo)"]$c$::jsonb,
true)
on conflict (tipo, version) do update set nombre=excluded.nombre, prompt_sistema=excluded.prompt_sistema, estructura_output=excluded.estructura_output, inputs_requeridos=excluded.inputs_requeridos, checklist_calidad=excluded.checklist_calidad, activa=true, updated_at=now();

-- ── D5 — Landing Page (copy) ─────────────────────────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D5', 1, 'Landing Page (copy)',
$p$Escribes el COPY MAESTRO de la landing a partir del Manual Maestro (D1), la Oferta & Framework (D3) y el Banco Visual (D6) si existe. (El deploy del sitio es Fase 3; aquí produces el copy completo.) Segunda persona; usa la historia real del cliente. Español de Chile, tuteo. Headline ≤12 palabras.

Produce en markdown:
- **Hero**: headline (≤12 palabras), subheadline, CTA.
- **Problema** en 3 capas (externa / interna / de fondo, del storyframe de D1).
- **Transformación** (antes → después).
- **Framework** (el método de D3, resumido).
- **Sobre mí** — con la historia real del cliente (ancla biográfica).
- **Oferta** con la escalera de valor (D3).
- **FAQ** — 6 preguntas que manejan objeciones reales del avatar.
- **Footer**, **meta description**, **OG tags**.$p$,
$e$Copy maestro por secciones (hero, problema 3 capas, transformación, framework, sobre mí, oferta, FAQ 6, footer, meta, OG). Headline ≤12 palabras.$e$,
'["D1","D3","D6"]'::jsonb,
$c$["Headline de máximo 12 palabras","Problema en 3 capas del storyframe","'Sobre mí' con historia real del cliente","Oferta con escalera de valor de D3","FAQ de 6 objeciones reales","meta description + OG tags","Español de Chile / tuteo (sin voseo)"]$c$::jsonb,
true)
on conflict (tipo, version) do update set nombre=excluded.nombre, prompt_sistema=excluded.prompt_sistema, estructura_output=excluded.estructura_output, inputs_requeridos=excluded.inputs_requeridos, checklist_calidad=excluded.checklist_calidad, activa=true, updated_at=now();

-- ── D7 — System Prompt del Asistente ─────────────────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D7', 1, 'System Prompt del Asistente',
$p$Escribes el SYSTEM PROMPT del asistente de contenidos del cliente a partir del Manual Maestro (D1), el Plan de Medios (D2), la Oferta (D3) y el Documento de Voz. LÍMITE DURO: máximo 8.000 caracteres. Español de Chile, tuteo.

Estructura (calcada del Prompt Maestro real):
- **Identidad y contexto** — quién es el cliente, credenciales verificables.
- **Las 3 ideas posicionadoras / pilares** — todo contenido se desprende de una.
- **Voz y tono** — registro (ej. "analítico-revelador, NUNCA motivacional"), lista NO usar / SÍ usar, expresiones características (del lexicón del Documento de Voz), estructura de contenido (gancho → ancla → bajada).
- **Formatos de salida por canal** con límites de palabras (video LinkedIn ≤200, video IG ≤120, post LinkedIn 150–250…).
- **Instrucción de uso y comportamiento** — detectar canal, preguntar si falta info, cerrar ofreciendo ajuste.
- **Instalación** — cómo cargarlo en Claude Project o Custom GPT.

El output es el archivo listo para pegar. No superes 8.000 caracteres.$p$,
$e$Archivo de texto ≤8.000 caracteres con identidad, 3 pilares, voz/tono (NO/SÍ + lexicón), formatos por canal con límites, uso e instalación.$e$,
'["D1","D2","D3"]'::jsonb,
$c$["≤ 8.000 caracteres (validación dura)","3 ideas posicionadoras","Voz y tono con listas NO usar / SÍ usar + lexicón","Formatos por canal con límites de palabras","Instrucciones de instalación (Claude Project / Custom GPT)","Español de Chile / tuteo (sin voseo)"]$c$::jsonb,
true)
on conflict (tipo, version) do update set nombre=excluded.nombre, prompt_sistema=excluded.prompt_sistema, estructura_output=excluded.estructura_output, inputs_requeridos=excluded.inputs_requeridos, checklist_calidad=excluded.checklist_calidad, activa=true, updated_at=now();

-- ── D8 — 6 Videos Verticales (guiones) ───────────────────────────────────────
insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D8', 1, '6 Videos Verticales',
$p$Escribes 6 GUIONES de video vertical (30–90 seg) a partir del Manual Maestro (D1), el Plan de Medios/Calendario (D2) y el Documento de Voz. Cada guion sale de una pieza del calendario D2. Español de Chile, tuteo.

REGLA DURA: cada guion sigue Gancho → Ancla → Bajada, con el Ancla no vacía (hecho/historia real del cliente).

Para cada uno de los 6 videos:
- **Pieza del calendario D2** de la que sale.
- **Gancho hablado** (primeros 3 segundos).
- **Desarrollo**.
- **Cierre**.
- **Prompt de producción**: si es con avatar/clon (HeyGen/Higgsfield) o sin el cliente (video IA puro), con especificaciones técnicas (vertical 9:16, subtítulos, duración).

Cierra con una **nota de pauta**: los 6 quedan listos para ponerles ads desde la semana 1.
(La producción y subida de los .mp4 es Fase 3.)$p$,
$e$6 guiones verticales (pieza D2, gancho hablado, desarrollo, cierre, prompt de producción 9:16) + nota de pauta.$e$,
'["D1","D2"]'::jsonb,
$c$["6 guiones, cada uno ligado a una pieza del calendario D2","Cada guion sigue Gancho → Ancla (no vacía) → Bajada","Prompt de producción con specs 9:16 + subtítulos + duración","Nota de pauta para ads","Español de Chile / tuteo (sin voseo)"]$c$::jsonb,
true)
on conflict (tipo, version) do update set nombre=excluded.nombre, prompt_sistema=excluded.prompt_sistema, estructura_output=excluded.estructura_output, inputs_requeridos=excluded.inputs_requeridos, checklist_calidad=excluded.checklist_calidad, activa=true, updated_at=now();

-- ─── 0005_fase3.sql ───

-- Fase 3 — entrega y portal. Idempotente.

-- Landing (D5) self-service por cliente: guarda su token de Netlify + el site desplegado.
alter table projects add column if not exists netlify_token   text;
alter table projects add column if not exists netlify_site_id text;
alter table projects add column if not exists landing_url      text;

-- ── Storage: bucket público de assets (fotos D6 / videos D8 / pdfs) ──────────
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

drop policy if exists "assets staff write"  on storage.objects;
drop policy if exists "assets staff update" on storage.objects;
drop policy if exists "assets staff delete" on storage.objects;
drop policy if exists "assets public read"  on storage.objects;

create policy "assets staff write"  on storage.objects for insert to authenticated with check (bucket_id = 'assets' and public.is_staff());
create policy "assets staff update" on storage.objects for update to authenticated using (bucket_id = 'assets' and public.is_staff());
create policy "assets staff delete" on storage.objects for delete to authenticated using (bucket_id = 'assets' and public.is_staff());
create policy "assets public read"  on storage.objects for select using (bucket_id = 'assets');

-- ── RLS del portal: el cliente lee SU cliente y SU proyecto ──────────────────
-- (deliverables/assets publicados y library_items activos ya tienen policy desde 0001.)
drop policy if exists clients_owner on clients;
create policy clients_owner on clients for select to authenticated
  using (user_id = auth.uid());

drop policy if exists projects_client on projects;
create policy projects_client on projects for select to authenticated
  using (exists (
    select 1 from clients c where c.id = projects.client_id and c.user_id = auth.uid()
  ));

-- ─── 0006_landing.sql ───

-- Fase 3-E — Landing (D5) en dos pasos:
--   1) deploy inmediato a la cuenta Netlify de Andrés (entrega rápida)
--   2) traspaso: re-deploy a la cuenta Netlify del propio cliente (queda en su poder)
-- Idempotente.

-- site en la cuenta de Andrés → projects.netlify_site_id (ya existe desde 0005)
-- site en la cuenta del cliente:
alter table projects add column if not exists netlify_client_site_id text;

-- de quién es la URL vigente: 'andres' | 'cliente'
alter table projects add column if not exists landing_owner text;

-- projects.netlify_token (token personal del cliente) ya existe desde 0005.
-- NUNCA se expone al browser: solo se lee server-side con service role.

-- ─── seed (D0/D1) ───

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
