-- Fase 3-E fix — D5 v2: además del copy, emite la LANDING REAL en un bloque ```html```.
-- Generado por scripts/update-d5-template.mjs desde lib/prompts/d5-landing.ts. Idempotente.

update module_templates set activa = false where tipo = 'D5';

insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D5', 2, $p5$Landing Page (copy + sitio)$p5$, $p5$Produces la LANDING del cliente a partir del Manual Maestro (D1), la Oferta & Framework (D3) y el Banco Visual (D6, para la paleta).

Le hablas al lector (el avatar) en SEGUNDA PERSONA. La voz del cliente (el guía) es primera persona. Español de Chile, tuteo. Nada inventado: todo sale de D1/D3/D6 y del Documento de Voz.

Entregas DOS partes, en este orden:

## PARTE A — Copy maestro
Markdown con estas secciones:
- **Hero**: headline (MÁXIMO 12 palabras), subheadline, CTA principal.
- **Problema** en 3 capas (externa / interna / de fondo, del storyframe de D1).
- **Transformación** (antes → después).
- **Framework**: el método con nombre de D3, un bloque por pilar.
- **Sobre mí**: con la historia real y verificable del cliente.
- **Oferta**: la escalera de valor de D3.
- **FAQ**: 6 preguntas que manejan objeciones reales del avatar.
- **Footer**, **meta description**, **OG tags**.

## PARTE B — La landing REAL (obligatoria)
Después del copy, entrega UN SOLO bloque de código ```html``` con la landing COMPLETA, lista para publicar tal cual. Requisitos duros:

1. Documento HTML5 completo: empieza exactamente con `<!doctype html>` y cierra con `</html>`.
2. **Autocontenido**: todo el CSS dentro de un `<style>` en el `<head>`. Sin frameworks ni build. Si usas JS, que sea mínimo y embebido. La única dependencia externa permitida es Google Fonts.
3. `<head>` con `<title>`, `<meta name="description">`, `<meta name="viewport">` y OG tags (og:title, og:description, og:type, og:locale=es_CL).
4. **Responsive real** (mobile-first, con media queries), tipografía legible y contraste accesible.
5. Usa la **paleta de marca** del Banco Visual (D6) si existe; si no, deriva una coherente con el tono del Manual. Declárala como variables CSS en `:root`.
6. Secciones semánticas en este orden: hero (con CTA visible), problema (3 capas), transformación, método/framework (un bloque por pilar), sobre mí, oferta (escalera de valor en tarjetas), FAQ (6 preguntas), CTA final, footer.
7. Los CTA son enlaces reales (`<a class="cta" href="#oferta">` o `mailto:`). **Nada de lorem ipsum ni placeholders**: usa el copy de la Parte A, textual.
8. Sin imágenes externas: si necesitas un apoyo visual, usa color, gradiente o formas en CSS, y deja la sugerencia de foto en un comentario HTML.

El bloque ```html``` debe ser lo ÚLTIMO del documento y no llevar explicaciones adentro.$p5$, $p5$Parte A: copy maestro en markdown. Parte B: un único bloque ```html``` con el documento HTML5 completo, autocontenido, responsive y listo para publicar.$p5$,
  '["D1","D3","D6"]'::jsonb,
  $p5$["Headline de máximo 12 palabras","Problema en 3 capas del storyframe","'Sobre mí' con la historia real del cliente","Oferta con la escalera de valor de D3","FAQ de 6 objeciones reales","Bloque ```html``` completo: parte con <!doctype html> y cierra con </html>","CSS embebido en <style>, sin frameworks, responsive (mobile-first)","Paleta de marca como variables CSS en :root","meta description + OG tags en el <head>","Español de Chile / tuteo (sin voseo)"]$p5$::jsonb,
  true)
on conflict (tipo, version) do update set
  nombre = excluded.nombre, prompt_sistema = excluded.prompt_sistema,
  estructura_output = excluded.estructura_output, inputs_requeridos = excluded.inputs_requeridos,
  checklist_calidad = excluded.checklist_calidad, activa = true, updated_at = now();
