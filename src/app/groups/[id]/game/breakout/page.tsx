"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

const CANVAS_W = 320;
const CANVAS_H = 480;
const PADDLE_W = 60;
const PADDLE_H = 12;
const BALL_R = 6;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_W = CANVAS_W / BRICK_COLS;
const BRICK_H = 16;
const BRICK_TOP = 50;

const BRICK_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#a855f7"];

type ScoreEntry = {
  id: string; user_id: string; score: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

function createBricks(): boolean[][] {
  return Array.from({ length: BRICK_ROWS }, () => Array(BRICK_COLS).fill(true));
}

export default function BreakoutPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [phase, setPhase] = useState<"idle" | "playing" | "clear" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [myBest, setMyBest] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number>(0);
  const userIdRef = useRef("");

  // Game state refs
  const paddleXRef = useRef(CANVAS_W / 2 - PADDLE_W / 2);
  const ballRef = useRef({ x: CANVAS_W / 2, y: CANVAS_H - 40, dx: 3, dy: -3 });
  const bricksRef = useRef(createBricks());
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const phaseRef = useRef<"idle" | "playing" | "clear" | "gameover">("idle");

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
      .eq("group_id", groupId).eq("game_type", "breakout")
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
      .eq("group_id", groupId).eq("game_type", "breakout").eq("user_id", uid)
      .order("score", { ascending: false }).limit(1);
    if (myData && myData.length > 0) setMyBest(myData[0].score);
  }

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Bricks
    const bricks = bricksRef.current;
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (bricks[r][c]) {
          ctx.fillStyle = BRICK_COLORS[r];
          ctx.fillRect(c * BRICK_W + 1, BRICK_TOP + r * BRICK_H + 1, BRICK_W - 2, BRICK_H - 2);
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(c * BRICK_W + 1, BRICK_TOP + r * BRICK_H + 1, BRICK_W - 2, 3);
        }
      }
    }

    // Paddle
    const px = paddleXRef.current;
    ctx.fillStyle = "#818cf8";
    ctx.beginPath();
    ctx.roundRect(px, CANVAS_H - 24, PADDLE_W, PADDLE_H, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(px + 2, CANVAS_H - 24, PADDLE_W - 4, 3);

    // Ball
    const ball = ballRef.current;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, BALL_R / 2, 0, Math.PI * 2);
    ctx.fill();

    // HUD
    ctx.fillStyle = "#e0e7ff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${scoreRef.current}`, 8, 18);
    ctx.textAlign = "center";
    ctx.fillText(`Lv.${levelRef.current}`, CANVAS_W / 2, 18);
    ctx.textAlign = "right";
    ctx.fillText(`♥`.repeat(livesRef.current), CANVAS_W - 8, 18);
    ctx.textAlign = "left";
  }, []);

  const resetBall = useCallback(() => {
    ballRef.current = {
      x: CANVAS_W / 2,
      y: CANVAS_H - 40,
      dx: (2.5 + levelRef.current * 0.5) * (Math.random() > 0.5 ? 1 : -1),
      dy: -(2.5 + levelRef.current * 0.5),
    };
    paddleXRef.current = CANVAS_W / 2 - PADDLE_W / 2;
  }, []);

  const startGame = useCallback(() => {
    bricksRef.current = createBricks();
    scoreRef.current = 0;
    livesRef.current = 3;
    levelRef.current = 1;
    phaseRef.current = "playing";
    setScore(0);
    setLives(3);
    setLevel(1);
    setPhase("playing");
    resetBall();

    const loop = () => {
      if (phaseRef.current !== "playing") return;
      update();
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [draw, resetBall]);

  const nextLevel = useCallback(() => {
    levelRef.current++;
    setLevel(levelRef.current);
    bricksRef.current = createBricks();
    resetBall();
    phaseRef.current = "playing";
    setPhase("playing");

    const loop = () => {
      if (phaseRef.current !== "playing") return;
      update();
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [draw, resetBall]);

  const update = useCallback(() => {
    const ball = ballRef.current;
    const bricks = bricksRef.current;

    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.x - BALL_R <= 0 || ball.x + BALL_R >= CANVAS_W) ball.dx = -ball.dx;
    if (ball.y - BALL_R <= 0) ball.dy = -ball.dy;

    // Paddle collision
    const px = paddleXRef.current;
    if (
      ball.dy > 0 &&
      ball.y + BALL_R >= CANVAS_H - 24 &&
      ball.y + BALL_R <= CANVAS_H - 12 &&
      ball.x >= px &&
      ball.x <= px + PADDLE_W
    ) {
      ball.dy = -Math.abs(ball.dy);
      // Angle based on hit position
      const hitPos = (ball.x - px) / PADDLE_W; // 0 to 1
      ball.dx = (hitPos - 0.5) * (5 + levelRef.current);
    }

    // Ball out of bounds
    if (ball.y > CANVAS_H + BALL_R) {
      livesRef.current--;
      setLives(livesRef.current);
      if (livesRef.current <= 0) {
        phaseRef.current = "gameover";
        setPhase("gameover");
        setScore(scoreRef.current);
        return;
      }
      resetBall();
    }

    // Brick collision
    let remaining = 0;
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (!bricks[r][c]) continue;
        remaining++;
        const bx = c * BRICK_W;
        const by = BRICK_TOP + r * BRICK_H;
        if (
          ball.x + BALL_R > bx &&
          ball.x - BALL_R < bx + BRICK_W &&
          ball.y + BALL_R > by &&
          ball.y - BALL_R < by + BRICK_H
        ) {
          bricks[r][c] = false;
          remaining--;
          ball.dy = -ball.dy;
          const points = (BRICK_ROWS - r) * 10 * levelRef.current;
          scoreRef.current += points;
          setScore(scoreRef.current);
        }
      }
    }

    // All bricks cleared
    if (remaining === 0) {
      phaseRef.current = "clear";
      setPhase("clear");
      setScore(scoreRef.current);
    }
  }, [resetBall]);

  // Touch/mouse controls
  useEffect(() => {
    if (phase !== "playing") return;

    const handleMove = (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scale = CANVAS_W / rect.width;
      const x = (clientX - rect.left) * scale;
      paddleXRef.current = Math.max(0, Math.min(CANVAS_W - PADDLE_W, x - PADDLE_W / 2));
    };

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };
    const onMouse = (e: MouseEvent) => handleMove(e.clientX);

    const canvas = canvasRef.current;
    canvas?.addEventListener("touchmove", onTouch, { passive: false });
    canvas?.addEventListener("touchstart", onTouch, { passive: false });
    canvas?.addEventListener("mousemove", onMouse);

    return () => {
      canvas?.removeEventListener("touchmove", onTouch);
      canvas?.removeEventListener("touchstart", onTouch);
      canvas?.removeEventListener("mousemove", onMouse);
    };
  }, [phase]);

  // Prevent scrolling during gameplay
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
      group_id: groupId, user_id: userIdRef.current, game_type: "breakout", score: score,
    });
    if (error) alert("保存エラー: " + error.message);
    await loadRanking();
    setSaving(false);
  }

  const isNewBest = score > myBest && (phase === "gameover" || phase === "clear");
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
          <h1 className="text-2xl font-bold text-white">🏓 ブロック崩し</h1>
        </div>

        {phase === "idle" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-16 flex flex-col items-center">
              <div className="text-6xl mb-4">🏓</div>
              <p className="text-indigo-300 text-sm mb-6">パドルでボールを弾いてブロックを壊せ！</p>
              <Button onClick={startGame} className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg px-10 py-6" size="lg">
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
              className="border-2 border-indigo-600 rounded-lg w-full max-w-[320px]"
              style={{ touchAction: "none" }}
            />
          </div>
        )}

        {phase === "clear" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <div className="text-yellow-400 text-lg font-bold mb-2 animate-bounce">🎉 ステージクリア！</div>
              <div className="text-4xl font-black text-white mb-1">{score}</div>
              <div className="text-indigo-400 text-sm mb-6">スコア（Lv.{level}）</div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button onClick={saveScore} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  {saving ? "保存中..." : "💾 記録する"}
                </Button>
                <Button onClick={nextLevel} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold">
                  ▶ 次のレベル
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "gameover" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <p className="text-red-400 font-bold text-lg mb-2">GAME OVER</p>
              {isNewBest && (
                <div className="text-yellow-400 text-sm font-bold mb-2 animate-bounce">🏆 自己ベスト更新！</div>
              )}
              <div className="text-5xl font-black text-white mb-1">{score}</div>
              <div className="text-indigo-400 text-sm mb-1">スコア</div>
              <div className="text-indigo-300 text-sm mb-6">Lv.{level} まで到達</div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button onClick={saveScore} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  {saving ? "保存中..." : "💾 記録する"}
                </Button>
                <Button onClick={startGame} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold">
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
