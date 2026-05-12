"use client";
import { getAuthUser } from "@/lib/supabase/getAuthUser";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GameSession } from "@/lib/types";
import { SessionCard } from "@/components/SessionCard";

export default function SessionsPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await getAuthUser(supabase);
      if (!user) return;
      setCurrentUserId(user.id);

      const { data } = await supabase
        .from("cf_game_sessions")
        .select("*, profiles(*), cf_session_participants(*, profiles(*))")
        .eq("group_id", groupId)
        .in("status", ["open", "full"])
        .order("scheduled_at", { ascending: true });

      setSessions(data || []);
      setLoading(false);
    }
    load();
  }, [groupId, supabase]);

  if (loading) {
    return <div className="flex justify-center p-8 text-muted-foreground">読み込み中...</div>;
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push(`/groups/${groupId}`)} className="text-indigo-400 text-sm mb-1">
            ← タイムラインに戻る
          </button>
          <h1 className="text-xl font-bold text-white">セッション募集</h1>
        </div>
        <Button className="bg-indigo-500 hover:bg-indigo-400 text-white" onClick={() => router.push(`/groups/${groupId}/sessions/new`)}>
          募集する
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-indigo-800 bg-indigo-950/60">
          <CardContent className="py-12 text-center text-indigo-400">
            <p className="text-3xl mb-2">🎮</p>
            <p>まだセッション募集がありません</p>
            <p className="text-sm mt-1">「募集する」からゲームセッションを作ろう！</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              currentUserId={currentUserId}
              onUpdate={() => {
                // Refetch
                supabase
                  .from("cf_game_sessions")
                  .select("*, profiles(*), cf_session_participants(*, profiles(*))")
                  .eq("group_id", groupId)
                  .in("status", ["open", "full"])
                  .order("scheduled_at", { ascending: true })
                  .then(({ data }) => setSessions(data || []));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
