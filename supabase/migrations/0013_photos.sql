-- Sesión de fotos IA (D6): los assets pueden estar en generación asíncrona.
alter table assets add column if not exists estado            text not null default 'listo';
alter table assets add column if not exists muapi_request_id  text;
alter table assets add column if not exists prompt            text;
-- mientras se genera, todavía no hay archivo
alter table assets alter column file_url drop not null;
