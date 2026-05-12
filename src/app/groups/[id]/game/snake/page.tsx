"use client";
import { getAuthUser } from "@/lib/supabase/getAuthUser";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

const COLS = 20;
const ROWS = 20;
const CELL = 15;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

type Dir = "up" | "down" | "left" | "right";
type Pos = { x: number; y: number };
type ScoreEntry = {
  id: string; user_id: string; score: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

export default function SnakePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [phase, setPhase] = useState<"idle" | "playing" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [myBest, setMyBest] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number>(0);
  const userIdRef = useRef("");
  const snakeRef = useRef<Pos[]>([]);
  const dirRef = useRef<Dir>("right");
  const nextDirRef = useRef<Dir>("right");
  const foodRef = useRef<Pos>({ x: 10, y: 10 });
  const scoreRef = useRef(0);
  const speedRef = useRef(150);
  const lastMoveRef = useRef(0);
  const phaseRef = useRef("idle");

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
    const { data } = await supabase
      .from("cf_game_scores").select("*")
      .eq("group_id", groupId).eq("game_type", "snake")
      .order("score", { ascending: false }).limit(20);
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
      .eq("group_id", groupId).eq("game_type", "snake").eq("user_id", uid)
      .order("score", { ascending: false }).limit(1);
    if (myData && myData.length > 0) setMyBest(myData[0].score);
  }

  const placeFood = useCallback(() => {
    const snake = snakeRef.current;
    let pos: Pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    foodRef.current = pos;
  }, []);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    ctx.strokeStyle = "#272061";
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);

    // Food
    const food = foodRef.current;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${CELL - 2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍎", food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);

    // Snake
    const snake = snakeRef.current;
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? "#22c55e" : "#4ade80";
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      if (isHead) {
        ctx.fillStyle = "#166534";
        ctx.beginPath();
        ctx.arc(seg.x * CELL + CELL / 2, seg.y * CELL + CELL / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Score
    ctx.fillStyle = "#e0e7ff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${scoreRef.current}`, 4, 2);
  }, []);

  const update = useCallback(() => {
    const snake = snakeRef.current;
    dirRef.current = nextDirRef.current;
    const head = snake[0];
    const dir = dirRef.current;

    const newHead: Pos = {
      x: head.x + (dir === "right" ? 1 : dir === "left" ? -1 : 0),
      y: head.y + (dir === "down" ? 1 : dir === "up" ? -1 : 0),
    };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      phaseRef.current = "gameover";
      setPhase("gameover");
      setScore(scoreRef.current);
      return;
    }

    // Self collision
    if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      phaseRef.current = "gameover";
      setPhase("gameover");
      setScore(scoreRef.current);
      return;
    }

    snake.unshift(newHead);

    // Eat food
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      placeFood();
      // Speed up
      speedRef.current = Math.max(60, 150 - Math.floor(scoreRef.current / 50) * 10);
    } else {
      snake.pop();
    }
  }, [placeFood]);

  const startGame = useCallback(() => {
    snakeRef.current = [
      { x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 },
    ];
    dirRef.current = "right";
    nextDirRef.current = "right";
    scoreRef.current = 0;
    speedRef.current = 150;
    phaseRef.current = "playing";
    setScore(0);
    setPhase("playing");
    placeFood();
    lastMoveRef.current = performance.now();

    const loop = (time: number) => {
      if (phaseRef.current !== "playing") return;
      if (time - lastMoveRef.current > speedRef.current) {
        update();
        lastMoveRef.current = time;
      }
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [update, draw, placeFood]);

  // Swipe controls
  useEffect(() => {
    if (phase !== "playing") return;
    let startX = 0, startY = 0;

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dir = dirRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 20 && dir !== "left") nextDirRef.current = "right";
        else if (dx < -20 && dir !== "right") nextDirRef.current = "left";
      } else {
        if (dy > 20 && dir !== "up") nextDirRef.current = "down";
        else if (dy < -20 && dir !== "down") nextDirRef.current = "up";
      }
    };

    const canvas = canvasRef.current;
    canvas?.addEventListener("touchstart", onStart, { passive: false });
    canvas?.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      canvas?.removeEventListener("touchstart", onStart);
      canvas?.removeEventListener("touchend", onEnd);
    };
  }, [phase]);

  // Keyboard
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      const dir = dirRef.current;
      if (e.key === "ArrowUp" && dir !== "down") nextDirRef.current = "up";
      else if (e.key === "ArrowDown" && dir !== "up") nextDirRef.current = "down";
      else if (e.key === "ArrowLeft" && dir !== "right") nextDirRef.current = "left";
      else if (e.key === "ArrowRight" && dir !== "left") nextDirRef.current = "right";
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase]);

  // Prevent scrolling
  useEffect(() => {
    if (phase !== "playing") return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.body.style.overflow = "hidden";
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("touchmove", prevent);
    };
  }, [phase]);

  useEffect(() => {
    return () => { if (loopRef.current) cancelAnimationFrame(loopRef.current); };
  }, []);

  async function saveScore() {
    if (saving || !userIdRef.current) return;
    setSaving(true);
    const { error } = await supabase.from("cf_game_scores").insert({
      group_id: groupId, user_id: userIdRef.current, game_type: "snake", score,
    });
    if (error) alert("保存エラー: " + error.message);
    await loadRanking();
    setSaving(false);
  }

  const isNewBest = score > myBest && phase === "gameover";
  const bestByUser = new Map<string, ScoreEntry>();
  ranking.forEach((r) => {
    if (!bestByUser.has(r.user_id) || r.score > bestByUser.get(r.user_id)!.score)
      bestByUser.set(r.user_id, r);
  });
  const rankedUsers = Array.from(bestByUser.values()).sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen pb-6">
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={() => router.push(`/groups/${groupId}/game`)} className="text-indigo-400 text-sm mb-2">
          ← ゲーム一覧に戻る
        </button>
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white">🐍 スネーク</h1>
        </div>

        {phase === "idle" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-16 flex flex-col items-center">
              <div className="text-6xl mb-4">🐍</div>
              <p className="text-indigo-300 text-sm mb-2">スワイプでヘビを操作！</p>
              <p className="text-indigo-400 text-xs mb-6">🍎を食べて長くなれ！壁と自分に当たったらゲームオーバー</p>
              <Button onClick={startGame} className="bg-lime-600 hover:bg-lime-500 text-white font-bold text-lg px-10 py-6" size="lg">
                スタート！
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "playing" && (
          <>
            <div className="flex justify-center mb-3">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="border-2 border-indigo-600 rounded-lg"
                style={{ touchAction: "none" }}
              />
            </div>
            <div className="flex justify-center gap-2">
              <div className="grid grid-cols-3 gap-1">
                <div />
                <button onPointerDown={() => { if (dirRef.current !== "down") nextDirRef.current = "up"; }} className="w-12 h-10 bg-indigo-800 active:bg-indigo-600 rounded-lg text-white text-lg select-none touch-manipulation">▲</button>
                <div />
                <button onPointerDown={() => { if (dirRef.current !== "right") nextDirRef.current = "left"; }} className="w-12 h-10 bg-indigo-800 active:bg-indigo-600 rounded-lg text-white text-lg select-none touch-manipulation">◀</button>
                <button onPointerDown={() => { if (dirRef.current !== "up") nextDirRef.current = "down"; }} className="w-12 h-10 bg-indigo-800 active:bg-indigo-600 rounded-lg text-white text-lg select-none touch-manipulation">▼</button>
                <button onPointerDown={() => { if (dirRef.current !== "left") nextDirRef.current = "right"; }} className="w-12 h-10 bg-indigo-800 active:bg-indigo-600 rounded-lg text-white text-lg select-none touch-manipulation">▶</button>
              </div>
            </div>
          </>
        )}

        {phase === "gameover" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <p className="text-red-400 font-bold text-lg mb-2">GAME OVER</p>
              {isNewBest && <div className="text-yellow-400 text-sm font-bold mb-2 animate-bounce">🏆 自己ベスト更新！</div>}
              <div className="text-5xl font-black text-white mb-1">{score}</div>
              <div className="text-indigo-400 text-sm mb-6">スコア</div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button onClick={saveScore} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  {saving ? "保存中..." : "💾 記録する"}
                </Button>
                <Button onClick={startGame} className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-bold">
                  🔄 もう一回
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2 mt-4">
          <h2 className="text-lg font-bold text-white">👑 ランキング</h2>
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
                      <span className="text-xs text-indigo-400 ml-1">pt</span>
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
