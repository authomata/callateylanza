-- Buzón como hilo de conversación (ida y vuelta), no mensajes sueltos. Idempotente.

-- quién escribió el mensaje: el equipo (staff) o el cliente
alter table messages add column if not exists de_equipo boolean not null default false;

-- El cliente ahora lee TODO el hilo de su proyecto (incluidas las respuestas del equipo),
-- no solo sus propios mensajes.
drop policy if exists messages_client_read on messages;
create policy messages_client_read on messages for select to authenticated
  using (exists (
    select 1 from projects p join clients c on c.id = p.client_id
    where p.id = messages.project_id and c.user_id = auth.uid()
  ));

-- El cliente sigue escribiendo solo en su proyecto, a su nombre, y nunca como "equipo".
drop policy if exists messages_client_insert on messages;
create policy messages_client_insert on messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and de_equipo = false
    and exists (
      select 1 from projects p join clients c on c.id = p.client_id
      where p.id = messages.project_id and c.user_id = auth.uid()
    )
  );
