"use client";
import { getAuthUser } from "@/lib/supabase/getAuthUser";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

const ROUNDS = 5;

type ScoreEntry = {
  id: string; user_id: string; score: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

export default function ReactionPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [phase, setPhase] = useState<"idle" | "waiting" | "ready" | "tapped" | "early" | "result">("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [myBest, setMyBest] = useState(0);

  const readyAtRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef("");

  useEffect(() => {
    async function init() {
      const user = await getAuthUser(supabase);
      if (!user) { router.push("/login"); return; }
      userIdRef.current = user.id;
      await ensureProfile(supabase, user.id);
      loadRanking(user.id);
    }
    init();
  }, [groupId]);

  async function loadRanking(userId?: string) {
    const uid = userId || userIdRef.current;
    // For reaction time, lower is better, so order ascending
    const { data } = await supabase
      .from("cf_game_scores").select("*")
      .eq("group_id", groupId).eq("game_type", "reaction")
      .order("score", { ascending: true }).limit(20);
    if (data) {
      const userIds = [...new Set(data.map((d: any) => d.user_id))];
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
        : { data: [] };
      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      setRanking(data.map((d: any) => ({ ...d, profiles: profileMap.get(d.user_id) || null })) as ScoreEntry[]);
    }
    if (!uid) return;
    const { data: myData } = await supabase
      .from("cf_game_scores").select("score")
      .eq("group_id", groupId).eq("game_type", "reaction").eq("user_id", uid)
      .order("score", { ascending: true }).limit(1);
    if (myData && myData.length > 0) setMyBest(myData[0].score);
  }

  function startGame() {
    setTimes([]);
    setRound(1);
    startRound();
  }

  function startRound() {
    setPhase("waiting");
    const delay = 1500 + Math.random() * 3500; // 1.5-5秒
    timerRef.current = setTimeout(() => {
      readyAtRef.current = performance.now();
      setPhase("ready");
    }, delay);
  }

  function handleTap() {
    if (phase === "waiting") {
      // Tapped too early
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase("early");
    } else if (phase === "ready") {
      const elapsed = Math.round(performance.now() - readyAtRef.current);
      setCurrentTime(elapsed);
      const newTimes = [...times, elapsed];
      setTimes(newTimes);
      setPhase("tapped");

      if (newTimes.length >= ROUNDS) {
        // All rounds done
        setTimeout(() => setPhase("result"), 1000);
      }
    }
  }

  function nextRound() {
    setRound(r => r + 1);
    startRound();
  }

  function retryAfterEarly() {
    startRound();
  }

  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  async function saveScore() {
    if (saving || !userIdRef.current || avgTime === 0) return;
    setSaving(true);
    const { error } = await supabase.from("cf_game_scores").insert({
      group_id: groupId, user_id: userIdRef.current, game_type: "reaction", score: avgTime,
    });
    if (error) alert("保存エラー: " + error.message);
    await loadRanking();
    setSaving(false);
  }

  const isNewBest = phase === "result" && avgTime > 0 && (myBest === 0 || avgTime < myBest);

  // Ranking: best (lowest) per user
  const bestByUser = new Map<string, ScoreEntry>();
  ranking.forEach((r) => {
    if (!bestByUser.has(r.user_id) || r.score < bestByUser.get(r.user_id)!.score)
      bestByUser.set(r.user_id, r);
  });
  const rankedUsers = Array.from(bestByUser.values()).sort((a, b) => a.score - b.score);

  // Prevent scrolling
  useEffect(() => {
    if (phase !== "waiting" && phase !== "ready") return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.body.style.overflow = "hidden";
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("touchmove", prevent);
    };
  }, [phase]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const getRating = (ms: number) => {
    if (ms < 200) return { text: "⚡ 超人", color: "text-yellow-400" };
    if (ms < 250) return { text: "🔥 すごい！", color: "text-orange-400" };
    if (ms < 300) return { text: "👍 なかなか", color: "text-green-400" };
    if (ms < 400) return { text: "😊 普通", color: "text-indigo-300" };
    return { text: "🐢 もうちょい", color: "text-indigo-400" };
  };

  return (
    <div className="min-h-screen pb-6">
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={() => router.push(`/groups/${groupId}/game`)} className="text-indigo-400 text-sm mb-2">
          ← ゲーム一覧に戻る
        </button>
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white">🎯 リアクションタイム</h1>
        </div>

        {phase === "idle" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-16 flex flex-col items-center">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-indigo-300 text-sm mb-2">画面が緑になったら即タップ！</p>
              <p className="text-indigo-400 text-xs mb-6">{ROUNDS}回の平均タイムで勝負</p>
              <Button onClick={startGame} className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg px-10 py-6" size="lg">
                スタート！
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "waiting" && (
          <button
            onPointerDown={handleTap}
            className="w-full rounded-2xl bg-red-900 py-32 flex flex-col items-center justify-center select-none touch-manipulation mb-4"
          >
            <p className="text-red-300 text-lg font-bold">待て...</p>
            <p className="text-red-400 text-sm mt-2">緑になったらタップ！</p>
            <p className="text-red-500 text-xs mt-4">Round {round}/{ROUNDS}</p>
          </button>
        )}

        {phase === "ready" && (
          <button
            onPointerDown={handleTap}
            className="w-full rounded-2xl bg-green-600 py-32 flex flex-col items-center justify-center select-none touch-manipulation mb-4 animate-pulse"
          >
            <p className="text-white text-3xl font-black">タップ！</p>
          </button>
        )}

        {phase === "tapped" && (
          <div className="w-full rounded-2xl bg-indigo-900 py-20 flex flex-col items-center justify-center mb-4">
            <p className="text-4xl font-black text-white">{currentTime}ms</p>
            <p className={`text-sm font-bold mt-2 ${getRating(currentTime).color}`}>{getRating(currentTime).text}</p>
            <p className="text-indigo-400 text-xs mt-4">Round {round}/{ROUNDS}</p>
            {times.length < ROUNDS && (
              <Button onClick={nextRound} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white">
                次のラウンド →
              </Button>
            )}
          </div>
        )}

        {phase === "early" && (
          <div className="w-full rounded-2xl bg-yellow-900 py-20 flex flex-col items-center justify-center mb-4">
            <p className="text-2xl font-bold text-yellow-300">💥 早すぎ！</p>
            <p className="text-yellow-400 text-sm mt-2">緑になるまで待って！</p>
            <Button onClick={retryAfterEarly} className="mt-4 bg-yellow-700 hover:bg-yellow-600 text-white">
              もう一度 →
            </Button>
          </div>
        )}

        {phase === "result" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <p className="text-indigo-300 font-bold text-sm mb-2">{ROUNDS}回の結果</p>
              {isNewBest && <div className="text-yellow-400 text-sm font-bold mb-2 animate-bounce">🏆 自己ベスト更新！</div>}
              <div className="text-5xl font-black text-white mb-1">{avgTime}ms</div>
              <p className={`text-sm font-bold ${getRating(avgTime).color}`}>{getRating(avgTime).text}</p>
              <div className="flex gap-2 mt-2 mb-6">
                {times.map((t, i) => (
                  <span key={i} className="text-xs text-indigo-400">{t}ms</span>
                ))}
              </div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button onClick={saveScore} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  {saving ? "保存中..." : "💾 記録する"}
                </Button>
                <Button onClick={startGame} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold">
                  🔄 もう一回
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ranking - lower is better */}
        <div className="space-y-2 mt-4">
          <h2 className="text-lg font-bold text-white">👑 ランキング <span className="text-xs text-indigo-400 font-normal">（速い順）</span></h2>
          {rankedUsers.length === 0 ? (
            <p className="text-sm text-indigo-500 text-center py-4">まだ記録がありません</p>
          ) : (
            rankedUsers.map((entry, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
              const isMe = entry.user_id === userIdRef.current;
              return (
                <Card key={entry.user_id} className={`border-indigo-800 ${isMe ? "bg-indigo-900/60 ring-1 ring-indigo-500" : "bg-indigo-950/40"}`}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <span className="text-xl w-8 text-center">{medal}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? "text-yellow-300" : "text-indigo-200"}`}>
                        {entry.profiles?.display_name ?? "?"}{isMe && " (自分)"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-white">{entry.score}</span>
                      <span className="text-xs text-indigo-400 ml-1">ms</span>
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
