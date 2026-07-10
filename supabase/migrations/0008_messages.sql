-- Buzón: mensajes del cliente al equipo, con trazabilidad (fecha/hora, estado). Idempotente.
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  client_id  uuid references clients(id) on delete set null,
  user_id    uuid references users(id) on delete set null,
  texto      text not null,
  resuelto   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_pendientes on messages (resuelto, created_at desc);

alter table messages enable row level security;

-- staff ve/gestiona todo
drop policy if exists messages_staff on messages;
create policy messages_staff on messages for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- el cliente lee sus propios mensajes
drop policy if exists messages_client_read on messages;
create policy messages_client_read on messages for select to authenticated
  using (user_id = auth.uid());

-- el cliente escribe mensajes solo en SU proyecto, a su propio nombre
drop policy if exists messages_client_insert on messages;
create policy messages_client_insert on messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from projects p join clients c on c.id = p.client_id
      where p.id = messages.project_id and c.user_id = auth.uid()
    )
  );
