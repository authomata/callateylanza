-- ============================================================================
-- Cállate y Lanza — Fase 2. Pega TODO esto en Supabase → SQL Editor → Run.
-- Agrega: override de camino, tabla notifications, y prompts reales D2–D8.
-- Idempotente (usa IF NOT EXISTS / on conflict). Seguro de re-correr.
-- ============================================================================

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

-- ─── 0004_templates_v2 ───

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
