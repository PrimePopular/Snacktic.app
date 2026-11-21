-- Update 031 (part 2): Treasure Hunt.
-- Run once in the Supabase SQL Editor, after 031. Safe to run again.
--
-- The owner makes up to as many codes as they like, prints each one as a QR code and hides it around campus. Each code has:
--   - the points it pays (the owner chooses),
--   - a limit on how many different people can claim it (for example 10).
-- When the limit is reached the code stops working ("too late"). A person can claim each code once. All checks happen here in the
-- database, one claim at a time, so two people scanning at the same moment cannot both take the last place.

create table if not exists public.treasure_codes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  hint text not null default '' check (length(hint) <= 200),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  points integer not null check (points between 1 and 10000),
  max_scans integer not null check (max_scans between 1 and 100000),
  scans integer not null default 0 check (scans >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (scans <= max_scans)
);

create table if not exists public.treasure_scans (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.treasure_codes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points_awarded integer not null,
  created_at timestamptz not null default now(),
  unique (code_id, user_id)
);
create index if not exists treasure_scans_user_idx on public.treasure_scans (user_id, created_at desc);

alter table public.treasure_codes enable row level security;
alter table public.treasure_scans enable row level security;
drop policy if exists "treasure codes owner" on public.treasure_codes;
create policy "treasure codes owner" on public.treasure_codes for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists "treasure scans owner read" on public.treasure_scans;
create policy "treasure scans owner read" on public.treasure_scans for select to authenticated using (public.is_owner());
-- Students never read these tables directly: they only call claim_treasure().

create or replace function public.claim_treasure(p_token text)
returns table (status text, points integer, name text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_code public.treasure_codes%rowtype;
begin
  if v_user is null then raise exception 'Sign in to claim treasure'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  select * into v_code from public.treasure_codes where token = left(coalesce(p_token, ''), 64) for update;   -- one claim at a time per code
  if not found then return query select 'invalid'::text, 0, ''::text; return; end if;
  if not v_code.active then return query select 'closed'::text, 0, v_code.name; return; end if;
  if exists (select 1 from public.treasure_scans s where s.code_id = v_code.id and s.user_id = v_user) then
    return query select 'already'::text, 0, v_code.name; return;
  end if;
  if v_code.scans >= v_code.max_scans then return query select 'too_late'::text, 0, v_code.name; return; end if;

  insert into public.treasure_scans (code_id, user_id, points_awarded) values (v_code.id, v_user, v_code.points);
  update public.treasure_codes set scans = scans + 1 where id = v_code.id;
  insert into public.points_transactions (user_id, amount, kind, note) values (v_user, v_code.points, 'treasure', 'Treasure found: ' || v_code.name);
  return query select 'found'::text, v_code.points, v_code.name;
end;
$$;
revoke all on function public.claim_treasure(text) from public, anon;
grant execute on function public.claim_treasure(text) to authenticated;

-- Owner: who found a code and when (nickname only).
create or replace function public.owner_treasure_finders(p_code uuid)
returns table (username text, found_at timestamptz, points integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select p.username::text, s.created_at, s.points_awarded
    from public.treasure_scans s join public.profiles p on p.id = s.user_id
    where s.code_id = p_code order by s.created_at;
end;
$$;
revoke all on function public.owner_treasure_finders(uuid) from public, anon;
grant execute on function public.owner_treasure_finders(uuid) to authenticated;
