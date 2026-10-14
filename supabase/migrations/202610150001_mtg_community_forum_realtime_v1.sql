-- Additive MTG community schema: public chat, threaded forum, private DMs, reporting.
create extension if not exists pgcrypto;

create table if not exists public.mtg_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists mtg_profiles_username_lower_uq on public.mtg_profiles (lower(username));

create table if not exists public.mtg_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default '',
  body text not null check (length(btrim(body)) between 1 and 800),
  created_at timestamptz not null default now()
);
create index if not exists mtg_chat_messages_created_idx on public.mtg_chat_messages(created_at desc);

create table if not exists public.mtg_forum_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default '',
  title text not null check (length(btrim(title)) between 5 and 160),
  category text not null default 'general' check (category in ('general','deck-tech','rules','buy-sell-trade','wanted')),
  body text not null check (length(btrim(body)) between 10 and 6000),
  is_hidden boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mtg_forum_topics_updated_idx on public.mtg_forum_topics(updated_at desc);

create table if not exists public.mtg_forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.mtg_forum_topics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default '',
  body text not null check (length(btrim(body)) between 1 and 6000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mtg_forum_posts_topic_created_idx on public.mtg_forum_posts(topic_id, created_at asc);

create table if not exists public.mtg_dm_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.mtg_dm_members (
  conversation_id uuid not null references public.mtg_dm_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists mtg_dm_members_user_idx on public.mtg_dm_members(user_id, joined_at desc);

create table if not exists public.mtg_dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.mtg_dm_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  username text not null default '',
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists mtg_dm_messages_conversation_created_idx on public.mtg_dm_messages(conversation_id, created_at asc);

create table if not exists public.mtg_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('chat-message','forum-topic','forum-post','dm-message','listing')),
  content_id text not null,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  created_at timestamptz not null default now()
);
create index if not exists mtg_content_reports_created_idx on public.mtg_content_reports(created_at desc);

alter table public.mtg_profiles enable row level security;
alter table public.mtg_chat_messages enable row level security;
alter table public.mtg_forum_topics enable row level security;
alter table public.mtg_forum_posts enable row level security;
alter table public.mtg_dm_conversations enable row level security;
alter table public.mtg_dm_members enable row level security;
alter table public.mtg_dm_messages enable row level security;
alter table public.mtg_content_reports enable row level security;

grant select on public.mtg_profiles to anon, authenticated;
grant insert, update on public.mtg_profiles to authenticated;
grant select on public.mtg_chat_messages to anon, authenticated;
grant insert on public.mtg_chat_messages to authenticated;
grant select on public.mtg_forum_topics, public.mtg_forum_posts to anon, authenticated;
grant insert on public.mtg_forum_topics, public.mtg_forum_posts to authenticated;
grant select on public.mtg_dm_conversations, public.mtg_dm_members, public.mtg_dm_messages to authenticated;
grant insert on public.mtg_dm_messages to authenticated;
grant insert on public.mtg_content_reports to authenticated;

drop policy if exists mtg_profiles_public_read on public.mtg_profiles;
create policy mtg_profiles_public_read on public.mtg_profiles for select to anon, authenticated using (true);
drop policy if exists mtg_profiles_insert_self on public.mtg_profiles;
create policy mtg_profiles_insert_self on public.mtg_profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists mtg_profiles_update_self on public.mtg_profiles;
create policy mtg_profiles_update_self on public.mtg_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists mtg_chat_public_read on public.mtg_chat_messages;
create policy mtg_chat_public_read on public.mtg_chat_messages for select to anon, authenticated using (true);
drop policy if exists mtg_chat_member_insert on public.mtg_chat_messages;
create policy mtg_chat_member_insert on public.mtg_chat_messages for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists mtg_topics_public_read on public.mtg_forum_topics;
create policy mtg_topics_public_read on public.mtg_forum_topics for select to anon, authenticated using (is_hidden = false);
drop policy if exists mtg_topics_member_insert on public.mtg_forum_topics;
create policy mtg_topics_member_insert on public.mtg_forum_topics for insert to authenticated with check (user_id = (select auth.uid()) and is_hidden = false and is_locked = false);
drop policy if exists mtg_topics_owner_update on public.mtg_forum_topics;
create policy mtg_topics_owner_update on public.mtg_forum_topics for update to authenticated using (user_id = (select auth.uid()) and is_hidden = false and is_locked = false) with check (user_id = (select auth.uid()) and is_hidden = false);

