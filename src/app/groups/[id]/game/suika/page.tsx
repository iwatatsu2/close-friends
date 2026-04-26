"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

const CANVAS_W = 300;
const CANVAS_H = 500;
const WALL_W = 8;
const FLOOR_Y = CANVAS_H - WALL_W;
const GRAVITY = 0.3;
const BOUNCE = 0.3;
const FRICTION = 0.98;
const GAME_OVER_LINE = 80;

// Fruits: index 0-10, each merges into next
const FRUITS = [
  { name: "さくらんぼ", emoji: "🍒", r: 12, color: "#dc2626", pts: 1 },
  { name: "いちご",     emoji: "🍓", r: 16, color: "#f43f5e", pts: 3 },
  { name: "ぶどう",     emoji: "🍇", r: 20, color: "#7c3aed", pts: 6 },
  { name: "みかん",     emoji: "🍊", r: 24, color: "#f97316", pts: 10 },
  { name: "かき",       emoji: "🟠", r: 28, color: "#ea580c", pts: 15 },
  { name: "りんご",     emoji: "🍎", r: 32, color: "#ef4444", pts: 21 },
  { name: "なし",       emoji: "🍐", r: 36, color: "#a3e635", pts: 28 },
  { name: "もも",       emoji: "🍑", r: 42, color: "#fb923c", pts: 36 },
  { name: "パイナップル", emoji: "🍍", r: 48, color: "#facc15", pts: 45 },
  { name: "メロン",     emoji: "🍈", r: 54, color: "#22c55e", pts: 55 },
  { name: "スイカ",     emoji: "🍉", r: 62, color: "#16a34a", pts: 100 },
];

type Ball = {
  x: number; y: number; vx: number; vy: number;
  r: number; type: number; id: number; merged: boolean;
};

