-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Groups
create table groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text unique not null,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table groups enable row level security;
create policy "Group members can view groups" on groups for select using (
  exists (select 1 from group_members where group_members.group_id = id and group_members.user_id = auth.uid())
);
create policy "Authenticated users can create groups" on groups for insert with check (auth.uid() = created_by);
-- Allow anyone to read group by invite_code (for joining)
create policy "Anyone can view group by invite code" on groups for select using (true);

-- Group Members
create table group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  unique (group_id, user_id)
);

alter table group_members enable row level security;
create policy "Members can view group members" on group_members for select using (
  exists (select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())
);
create policy "Authenticated users can join groups" on group_members for insert with check (auth.uid() = user_id);

-- Posts
create table posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  group_id uuid references groups on delete cascade not null,
  content text not null,
  mood text,
  image_url text,
  created_at timestamptz default now()
);

alter table posts enable row level security;
create policy "Group members can view posts" on posts for select using (
  exists (select 1 from group_members where group_members.group_id = posts.group_id and group_members.user_id = auth.uid())
);
create policy "Group members can create posts" on posts for insert with check (
  auth.uid() = user_id and
  exists (select 1 from group_members where group_members.group_id = posts.group_id and group_members.user_id = auth.uid())
);
create policy "Users can delete own posts" on posts for delete using (auth.uid() = user_id);

-- Reactions
create table reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (post_id, user_id, emoji)
);

alter table reactions enable row level security;
create policy "Group members can view reactions" on reactions for select using (
  exists (
    select 1 from posts p
    join group_members gm on gm.group_id = p.group_id
    where p.id = reactions.post_id and gm.user_id = auth.uid()
  )
);
create policy "Group members can add reactions" on reactions for insert with check (
  auth.uid() = user_id and
  exists (
    select 1 from posts p
    join group_members gm on gm.group_id = p.group_id
    where p.id = reactions.post_id and gm.user_id = auth.uid()
  )
);
create policy "Users can remove own reactions" on reactions for delete using (auth.uid() = user_id);

-- Comments
create table comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table comments enable row level security;
create policy "Group members can view comments" on comments for select using (
  exists (
    select 1 from posts p
    join group_members gm on gm.group_id = p.group_id
    where p.id = comments.post_id and gm.user_id = auth.uid()
  )
);
create policy "Group members can add comments" on comments for insert with check (
  auth.uid() = user_id and
  exists (
    select 1 from posts p
    join group_members gm on gm.group_id = p.group_id
    where p.id = comments.post_id and gm.user_id = auth.uid()
  )
);
create policy "Users can delete own comments" on comments for delete using (auth.uid() = user_id);

-- Storage bucket for post images
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true);

create policy "Authenticated users can upload images" on storage.objects for insert
  with check (bucket_id = 'post-images' and auth.role() = 'authenticated');
create policy "Anyone can view images" on storage.objects for select
  using (bucket_id = 'post-images');
