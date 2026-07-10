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
