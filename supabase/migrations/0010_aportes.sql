-- El cliente aporta material a su proyecto (charlas, docs, links) → alimenta su voz. Idempotente.
-- Nota: si "ALTER TYPE ... ADD VALUE" diera error de transacción, corre esa línea sola primero.
alter type input_tipo add value if not exists 'aporte_cliente';

-- inputs: el cliente inserta material en SU proyecto y lee solo lo que él subió
-- (nunca ve las transcripciones/conclusiones internas del operador).
drop policy if exists inputs_client_insert on inputs;
create policy inputs_client_insert on inputs for insert to authenticated
  with check (
    subido_por = auth.uid()
    and exists (
      select 1 from projects p join clients c on c.id = p.client_id
      where p.id = inputs.project_id and c.user_id = auth.uid()
    )
  );

drop policy if exists inputs_client_read on inputs;
create policy inputs_client_read on inputs for select to authenticated
  using (subido_por = auth.uid());

-- Storage: bucket para los archivos que sube el cliente.
insert into storage.buckets (id, name, public)
values ('aportes', 'aportes', true)
on conflict (id) do nothing;

drop policy if exists "aportes client write" on storage.objects;
create policy "aportes client write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aportes'
    and exists (
      select 1 from projects p join clients c on c.id = p.client_id
      where c.user_id = auth.uid() and p.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "aportes staff write" on storage.objects;
create policy "aportes staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'aportes' and public.is_staff());

drop policy if exists "aportes read" on storage.objects;
create policy "aportes read" on storage.objects for select using (bucket_id = 'aportes');