type ScoreEntry = {
  id: string; user_id: string; score: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

let nextId = 0;
function makeBall(type: number, x: number, y: number): Ball {
  return { x, y, vx: 0, vy: 0, r: FRUITS[type].r, type, id: nextId++, merged: false };
}

export default function SuikaPage() {
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
  const ballsRef = useRef<Ball[]>([]);
  const scoreRef = useRef(0);
  const phaseRef = useRef<string>("idle");
  const dropXRef = useRef(CANVAS_W / 2);
  const nextTypeRef = useRef(0);
  const currentTypeRef = useRef(0);
  const canDropRef = useRef(true);
  const gameOverTimerRef = useRef(0);
  const [nextType, setNextType] = useState(0);
  const [dropX, setDropX] = useState(CANVAS_W / 2);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
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
      .eq("group_id", groupId).eq("game_type", "suika")
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
      .eq("group_id", groupId).eq("game_type", "suika").eq("user_id", uid)
      .order("score", { ascending: false }).limit(1);
    if (myData && myData.length > 0) setMyBest(myData[0].score);
  }

  const randomSmallFruit = () => Math.floor(Math.random() * 5); // 0-4 only for drops

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#1a1333";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Walls
    ctx.fillStyle = "#4338ca";
    ctx.fillRect(0, 0, WALL_W, CANVAS_H); // left
    ctx.fillRect(CANVAS_W - WALL_W, 0, WALL_W, CANVAS_H); // right
    ctx.fillRect(0, FLOOR_Y, CANVAS_W, WALL_W); // floor

    // Game over line
    ctx.strokeStyle = "rgba(239,68,68,0.4)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(WALL_W, GAME_OVER_LINE);
    ctx.lineTo(CANVAS_W - WALL_W, GAME_OVER_LINE);
    ctx.stroke();
    ctx.setLineDash([]);

    // Drop preview
    if (canDropRef.current && phaseRef.current === "playing") {
      const fruit = FRUITS[currentTypeRef.current];
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = fruit.color;
      ctx.beginPath();
      ctx.arc(dropXRef.current, 40, fruit.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = `${fruit.r}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fruit.emoji, dropXRef.current, 40);
    }

    // Balls
    for (const b of ballsRef.current) {
      const fruit = FRUITS[b.type];
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + b.r * 0.8, b.r * 0.8, b.r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = fruit.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Emoji
      ctx.font = `${b.r * 1.1}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fruit.emoji, b.x, b.y);
    }

    // HUD
    ctx.fillStyle = "#e0e7ff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${scoreRef.current}`, WALL_W + 4, 4);

    // Next preview
    if (phaseRef.current === "playing") {
      ctx.textAlign = "right";
      ctx.fillText("NEXT:", CANVAS_W - WALL_W - 30, 4);
      const nf = FRUITS[nextTypeRef.current];
      ctx.font = `18px serif`;
      ctx.fillText(nf.emoji, CANVAS_W - WALL_W - 6, 0);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }, []);

  const physics = useCallback(() => {
    const balls = ballsRef.current;
    const left = WALL_W;
    const right = CANVAS_W - WALL_W;

    for (const b of balls) {
      b.vy += GRAVITY;
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= FRICTION;

      // Floor
      if (b.y + b.r > FLOOR_Y) {
        b.y = FLOOR_Y - b.r;
        b.vy = -b.vy * BOUNCE;
        if (Math.abs(b.vy) < 0.5) b.vy = 0;
      }
      // Walls
      if (b.x - b.r < left) { b.x = left + b.r; b.vx = Math.abs(b.vx) * BOUNCE; }
      if (b.x + b.r > right) { b.x = right - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }
    }

    // Ball-ball collisions
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.r + b.r;
        if (dist < minDist && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          const overlap = minDist - dist;
          const totalMass = a.r + b.r;
          a.x -= nx * overlap * (b.r / totalMass);
          a.y -= ny * overlap * (b.r / totalMass);
          b.x += nx * overlap * (a.r / totalMass);
          b.y += ny * overlap * (a.r / totalMass);

          // Velocity exchange
          const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
          const dvDotN = dvx * nx + dvy * ny;
          if (dvDotN > 0) {
            const restitution = 0.3;
            a.vx -= dvDotN * nx * restitution;
            a.vy -= dvDotN * ny * restitution;
            b.vx += dvDotN * nx * restitution;
            b.vy += dvDotN * ny * restitution;
          }
        }
      }
    }

    // Merge same-type balls
    const toAdd: Ball[] = [];
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        if (a.merged || b.merged || a.type !== b.type) continue;
        if (a.type >= FRUITS.length - 1) continue; // スイカ同士はマージしない
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (a.r + b.r) * 0.8) {
          a.merged = true;
          b.merged = true;
          const newType = a.type + 1;
          const newBall = makeBall(newType, (a.x + b.x) / 2, (a.y + b.y) / 2);
          toAdd.push(newBall);
          scoreRef.current += FRUITS[newType].pts;
          setScore(scoreRef.current);
        }
      }
    }

    ballsRef.current = [...balls.filter(b => !b.merged), ...toAdd];

    // Game over check: any ball above line for sustained time
    const anyAbove = ballsRef.current.some(b => b.y - b.r < GAME_OVER_LINE && Math.abs(b.vy) < 1);
    if (anyAbove) {
      gameOverTimerRef.current++;
      if (gameOverTimerRef.current > 90) { // ~1.5 seconds
        phaseRef.current = "gameover";
        setPhase("gameover");
        setScore(scoreRef.current);
      }
    } else {
      gameOverTimerRef.current = 0;
    }
  }, []);

  const startGame = useCallback(() => {
    nextId = 0;
    ballsRef.current = [];
    scoreRef.current = 0;
    gameOverTimerRef.current = 0;
    currentTypeRef.current = randomSmallFruit();
    nextTypeRef.current = randomSmallFruit();
    setNextType(nextTypeRef.current);
    canDropRef.current = true;
    dropXRef.current = CANVAS_W / 2;
    setDropX(CANVAS_W / 2);
    setScore(0);
    phaseRef.current = "playing";
    setPhase("playing");

    const loop = () => {
      if (phaseRef.current !== "playing") return;
      physics();
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [physics, draw]);

  // Drop fruit
  const dropFruit = useCallback(() => {
    if (!canDropRef.current || phaseRef.current !== "playing") return;
    const ball = makeBall(currentTypeRef.current, dropXRef.current, 40);
    ballsRef.current.push(ball);
    canDropRef.current = false;

    // Next fruit after delay
    setTimeout(() => {
      currentTypeRef.current = nextTypeRef.current;
      nextTypeRef.current = randomSmallFruit();
      setNextType(nextTypeRef.current);
      canDropRef.current = true;
    }, 500);
  }, []);

  // Touch/mouse controls
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const scale = CANVAS_W / rect.width;
      const x = (clientX - rect.left) * scale;
      const fruit = FRUITS[currentTypeRef.current];
      return Math.max(WALL_W + fruit.r, Math.min(CANVAS_W - WALL_W - fruit.r, x));
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const x = getX(e.touches[0].clientX);
      dropXRef.current = x;
      setDropX(x);
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const x = getX(e.touches[0].clientX);
      dropXRef.current = x;
      setDropX(x);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      dropFruit();
    };
    const onMouseMove = (e: MouseEvent) => {
      const x = getX(e.clientX);
      dropXRef.current = x;
      setDropX(x);
    };
    const onClick = () => dropFruit();

    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);

    return () => {
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [phase, dropFruit]);

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
      group_id: groupId, user_id: userIdRef.current, game_type: "suika", score,
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
          <h1 className="text-2xl font-bold text-white">🍉 スイカゲーム</h1>
        </div>

        {phase === "idle" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <div className="text-6xl mb-4">🍉</div>
              <p className="text-indigo-300 text-sm mb-2">同じフルーツをくっつけて進化させよう！</p>
              <div className="flex flex-wrap justify-center gap-1 mb-6 text-lg">
                {FRUITS.map((f, i) => (
                  <span key={i} title={f.name}>{f.emoji}</span>
                ))}
              </div>
              <Button onClick={startGame} className="bg-green-600 hover:bg-green-500 text-white font-bold text-lg px-10 py-6" size="lg">
                スタート！
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "playing" && (
          <div className="flex justify-center mb-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="border-2 border-indigo-600 rounded-lg w-full max-w-[300px]"
              style={{ touchAction: "none" }}
            />
          </div>
        )}

        {phase === "gameover" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <p className="text-red-400 font-bold text-lg mb-2">GAME OVER</p>
              {isNewBest && (
                <div className="text-yellow-400 text-sm font-bold mb-2 animate-bounce">🏆 自己ベスト更新！</div>
              )}
              <div className="text-5xl font-black text-white mb-1">{score}</div>
              <div className="text-indigo-400 text-sm mb-6">スコア</div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button onClick={saveScore} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  {saving ? "保存中..." : "💾 記録する"}
                </Button>
                <Button onClick={startGame} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  🔄 もう一回
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ranking */}
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
                        {entry.profiles?.display_name ?? "?"}
                        {isMe && " (自分)"}
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
