
-- Security-definer function so students can discover the primary teacher for chatting
create or replace function public.get_primary_admin()
returns table (id uuid, user_id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select id, user_id, full_name, avatar_url
  from public.admins
  where user_id is not null
  order by created_at asc
  limit 1
$$;

grant execute on function public.get_primary_admin() to authenticated;
