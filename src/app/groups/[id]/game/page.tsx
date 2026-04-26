"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

type ScoreEntry = {
  id: string;
  user_id: string;
  score: number;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

const GAME_DURATION = 10; // seconds

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [phase, setPhase] = useState<"idle" | "countdown" | "playing" | "result">("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [taps, setTaps] = useState(0);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [myBest, setMyBest] = useState(0);
  const [saving, setSaving] = useState(false);
  const tapsRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);
      userIdRef.current = user.id;
      await ensureProfile(supabase, user.id);
      loadRanking(user.id);
    }
    init();
  }, [groupId]);

  async function loadRanking(userId?: string) {
    const uid = userId || userIdRef.current;
    const { data } = await supabase
      .from("cf_game_scores")
      .select("*, profiles(*)")
      .eq("group_id", groupId)
      .eq("game_type", "tap_battle")
      .order("score", { ascending: false })
      .limit(20);
    if (data) setRanking(data as ScoreEntry[]);

    if (!uid) return;
    const { data: myData } = await supabase
      .from("cf_game_scores")
      .select("score")
      .eq("group_id", groupId)
      .eq("game_type", "tap_battle")
      .eq("user_id", uid)
      .order("score", { ascending: false })
      .limit(1);
    if (myData && myData.length > 0) setMyBest(myData[0].score);
  }

  const startGame = useCallback(() => {
    setPhase("countdown");
    setTaps(0);
    tapsRef.current = 0;
    setCountdown(3);

    let c = 3;
    const cdInterval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(cdInterval);
        setPhase("playing");
        setTimeLeft(GAME_DURATION);

        let t = GAME_DURATION;
        timerRef.current = setInterval(() => {
          t -= 0.1;
          setTimeLeft(Math.max(0, t));
          if (t <= 0) {
            clearInterval(timerRef.current!);
            setPhase("result");
            setTaps(tapsRef.current);
          }
        }, 100);
      }
    }, 1000);
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== "playing") return;
    tapsRef.current++;
    setTaps(tapsRef.current);
  }, [phase]);

  async function saveScore() {
    if (saving || !userIdRef.current) return;
    setSaving(true);
    const { error } = await supabase.from("cf_game_scores").insert({
      group_id: groupId,
      user_id: userIdRef.current,
      game_type: "tap_battle",
      score: taps,
    });
    if (error) {
      alert("保存エラー: " + error.message);
      console.error("saveScore error:", error);
    }
    await loadRanking();
    setSaving(false);
  }

  const tapsPerSecond = phase === "result" ? (taps / GAME_DURATION).toFixed(1) : "0";
  const isNewBest = taps > myBest && phase === "result";

  // Best scores per user (deduplicated)
  const bestByUser = new Map<string, ScoreEntry>();
  ranking.forEach((r) => {
    if (!bestByUser.has(r.user_id) || r.score > bestByUser.get(r.user_id)!.score) {
      bestByUser.set(r.user_id, r);
    }
  });
  const rankedUsers = Array.from(bestByUser.values()).sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen pb-6">
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={() => router.push(`/groups/${groupId}`)} className="text-indigo-400 text-sm mb-2">
          ← タイムラインに戻る
        </button>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">⚔️ タップバトル</h1>
          <p className="text-sm text-indigo-400 mt-1">{GAME_DURATION}秒間で何回タップできるか勝負！</p>
        </div>

        {/* Game area */}
        <Card className="border-indigo-700 bg-indigo-950/60 mb-6 overflow-hidden">
          <CardContent className="p-0">
            {phase === "idle" && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="text-6xl mb-4">🎮</div>
                <p className="text-indigo-300 text-sm mb-6">画面を連打してスコアを競え！</p>
                <Button
                  onClick={startGame}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-lg px-10 py-6"
                  size="lg"
                >
                  スタート！
                </Button>
              </div>
            )}

            {phase === "countdown" && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="text-8xl font-black text-yellow-400 animate-pulse">{countdown}</div>
                <p className="text-indigo-300 mt-4">構えろ...！</p>
              </div>
            )}

            {phase === "playing" && (
              <button
                onPointerDown={handleTap}
                className="w-full py-24 flex flex-col items-center justify-center active:bg-indigo-800/50 transition-colors select-none touch-manipulation"
              >
                <div className="text-5xl font-black text-white mb-2">{taps}</div>
                <div className="text-lg text-yellow-400 font-bold">
                  {timeLeft.toFixed(1)}秒
                </div>
                <div className="mt-4 text-indigo-400 text-sm animate-bounce">
                  👆 連打！連打！連打！
                </div>
                {/* Progress bar */}
                <div className="w-4/5 h-2 bg-indigo-900 rounded-full mt-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-100"
                    style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
                  />
                </div>
              </button>
            )}

            {phase === "result" && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                {isNewBest && (
                  <div className="text-yellow-400 text-sm font-bold mb-2 animate-bounce">
                    🏆 自己ベスト更新！
                  </div>
                )}
                <div className="text-6xl font-black text-white mb-1">{taps}</div>
                <div className="text-indigo-400 text-sm mb-1">タップ</div>
                <div className="text-indigo-300 text-sm mb-6">{tapsPerSecond} タップ/秒</div>

                <div className="flex gap-3 w-full max-w-xs">
                  <Button
                    onClick={saveScore}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold"
                  >
                    {saving ? "保存中..." : "💾 記録する"}
                  </Button>
                  <Button
                    onClick={startGame}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-bold"
                  >
                    🔄 もう一回
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            👑 ランキング
          </h2>
          {rankedUsers.length === 0 ? (
            <p className="text-sm text-indigo-500 text-center py-4">まだ記録がありません</p>
          ) : (
            rankedUsers.map((entry, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
              const isMe = entry.user_id === currentUserId;
              return (
                <Card
                  key={entry.user_id}
                  className={`border-indigo-800 ${isMe ? "bg-indigo-900/60 ring-1 ring-indigo-500" : "bg-indigo-950/40"}`}
                >
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <span className="text-xl w-8 text-center">{medal}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? "text-yellow-300" : "text-indigo-200"}`}>
                        {entry.profiles?.display_name ?? "?"}
                        {isMe && " (自分)"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-white">{entry.score}</span>
                      <span className="text-xs text-indigo-400 ml-1">tap</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
