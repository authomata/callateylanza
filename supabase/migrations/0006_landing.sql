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