drop policy if exists mtg_posts_public_read on public.mtg_forum_posts;
create policy mtg_posts_public_read on public.mtg_forum_posts for select to anon, authenticated using (
  is_hidden = false and exists (select 1 from public.mtg_forum_topics t where t.id = topic_id and t.is_hidden = false)
);
drop policy if exists mtg_posts_member_insert on public.mtg_forum_posts;
create policy mtg_posts_member_insert on public.mtg_forum_posts for insert to authenticated with check (
  user_id = (select auth.uid()) and is_hidden = false and exists (
    select 1 from public.mtg_forum_topics t where t.id = topic_id and t.is_hidden = false and t.is_locked = false
  )
);

create or replace function public.mtg_is_dm_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.mtg_dm_members m
    where m.conversation_id = p_conversation_id and m.user_id = (select auth.uid()));
$$;
revoke all on function public.mtg_is_dm_member(uuid) from public;
grant execute on function public.mtg_is_dm_member(uuid) to authenticated;

drop policy if exists mtg_dm_conversation_member_read on public.mtg_dm_conversations;
create policy mtg_dm_conversation_member_read on public.mtg_dm_conversations for select to authenticated using (public.mtg_is_dm_member(id));
drop policy if exists mtg_dm_members_member_read on public.mtg_dm_members;
create policy mtg_dm_members_member_read on public.mtg_dm_members for select to authenticated using (public.mtg_is_dm_member(conversation_id));
drop policy if exists mtg_dm_messages_member_read on public.mtg_dm_messages;
create policy mtg_dm_messages_member_read on public.mtg_dm_messages for select to authenticated using (public.mtg_is_dm_member(conversation_id));
drop policy if exists mtg_dm_messages_member_insert on public.mtg_dm_messages;
create policy mtg_dm_messages_member_insert on public.mtg_dm_messages for insert to authenticated with check (sender_id = (select auth.uid()) and public.mtg_is_dm_member(conversation_id));

