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
