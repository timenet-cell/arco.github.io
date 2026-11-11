-- ARCO – Collectivo Criativo · esquema inicial do Supabase
-- Correr uma vez no SQL Editor do projecto ARCO (Supabase → SQL Editor → New query → colar → Run).
-- Regra: leitura pública só do que está visível; escrita SÓ para quem está em public.admins (is_admin()).
-- Quem é admin decide-o a base, nunca a página.

-- ── Admins ───────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ── Artistas (presskit) ──────────────────────────────────────────────────
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  discipline text not null default '',
  photo text not null default '',          -- URL da foto principal (versão web)
  bio_short text not null default '',
  bio_lead text not null default '',
  bio_long text not null default '',       -- parágrafos separados por linha em branco
  agent_name text not null default '',
  agent_email text not null default '',
  territory text not null default '',
  presskit_zip text not null default '',   -- link (Drive/WeTransfer) para o ZIP de alta resolução
  audio_url text not null default '',
  video_url text not null default '',
  photos jsonb not null default '[]'::jsonb,  -- [{web, hi, credit}]
  docs jsonb not null default '[]'::jsonb,    -- [{label, meta, url}]
  links jsonb not null default '[]'::jsonb,   -- [{label, url}]
  sort int not null default 0,
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);
drop trigger if exists artists_touch on public.artists;
create trigger artists_touch before update on public.artists for each row execute function public.touch_updated_at();

-- ── Agenda ───────────────────────────────────────────────────────────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  date date not null,
  event_name text not null default '',
  venue text not null default '',
  city text not null default '',
  tickets_url text not null default '',
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists events_date_idx on public.events(date);
drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();

-- ── Textos do site (chave → texto) ───────────────────────────────────────
create table if not exists public.site_texts (
  key text primary key check (key ~ '^[a-z_]+$'),
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ── Definições: emails, redes, instagram ─────────────────────────────────
create table if not exists public.settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ── Feed do Instagram (cache: o site lê daqui, nunca do Instagram directamente) ──
create table if not exists public.instagram_posts (
  id text primary key,
  url text not null,
  image text not null,
  caption text not null default '',
  posted_at timestamptz not null default now(),
  visible boolean not null default true
);

-- ── Mensagens do formulário de contacto ──────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('Booking','Press','Outro')),
  artist text not null default '' check (char_length(artist) <= 120),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  event_date date,
  place text not null default '' check (char_length(place) <= 200),
  body text not null check (char_length(body) between 1 and 5000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.artists enable row level security;
alter table public.events enable row level security;
alter table public.site_texts enable row level security;
alter table public.settings enable row level security;
alter table public.instagram_posts enable row level security;
alter table public.messages enable row level security;

do $$ declare t text; begin
  foreach t in array array['artists','events','instagram_posts'] loop
    execute format('drop policy if exists %1$s_public_read on public.%1$s', t);
    execute format('create policy %1$s_public_read on public.%1$s for select using (visible or public.is_admin())', t);
  end loop;
  foreach t in array array['site_texts','settings'] loop
    execute format('drop policy if exists %1$s_public_read on public.%1$s', t);
    execute format('create policy %1$s_public_read on public.%1$s for select using (true)', t);
  end loop;
  foreach t in array array['artists','events','site_texts','settings','instagram_posts','messages'] loop
    execute format('drop policy if exists %1$s_admin_write on public.%1$s', t);
    execute format('create policy %1$s_admin_write on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- formulário: qualquer visitante pode ENVIAR (insert), só admin lê/gere
drop policy if exists messages_public_insert on public.messages;
create policy messages_public_insert on public.messages for insert to anon, authenticated with check (handled = false);

-- ── Storage: bucket público "arco" (leitura pública, escrita só admin) ───
insert into storage.buckets (id, name, public, file_size_limit)
values ('arco', 'arco', true, 26214400)  -- 25 MB por ficheiro
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists arco_admin_insert on storage.objects;
drop policy if exists arco_admin_update on storage.objects;
drop policy if exists arco_admin_delete on storage.objects;
create policy arco_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'arco' and public.is_admin());
create policy arco_admin_update on storage.objects for update to authenticated using (bucket_id = 'arco' and public.is_admin());
create policy arco_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'arco' and public.is_admin());

-- ── Primeiro admin ───────────────────────────────────────────────────────
-- 1) Supabase → Authentication → Users → Add user (email + password, "Auto confirm").
-- 2) Correr (trocando o email):
-- insert into public.admins (user_id) select id from auth.users where email = 'o-teu-email@exemplo.pt';
