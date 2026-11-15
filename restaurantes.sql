-- =====================================================================
-- Adega dos Amigos — RESTAURANTES (corre uma vez no SQL Editor)
-- =====================================================================
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
