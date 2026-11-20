-- =====================================================================
-- Adega dos Amigos — EVENTOS e GALERIAS (corre uma vez no SQL Editor)
-- =====================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  event_date date not null default current_date,
  restaurant_id uuid references public.restaurants on delete set null,
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists events_group_idx on public.events (group_id, event_date desc);

-- fotos partilhadas: cada foto pertence a UM vinho, restaurante ou evento
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  wine_id uuid references public.wines on delete cascade,
  restaurant_id uuid references public.restaurants on delete cascade,
  event_id uuid references public.events on delete cascade,
  path text not null,
  caption text check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  check (num_nonnulls(wine_id, restaurant_id, event_id) = 1)
);
create index if not exists photos_group_idx on public.photos (group_id, created_at desc);

alter table public.events enable row level security;
alter table public.photos enable row level security;

create policy "events read"   on public.events for select to authenticated using (is_member(group_id));
create policy "events insert" on public.events for insert to authenticated with check (user_id = auth.uid() and is_member(group_id));
create policy "events update" on public.events for update to authenticated using (user_id = auth.uid()) with check (is_member(group_id));
create policy "events delete" on public.events for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid()));

create policy "photos read"   on public.photos for select to authenticated using (is_member(group_id));
create policy "photos insert" on public.photos for insert to authenticated with check (user_id = auth.uid() and is_member(group_id));
create policy "photos update" on public.photos for update to authenticated using (user_id = auth.uid());
create policy "photos delete" on public.photos for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid()));

alter publication supabase_realtime add table public.events, public.photos;
