-- =====================================================================
-- Adega dos Amigos — reforço de privacidade (corre uma vez no SQL Editor)
-- =====================================================================

-- 1) Cada pessoa só vê os nomes de quem está nos seus grupos
create or replace function public.shares_group(other uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select other = auth.uid() or exists (
    select 1 from memberships a join memberships b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other);
$$;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (shares_group(id));

-- 2) O criador do grupo pode gerar um novo código de convite (o antigo deixa de funcionar)
create or replace function public.regen_invite(gid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not exists (select 1 from groups where id = gid and created_by = auth.uid()) then
    raise exception 'Só o criador do grupo pode mudar o código';
  end if;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;
  update groups set invite_code = code where id = gid;
  return code;
end $$;
grant execute on function public.regen_invite(uuid) to authenticated;
