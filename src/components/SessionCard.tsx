"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameSession } from "@/lib/types";

function formatSchedule(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[d.getDay()];
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");

  let relative = "";
  if (diffH < 0) relative = "（終了）";
  else if (diffH < 1) relative = "（まもなく！）";
  else if (diffH < 24) relative = `（あと${diffH}時間）`;

  return `${month}/${day}(${weekday}) ${hours}:${minutes} ${relative}`;
}

type Props = {
  session: GameSession;
  currentUserId: string;
  onUpdate: () => void;
};

export function SessionCard({ session, currentUserId, onUpdate }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const participants = session.cf_session_participants || [];
  const myParticipation = participants.find((p) => p.user_id === currentUserId);
  const joinedCount = participants.filter((p) => p.status === "joined").length;
  const isFull = session.max_players ? joinedCount >= session.max_players : false;

  async function handleJoin(status: "joined" | "maybe") {
    setLoading(true);
    if (myParticipation) {
      if (myParticipation.status === status) {
        // Leave
        await supabase.from("cf_session_participants").delete().eq("id", myParticipation.id);
      } else {
        // Update status
        await supabase.from("cf_session_participants").update({ status }).eq("id", myParticipation.id);
      }
    } else {
      await supabase.from("cf_session_participants").insert({
        session_id: session.id,
        user_id: currentUserId,
        status,
      });
    }
    setLoading(false);
    onUpdate();
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary mb-1">
              🎮 {session.game_name}
            </span>
            <h3 className="font-semibold">{session.title}</h3>
          </div>
          {isFull && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">満員</span>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          📅 {formatSchedule(session.scheduled_at)}
        </p>

        {/* Participants */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">
            参加者 {joinedCount}{session.max_players ? `/${session.max_players}` : ""}人
          </p>
          <div className="flex flex-wrap gap-1">
            {participants
              .filter((p) => p.status === "joined")
              .map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800"
                >
                  {p.profiles?.display_name || "?"}
                </span>
              ))}
            {participants
              .filter((p) => p.status === "maybe")
              .map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800"
                >
                  {p.profiles?.display_name || "?"} (未定)
                </span>
              ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={myParticipation?.status === "joined" ? "default" : "outline"}
            onClick={() => handleJoin("joined")}
            disabled={loading || (isFull && myParticipation?.status !== "joined")}
            className="flex-1"
          >
            {myParticipation?.status === "joined" ? "✓ 参加中" : "参加する"}
          </Button>
          <Button
            size="sm"
            variant={myParticipation?.status === "maybe" ? "secondary" : "outline"}
            onClick={() => handleJoin("maybe")}
            disabled={loading}
            className="flex-1"
          >
            {myParticipation?.status === "maybe" ? "✓ 未定" : "未定"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
