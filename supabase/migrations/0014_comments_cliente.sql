-- El cliente puede comentar sus entregables PUBLICADOS (ida y vuelta con el equipo). Idempotente.

drop policy if exists comments_client_read on comments;
create policy comments_client_read on comments for select to authenticated
  using (exists (
    select 1
    from deliverables d
    join projects p on p.id = d.project_id
    join clients  c on c.id = p.client_id
    where d.id = comments.deliverable_id
      and c.user_id = auth.uid()
      and d.estado = 'publicado'
  ));

drop policy if exists comments_client_insert on comments;
create policy comments_client_insert on comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from deliverables d
      join projects p on p.id = d.project_id
      join clients  c on c.id = p.client_id
      where d.id = comments.deliverable_id
        and c.user_id = auth.uid()
        and d.estado = 'publicado'
    )
  );
