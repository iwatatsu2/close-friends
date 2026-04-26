export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  status?: "online" | "gaming" | "away" | "offline";
  current_game?: string | null;
  status_updated_at?: string;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  group_id: string;
  content: string;
  mood: string | null;
  image_url: string | null;
  created_at: string;
  profiles?: Profile;
  reactions?: Reaction[];
  comments?: Comment[];
};

export type Reaction = {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
};

export type GameSession = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  game_name: string;
  scheduled_at: string;
  max_players: number | null;
  status: "open" | "full" | "started" | "ended";
  created_at: string;
  profiles?: Profile;
  cf_session_participants?: SessionParticipant[];
};

export type SessionParticipant = {
  id: string;
  session_id: string;
  user_id: string;
  status: "joined" | "maybe" | "declined";
  joined_at: string;
  profiles?: Profile;
};

export type Availability = {
  id: string;
  group_id: string;
  user_id: string;
  available_date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  created_at: string;
  profiles?: Profile;
};