create or replace function public.mtg_start_dm(p_username text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_target uuid; v_conversation uuid;
begin
  if v_me is null then raise exception 'Sign in is required to start a private conversation'; end if;
  if p_username is null or length(btrim(p_username)) < 3 then raise exception 'Enter a valid username'; end if;
  select p.user_id into v_target from public.mtg_profiles p where lower(p.username) = lower(btrim(p_username)) limit 1;
  if v_target is null then raise exception 'No member found with that username'; end if;
  if v_target = v_me then raise exception 'You cannot start a private conversation with yourself'; end if;
  select c.id into v_conversation
  from public.mtg_dm_conversations c
  join public.mtg_dm_members mine on mine.conversation_id = c.id and mine.user_id = v_me
  join public.mtg_dm_members theirs on theirs.conversation_id = c.id and theirs.user_id = v_target
  where (select count(*) from public.mtg_dm_members m where m.conversation_id = c.id) = 2
  order by c.updated_at desc limit 1;
  if v_conversation is null then
    insert into public.mtg_dm_conversations default values returning id into v_conversation;
    insert into public.mtg_dm_members(conversation_id,user_id) values (v_conversation,v_me),(v_conversation,v_target);
  end if;
  return v_conversation;
end;
$$;
revoke all on function public.mtg_start_dm(text) from public;
grant execute on function public.mtg_start_dm(text) to authenticated;

create or replace function public.mtg_touch_dm_conversation()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin update public.mtg_dm_conversations set updated_at = now() where id = new.conversation_id; return new; end; $$;
drop trigger if exists mtg_touch_dm_conversation_after_message on public.mtg_dm_messages;
create trigger mtg_touch_dm_conversation_after_message after insert on public.mtg_dm_messages for each row execute function public.mtg_touch_dm_conversation();

create or replace function public.mtg_prepare_community_post()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_username text; v_recent integer;
begin
  if v_uid is null then raise exception 'Sign in is required to post'; end if;
  if tg_table_name = 'mtg_dm_messages' then
    if new.sender_id <> v_uid then raise exception 'Sender must match the signed-in user'; end if;
    select p.username into v_username from public.mtg_profiles p where p.user_id = v_uid;
    if v_username is null then raise exception 'Choose a community username before messaging'; end if;
    new.username := v_username;
    select count(*) into v_recent from public.mtg_dm_messages m where m.sender_id = v_uid and m.created_at > now() - interval '30 seconds';
    if v_recent >= 8 then raise exception 'Please slow down before sending more private messages'; end if;
  else
    if new.user_id <> v_uid then raise exception 'Author must match the signed-in user'; end if;
    select p.username into v_username from public.mtg_profiles p where p.user_id = v_uid;
    if v_username is null then raise exception 'Choose a community username before posting'; end if;
    new.username := v_username;
    if tg_table_name = 'mtg_chat_messages' then
      select count(*) into v_recent from public.mtg_chat_messages m where m.user_id = v_uid and m.created_at > now() - interval '30 seconds';
      if v_recent >= 5 then raise exception 'Please wait before sending more chat messages'; end if;
    elsif tg_table_name = 'mtg_forum_topics' then
      select count(*) into v_recent from public.mtg_forum_topics t where t.user_id = v_uid and t.created_at > now() - interval '10 minutes';
      if v_recent >= 3 then raise exception 'Please wait before starting another topic'; end if;
    elsif tg_table_name = 'mtg_forum_posts' then
      select count(*) into v_recent from public.mtg_forum_posts p where p.user_id = v_uid and p.created_at > now() - interval '60 seconds';
      if v_recent >= 10 then raise exception 'Please slow down before replying again'; end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists mtg_chat_prepare on public.mtg_chat_messages;
create trigger mtg_chat_prepare before insert on public.mtg_chat_messages for each row execute function public.mtg_prepare_community_post();
drop trigger if exists mtg_topic_prepare on public.mtg_forum_topics;
create trigger mtg_topic_prepare before insert on public.mtg_forum_topics for each row execute function public.mtg_prepare_community_post();
drop trigger if exists mtg_post_prepare on public.mtg_forum_posts;
create trigger mtg_post_prepare before insert on public.mtg_forum_posts for each row execute function public.mtg_prepare_community_post();
drop trigger if exists mtg_dm_prepare on public.mtg_dm_messages;
create trigger mtg_dm_prepare before insert on public.mtg_dm_messages for each row execute function public.mtg_prepare_community_post();

create or replace function public.mtg_touch_topic()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin update public.mtg_forum_topics set updated_at = now() where id = new.topic_id; return new; end; $$;
drop trigger if exists mtg_touch_topic_after_post on public.mtg_forum_posts;
create trigger mtg_touch_topic_after_post after insert on public.mtg_forum_posts for each row execute function public.mtg_touch_topic();

drop policy if exists mtg_reports_insert_self on public.mtg_content_reports;
create policy mtg_reports_insert_self on public.mtg_content_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
revoke all on public.mtg_content_reports from anon, authenticated;
grant insert on public.mtg_content_reports to authenticated;

create or replace function public.mtg_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_username text := new.raw_user_meta_data ->> 'username';
begin
  if v_username is null or v_username !~ '^[A-Za-z0-9_]{3,24}$' then return new; end if;
  if exists (select 1 from public.mtg_profiles p where lower(p.username) = lower(v_username)) then
    raise exception 'That community username is already in use';
  end if;
  insert into public.mtg_profiles(user_id, username) values (new.id, v_username);
  return new;
end;
$$;
drop trigger if exists mtg_profile_after_auth_signup on auth.users;
create trigger mtg_profile_after_auth_signup after insert on auth.users for each row execute function public.mtg_handle_new_auth_user();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mtg_chat_messages') then alter publication supabase_realtime add table public.mtg_chat_messages; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mtg_forum_topics') then alter publication supabase_realtime add table public.mtg_forum_topics; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mtg_forum_posts') then alter publication supabase_realtime add table public.mtg_forum_posts; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mtg_dm_messages') then alter publication supabase_realtime add table public.mtg_dm_messages; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mtg_dm_conversations') then alter publication supabase_realtime add table public.mtg_dm_conversations; end if;
  end if;
end;
$$;
