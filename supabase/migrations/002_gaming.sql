-- Game Sessions (セッション募集)
create table game_sessions (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade not null,
  created_by uuid references auth.users on delete cascade not null,
  title text not null,
  game_name text not null,
  scheduled_at timestamptz not null,
  max_players int,
  status text default 'open' check (status in ('open', 'full', 'started', 'ended')),
  created_at timestamptz default now()
);

alter table game_sessions enable row level security;
create policy "Group members can view sessions" on game_sessions for select using (
  exists (select 1 from group_members where group_members.group_id = game_sessions.group_id and group_members.user_id = auth.uid())
);
create policy "Group members can create sessions" on game_sessions for insert with check (
  auth.uid() = created_by and
  exists (select 1 from group_members where group_members.group_id = game_sessions.group_id and group_members.user_id = auth.uid())
);
create policy "Creator can update session" on game_sessions for update using (auth.uid() = created_by);

-- Session Participants (参加表明)
create table session_participants (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references game_sessions on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  status text default 'joined' check (status in ('joined', 'maybe', 'declined')),
  joined_at timestamptz default now(),
  unique (session_id, user_id)
);

alter table session_participants enable row level security;
create policy "Group members can view participants" on session_participants for select using (
  exists (
    select 1 from game_sessions gs
    join group_members gm on gm.group_id = gs.group_id
    where gs.id = session_participants.session_id and gm.user_id = auth.uid()
  )
);
create policy "Users can join sessions" on session_participants for insert with check (auth.uid() = user_id);
create policy "Users can update own participation" on session_participants for update using (auth.uid() = user_id);
create policy "Users can leave sessions" on session_participants for delete using (auth.uid() = user_id);

-- Availability (遊べる日程共有)
create table availability (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  available_date date not null,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz default now(),
  unique (group_id, user_id, available_date)
);

alter table availability enable row level security;
create policy "Group members can view availability" on availability for select using (
  exists (select 1 from group_members where group_members.group_id = availability.group_id and group_members.user_id = auth.uid())
);
create policy "Users can set own availability" on availability for insert with check (auth.uid() = user_id);
create policy "Users can update own availability" on availability for update using (auth.uid() = user_id);
create policy "Users can delete own availability" on availability for delete using (auth.uid() = user_id);

-- User Status (オンラインステータス)
alter table profiles add column if not exists status text default 'offline' check (status in ('online', 'gaming', 'away', 'offline'));
alter table profiles add column if not exists current_game text;
alter table profiles add column if not exists status_updated_at timestamptz default now();
