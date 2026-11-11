-- ARCO · 002 · Equipa: gestor + artistas (máx. 10 utilizadores)
-- Gestor: faz tudo. Artista: edita só o seu presskit e as suas datas.
-- Os convites são feitos pela função "equipa" (Edge Function), chamada pela admin.

create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  role text not null check (role in ('gestor','artista')),
  artist_id uuid references public.artists(id) on delete set null,
  created_at timestamptz not null default now(),
  check (role = 'gestor' or artist_id is not null)
);
create unique index if not exists members_one_per_artist on public.members(artist_id) where artist_id is not null;
alter table public.members enable row level security;

-- trava: no máximo 10 utilizadores
create or replace function public.members_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.members) >= 10 then
    raise exception 'Limite de 10 utilizadores atingido';
  end if;
  return new;
end $$;
drop trigger if exists members_limit on public.members;
create trigger members_limit before insert on public.members for each row execute function public.members_limit();

-- passar os admins existentes para gestores
insert into public.members (user_id, email, role)
select a.user_id, coalesce(u.email, ''), 'gestor' from public.admins a join auth.users u on u.id = a.user_id
on conflict (user_id) do update set role = 'gestor';

-- funções de papel (a base decide, nunca a página)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'gestor');
$$;
create or replace function public.my_artist_id()
returns uuid language sql stable security definer set search_path = public as $$
  select artist_id from public.members where user_id = auth.uid() and role = 'artista';
$$;
create or replace function public.my_role()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('role', role, 'artist_id', artist_id) from public.members where user_id = auth.uid();
$$;
grant execute on function public.is_admin(), public.my_artist_id(), public.my_role() to anon, authenticated;

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- escrita em members só pela função "equipa" (service role); sem política de escrita aqui.

-- a tabela antiga deixa de ser usada
drop trigger if exists admins_limit on public.admins;
drop table if exists public.admins;

-- Artista: pode actualizar o SEU artista
drop policy if exists artists_own_update on public.artists;
create policy artists_own_update on public.artists for update to authenticated
  using (id = public.my_artist_id()) with check (id = public.my_artist_id());

-- trava: artista não muda endereço, ordem nem visibilidade
create or replace function public.artists_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.slug is distinct from old.slug or new.sort is distinct from old.sort or new.visible is distinct from old.visible) then
    raise exception 'Só o gestor pode mudar o endereço, a ordem ou a visibilidade';
  end if;
  return new;
end $$;
drop trigger if exists artists_guard on public.artists;
create trigger artists_guard before update on public.artists for each row execute function public.artists_guard();

-- Artista: gere as SUAS datas
drop policy if exists events_own_write on public.events;
create policy events_own_write on public.events for all to authenticated
  using (artist_id = public.my_artist_id()) with check (artist_id = public.my_artist_id());

-- Artista: ficheiros só na pasta do seu artista
drop policy if exists arco_own_insert on storage.objects;
drop policy if exists arco_own_update on storage.objects;
drop policy if exists arco_own_delete on storage.objects;
create policy arco_own_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'arco' and name like 'artists/' || (select slug from public.artists where id = public.my_artist_id()) || '/%');
create policy arco_own_update on storage.objects for update to authenticated using (
  bucket_id = 'arco' and name like 'artists/' || (select slug from public.artists where id = public.my_artist_id()) || '/%');
create policy arco_own_delete on storage.objects for delete to authenticated using (
  bucket_id = 'arco' and name like 'artists/' || (select slug from public.artists where id = public.my_artist_id()) || '/%');

select email, role from public.members;

-- Artista vê o seu próprio artista e datas mesmo quando estão ocultos
drop policy if exists artists_own_read on public.artists;
create policy artists_own_read on public.artists for select to authenticated using (id = public.my_artist_id());
drop policy if exists events_own_read on public.events;
create policy events_own_read on public.events for select to authenticated using (artist_id = public.my_artist_id());
