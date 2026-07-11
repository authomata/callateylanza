-- Generador de sitio v3: el HTML de la landing se guarda aparte del copy (D5), para poder
-- previsualizarlo y regenerarlo sin tocar el entregable. Idempotente.
alter table projects add column if not exists landing_html   text;
alter table projects add column if not exists landing_preset text;
