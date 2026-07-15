-- Cállate y Lanza — sitio v3 + repo. Pega en SQL Editor → Run. Idempotente.

-- Generador de sitio v3: el HTML de la landing se guarda aparte del copy (D5), para poder
-- previsualizarlo y regenerarlo sin tocar el entregable. Idempotente.
alter table projects add column if not exists landing_html   text;
alter table projects add column if not exists landing_preset text;

-- El sitio del cliente vive como repo de GitHub (fuente de verdad, editable, entregable).
alter table projects add column if not exists repo_url  text;
alter table projects add column if not exists repo_name text;
