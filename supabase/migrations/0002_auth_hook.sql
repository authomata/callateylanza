-- Auto-provision a public.users row whenever someone authenticates for the first time.
-- Role is derived from an admin allowlist; everyone else starts as 'operador'.
-- (Clients get their role set to 'cliente' by the app when their project is created.)
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  assigned user_rol := 'operador';
begin
  if new.email = any (array['andres@authomata.io']) then
    assigned := 'admin';
  end if;

  insert into public.users (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    assigned
  )
  on conflict (id) do nothing;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
