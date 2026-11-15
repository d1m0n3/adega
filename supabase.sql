-- =====================================================================
-- Adega dos Amigos — esquema da base de dados (Supabase)
-- Cola tudo no "SQL Editor" do Supabase e carrega em "Run".
-- =====================================================================

-- ---------- Tabelas ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '🍷',
  invite_code text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.wines (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  producer text, vintage int check (vintage between 1800 and 2100),
  type text not null default 'tinto', region text, country text, grapes text,
  price numeric(10,2) check (price >= 0), where_bought text, place text,
  rating numeric(2,1) not null check (rating between 0.5 and 5),
  tags text[] not null default '{}',
  comment text check (char_length(comment) <= 1000),
  pairing text, buy_again boolean not null default false,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wines_group_idx on public.wines (group_id, created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid not null references public.wines on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.cheers (
  wine_id uuid not null references public.wines on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wine_id, user_id)
);

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Funções auxiliares ----------
create or replace function public.is_member(gid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.wine_group(wid uuid) returns uuid
language sql security definer set search_path = public stable as $$
  select group_id from wines where id = wid;
$$;

create or replace function public.create_group(p_name text, p_emoji text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid; code text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;
  insert into groups (name, emoji, invite_code, created_by)
  values (left(trim(p_name), 40), coalesce(nullif(p_emoji, ''), '🍷'), code, auth.uid())
  returning id into gid;
  insert into memberships (group_id, user_id) values (gid, auth.uid());
  return gid;
end $$;

create or replace function public.join_group(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select id into gid from groups where invite_code = upper(trim(p_code));
  if gid is null then raise exception 'Código de convite inválido'; end if;
  insert into memberships (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;

grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ---------- Entrada só por convite ----------
create or replace function public.invite_info(p_code text) returns text
language sql security definer set search_path = public stable as $$
  select name from groups where invite_code = upper(trim(p_code));
$$;
create or replace function public.needs_setup() returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from groups);
$$;
grant execute on function public.invite_info(text) to anon, authenticated;
grant execute on function public.needs_setup() to anon, authenticated;

-- ---------- Segurança (Row Level Security) ----------
alter table public.profiles    enable row level security;
alter table public.groups      enable row level security;
alter table public.memberships enable row level security;
alter table public.wines       enable row level security;
alter table public.comments    enable row level security;
alter table public.cheers      enable row level security;
alter table public.wishlist    enable row level security;

-- perfis: qualquer utilizador autenticado vê nomes; cada um edita o seu
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid());

-- grupos: só membros veem; só o criador altera/apaga (criação via create_group)
create policy "groups read"   on public.groups for select to authenticated using (is_member(id));
create policy "groups update" on public.groups for update to authenticated using (created_by = auth.uid());
create policy "groups delete" on public.groups for delete to authenticated using (created_by = auth.uid());

-- membros: membros veem-se; cada um sai, o criador pode remover
create policy "members read" on public.memberships for select to authenticated using (is_member(group_id));
create policy "members delete" on public.memberships for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid()));

-- vinhos
create policy "wines read"   on public.wines for select to authenticated using (is_member(group_id));
create policy "wines insert" on public.wines for insert to authenticated with check (user_id = auth.uid() and is_member(group_id));
create policy "wines update" on public.wines for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(group_id));
create policy "wines delete" on public.wines for delete to authenticated using (user_id = auth.uid());

-- comentários
create policy "comments read"   on public.comments for select to authenticated using (is_member(wine_group(wine_id)));
create policy "comments insert" on public.comments for insert to authenticated with check (user_id = auth.uid() and is_member(wine_group(wine_id)));
create policy "comments delete" on public.comments for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from wines w where w.id = wine_id and w.user_id = auth.uid()));

-- brindes
create policy "cheers read"   on public.cheers for select to authenticated using (is_member(wine_group(wine_id)));
create policy "cheers insert" on public.cheers for insert to authenticated with check (user_id = auth.uid() and is_member(wine_group(wine_id)));
create policy "cheers delete" on public.cheers for delete to authenticated using (user_id = auth.uid());

-- lista "queremos provar"
create policy "wish read"   on public.wishlist for select to authenticated using (is_member(group_id));
create policy "wish insert" on public.wishlist for insert to authenticated with check (user_id = auth.uid() and is_member(group_id));
create policy "wish update" on public.wishlist for update to authenticated using (is_member(group_id));
create policy "wish delete" on public.wishlist for delete to authenticated using (user_id = auth.uid());

-- ---------- Fotos (Storage) ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

-- ---------- Tempo real ----------
alter publication supabase_realtime add table
  public.groups, public.memberships, public.wines, public.comments, public.cheers, public.wishlist;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  cuisine text, city text,
  rating numeric(2,1) not null check (rating between 0.5 and 5),
  food smallint check (food between 1 and 5),
  service smallint check (service between 1 and 5),
  ambiance smallint check (ambiance between 1 and 5),
  price_pp numeric(10,2) check (price_pp >= 0),
  dishes text check (char_length(dishes) <= 300),
  comment text check (char_length(comment) <= 1000),
  would_return boolean not null default false,
  maps_url text check (maps_url is null or maps_url ~* '^https://'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurants_group_idx on public.restaurants (group_id, created_at desc);

create table if not exists public.r_comments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.r_cheers (
  restaurant_id uuid not null references public.restaurants on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

alter table public.wines add column if not exists restaurant_id uuid references public.restaurants on delete set null;

create or replace function public.rest_group(rid uuid) returns uuid
language sql security definer set search_path = public stable as $$
  select group_id from restaurants where id = rid;
$$;

alter table public.restaurants enable row level security;
alter table public.r_comments  enable row level security;
alter table public.r_cheers    enable row level security;

create policy "rest read"   on public.restaurants for select to authenticated using (is_member(group_id));
create policy "rest insert" on public.restaurants for insert to authenticated with check (user_id = auth.uid() and is_member(group_id));
create policy "rest update" on public.restaurants for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(group_id));
create policy "rest delete" on public.restaurants for delete to authenticated using (user_id = auth.uid());

create policy "rcom read"   on public.r_comments for select to authenticated using (is_member(rest_group(restaurant_id)));
create policy "rcom insert" on public.r_comments for insert to authenticated with check (user_id = auth.uid() and is_member(rest_group(restaurant_id)));
create policy "rcom delete" on public.r_comments for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from restaurants r where r.id = restaurant_id and r.user_id = auth.uid()));

create policy "rch read"   on public.r_cheers for select to authenticated using (is_member(rest_group(restaurant_id)));
create policy "rch insert" on public.r_cheers for insert to authenticated with check (user_id = auth.uid() and is_member(rest_group(restaurant_id)));
create policy "rch delete" on public.r_cheers for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.restaurants, public.r_comments, public.r_cheers;
