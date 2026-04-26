"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const POPULAR_GAMES = ["APEX", "Valorant", "スプラトゥーン", "マイクラ", "フォートナイト", "モンハン", "スマブラ", "ポケモン"];

export default function NewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [gameName, setGameName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("21:00");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !gameName || !date || !time) {
      setError("必須項目を入力してください");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    const { data: session, error: err } = await supabase
      .from("cf_game_sessions")
      .insert({
        group_id: groupId,
        created_by: user.id,
        title,
        game_name: gameName,
        scheduled_at: scheduledAt,
        max_players: maxPlayers ? parseInt(maxPlayers) : null,
      })
      .select()
      .single();

    if (err || !session) {
      setError("作成に失敗しました");
      setLoading(false);
      return;
    }

    await supabase.from("cf_session_participants").insert({
      session_id: session.id,
      user_id: user.id,
      status: "joined",
    });

    router.push(`/groups/${groupId}/sessions`);
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <button onClick={() => router.back()} className="text-indigo-400 text-sm mb-4">
        ← 戻る
      </button>

      <Card className="border-indigo-800 bg-indigo-950/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white">セッション募集</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-indigo-200">タイトル *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="今夜ランクマ回そう！"
                maxLength={50}
                className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500"
              />
            </div>

            <div>
              <Label className="text-indigo-200">ゲーム名 *</Label>
              <Input
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="ゲーム名を入力"
                className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {POPULAR_GAMES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGameName(g)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      gameName === g
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-indigo-900/50 border-indigo-700 text-indigo-300 hover:bg-indigo-800"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-indigo-200">日付 *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="border-indigo-700 bg-indigo-900/50 text-white"
                />
              </div>
              <div>
                <Label className="text-indigo-200">時間 *</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="border-indigo-700 bg-indigo-900/50 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-indigo-200">最大人数（任意）</Label>
              <Input
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                placeholder="制限なし"
                min={2}
                max={100}
                className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold" disabled={loading}>
              {loading ? "作成中..." : "セッションを作成"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
