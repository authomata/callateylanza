-- El sitio del cliente vive como repo de GitHub (fuente de verdad, editable, entregable).
alter table projects add column if not exists repo_url  text;
alter table projects add column if not exists repo_name text;
