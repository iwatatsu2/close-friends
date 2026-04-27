"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

const W = 320;
const H = 480;
const PLAYER_R = 12;
const BULLET_R = 4;
const BULLET_SPEED = 6;
const FIRE_INTERVAL = 400; // ms
const ZOMBIE_R = 10;
const ZOMBIE_BASE_SPEED = 0.6;
const SPAWN_INTERVAL_BASE = 1200; // ms
const XP_PER_KILL = 1;
const XP_TO_LEVEL = [0, 5, 12, 22, 35, 50, 70, 95, 125, 160]; // cumulative

type Zombie = { x: number; y: number; hp: number; maxHp: number; speed: number; type: number };
type Bullet = { x: number; y: number; dx: number; dy: number };
type Particle = { x: number; y: number; dx: number; dy: number; life: number; color: string };
type ScoreEntry = {
  id: string; user_id: string; score: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

export default function ZombiePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [phase, setPhase] = useState<"idle" | "playing" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [myBest, setMyBest] = useState(0);
  const [displayLevel, setDisplayLevel] = useState(1);
  const [displayHp, setDisplayHp] = useState(3);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number>(0);
  const userIdRef = useRef("");
  const phaseRef = useRef("idle");

  // Game state
  const playerRef = useRef({ x: W / 2, y: H / 2 });
  const moveTargetRef = useRef({ x: W / 2, y: H / 2 });
  const zombiesRef = useRef<Zombie[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const killsRef = useRef(0);
  const levelRef = useRef(1);
  const hpRef = useRef(3);
  const maxHpRef = useRef(3);
  const lastFireRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const elapsedRef = useRef(0);
  const damageRef = useRef(1);
  const bulletCountRef = useRef(1);
  const invincibleRef = useRef(0);

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
      .eq("group_id", groupId).eq("game_type", "zombie")
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
      .eq("group_id", groupId).eq("game_type", "zombie").eq("user_id", uid)
      .order("score", { ascending: false }).limit(1);
    if (myData && myData.length > 0) setMyBest(myData[0].score);
  }

  const spawnZombie = useCallback(() => {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = Math.random() * W; y = -20; }
    else if (side === 1) { x = Math.random() * W; y = H + 20; }
    else if (side === 2) { x = -20; y = Math.random() * H; }
    else { x = W + 20; y = Math.random() * H; }

    const wave = Math.floor(elapsedRef.current / 15000); // every 15s
    const isBoss = wave > 0 && Math.random() < 0.08 + wave * 0.02;
    const hp = isBoss ? 5 + wave * 3 : 1 + Math.floor(wave * 0.5);
    const speed = ZOMBIE_BASE_SPEED + wave * 0.08 + (isBoss ? -0.2 : Math.random() * 0.3);
    const type = isBoss ? 1 : 0;

    zombiesRef.current.push({ x, y, hp, maxHp: hp, speed, type });
  }, []);

  const fireAtNearest = useCallback(() => {
    const p = playerRef.current;
    const zombies = zombiesRef.current;
    if (zombies.length === 0) return;

    // Sort by distance, fire at closest N
    const sorted = [...zombies].sort((a, b) => {
      const da = Math.hypot(a.x - p.x, a.y - p.y);
      const db = Math.hypot(b.x - p.x, b.y - p.y);
      return da - db;
    });

    const targets = sorted.slice(0, bulletCountRef.current);
    for (const z of targets) {
      const dx = z.x - p.x, dy = z.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) continue;
      bulletsRef.current.push({
        x: p.x, y: p.y,
        dx: (dx / dist) * BULLET_SPEED,
        dy: (dy / dist) * BULLET_SPEED,
      });
    }
  }, []);

  const addParticles = useCallback((x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particlesRef.current.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 15,
        color,
      });
    }
  }, []);

  const checkLevelUp = useCallback(() => {
    const kills = killsRef.current;
    const currentLevel = levelRef.current;
    const nextXp = XP_TO_LEVEL[currentLevel] ?? (currentLevel * 20 + 50);
    if (kills >= nextXp && currentLevel < 30) {
      levelRef.current++;
      setDisplayLevel(levelRef.current);

      // Random upgrade
      const upgrades = ["damage", "speed", "bullets", "hp"];
      const pick = upgrades[Math.floor(Math.random() * upgrades.length)];
      if (pick === "damage") damageRef.current += 0.5;
      else if (pick === "bullets") bulletCountRef.current = Math.min(5, bulletCountRef.current + 1);
      else if (pick === "hp") { maxHpRef.current++; hpRef.current = Math.min(hpRef.current + 1, maxHpRef.current); setDisplayHp(hpRef.current); }

      addParticles(playerRef.current.x, playerRef.current.y, "#fbbf24", 15);
    }
  }, [addParticles]);

  const update = useCallback((dt: number) => {
    const p = playerRef.current;
    const target = moveTargetRef.current;
    elapsedRef.current += dt;

    // Move player toward target
    const pdx = target.x - p.x, pdy = target.y - p.y;
    const pdist = Math.hypot(pdx, pdy);
    if (pdist > 3) {
      const speed = 2.5;
      p.x += (pdx / pdist) * speed;
      p.y += (pdy / pdist) * speed;
    }
    p.x = Math.max(PLAYER_R, Math.min(W - PLAYER_R, p.x));
    p.y = Math.max(PLAYER_R, Math.min(H - PLAYER_R, p.y));

    if (invincibleRef.current > 0) invincibleRef.current--;

    // Auto fire
    const now = performance.now();
    if (now - lastFireRef.current > FIRE_INTERVAL) {
      fireAtNearest();
      lastFireRef.current = now;
    }

    // Spawn
    const spawnInterval = Math.max(300, SPAWN_INTERVAL_BASE - Math.floor(elapsedRef.current / 5000) * 80);
    if (now - lastSpawnRef.current > spawnInterval) {
      spawnZombie();
      lastSpawnRef.current = now;
    }

    // Update bullets
    bulletsRef.current = bulletsRef.current.filter(b => {
      b.x += b.dx;
      b.y += b.dy;
      if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) return false;

      // Hit zombie
      for (const z of zombiesRef.current) {
        if (Math.hypot(b.x - z.x, b.y - z.y) < ZOMBIE_R + BULLET_R) {
          z.hp -= damageRef.current;
          addParticles(b.x, b.y, "#a3e635", 3);
          return false;
        }
      }
      return true;
    });

    // Update zombies
    zombiesRef.current = zombiesRef.current.filter(z => {
      if (z.hp <= 0) {
        scoreRef.current += z.type === 1 ? 50 : 10;
        killsRef.current += XP_PER_KILL;
        setScore(scoreRef.current);
        addParticles(z.x, z.y, z.type === 1 ? "#ef4444" : "#22c55e", z.type === 1 ? 12 : 6);
        checkLevelUp();
        return false;
      }

      // Move toward player
      const dx = p.x - z.x, dy = p.y - z.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        z.x += (dx / dist) * z.speed;
        z.y += (dy / dist) * z.speed;
      }

      // Hit player
      if (dist < PLAYER_R + ZOMBIE_R && invincibleRef.current <= 0) {
        hpRef.current--;
        setDisplayHp(hpRef.current);
        invincibleRef.current = 60; // ~1s invincibility
        addParticles(p.x, p.y, "#ef4444", 8);
        if (hpRef.current <= 0) {
          phaseRef.current = "gameover";
          setPhase("gameover");
          setScore(scoreRef.current);
        }
      }
      return true;
    });

    // Update particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.dx;
      p.y += p.dy;
      p.life--;
      p.dx *= 0.95;
      p.dy *= 0.95;
      return p.life > 0;
    });
  }, [fireAtNearest, spawnZombie, addParticles, checkLevelUp]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = playerRef.current;

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, W, H);

    // Ground texture dots
    ctx.fillStyle = "#1f2937";
    for (let i = 0; i < 50; i++) {
      const gx = ((i * 73 + 17) % W);
      const gy = ((i * 47 + 31) % H);
      ctx.fillRect(gx, gy, 2, 2);
    }

    // Particles
    for (const pt of particlesRef.current) {
      ctx.globalAlpha = pt.life / 30;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2 + pt.life * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Zombies
    for (const z of zombiesRef.current) {
      const isBoss = z.type === 1;
      const r = isBoss ? ZOMBIE_R * 1.8 : ZOMBIE_R;
      // Body
      ctx.fillStyle = isBoss ? "#7f1d1d" : "#166534";
      ctx.beginPath();
      ctx.arc(z.x, z.y, r, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.font = `${r * 1.4}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isBoss ? "👹" : "🧟", z.x, z.y);
      // HP bar for bosses
      if (isBoss && z.hp < z.maxHp) {
        const barW = r * 2;
        ctx.fillStyle = "#374151";
        ctx.fillRect(z.x - barW / 2, z.y - r - 8, barW, 4);
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(z.x - barW / 2, z.y - r - 8, barW * (z.hp / z.maxHp), 4);
      }
    }

    // Bullets
    ctx.fillStyle = "#fbbf24";
    for (const b of bulletsRef.current) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    const blink = invincibleRef.current > 0 && Math.floor(invincibleRef.current / 4) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${PLAYER_R * 1.6}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔫", p.x, p.y);
    }

    // HUD
    ctx.fillStyle = "#e0e7ff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${scoreRef.current}  Lv.${levelRef.current}`, 4, 4);
    ctx.textAlign = "right";
    ctx.fillText("♥".repeat(Math.max(0, hpRef.current)), W - 4, 4);
    ctx.textAlign = "left";

    // Wave indicator
    const wave = Math.floor(elapsedRef.current / 15000) + 1;
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px sans-serif";
    ctx.fillText(`Wave ${wave}`, 4, 20);
  }, []);

  const startGame = useCallback(() => {
    playerRef.current = { x: W / 2, y: H / 2 };
    moveTargetRef.current = { x: W / 2, y: H / 2 };
    zombiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    killsRef.current = 0;
    levelRef.current = 1;
    hpRef.current = 3;
    maxHpRef.current = 3;
    damageRef.current = 1;
    bulletCountRef.current = 1;
    invincibleRef.current = 0;
    elapsedRef.current = 0;
    lastFireRef.current = 0;
    lastSpawnRef.current = 0;
    phaseRef.current = "playing";
    setScore(0);
    setDisplayLevel(1);
    setDisplayHp(3);
    setPhase("playing");

    let lastTime = performance.now();
    const loop = (time: number) => {
      if (phaseRef.current !== "playing") return;
      const dt = time - lastTime;
      lastTime = time;
      update(dt);
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  // Touch controls
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      moveTargetRef.current = getPos(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onMouse = (e: MouseEvent) => {
      moveTargetRef.current = getPos(e.clientX, e.clientY);
    };

    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("mousemove", onMouse);
    canvas.addEventListener("click", onMouse);

    return () => {
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("click", onMouse);
    };
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
      group_id: groupId, user_id: userIdRef.current, game_type: "zombie", score,
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
          <h1 className="text-2xl font-bold text-white">🧟 ゾンビサバイバル</h1>
        </div>

        {phase === "idle" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <div className="text-6xl mb-4">🧟</div>
              <p className="text-indigo-300 text-sm mb-2">360度から来るゾンビを自動攻撃で撃退！</p>
              <p className="text-indigo-400 text-xs mb-1">指で移動、攻撃は自動</p>
              <p className="text-indigo-400 text-xs mb-6">レベルアップでパワーアップ！</p>
              <Button onClick={startGame} className="bg-red-700 hover:bg-red-600 text-white font-bold text-lg px-10 py-6" size="lg">
                サバイブ開始！
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "playing" && (
          <>
            <div className="flex justify-between text-xs text-indigo-300 mb-1 px-1">
              <span>Lv.{displayLevel}</span>
              <span>♥ {displayHp}</span>
            </div>
            <div className="flex justify-center mb-4">
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="border-2 border-red-900 rounded-lg w-full max-w-[320px]"
                style={{ touchAction: "none" }}
              />
            </div>
          </>
        )}

        {phase === "gameover" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <p className="text-red-400 font-bold text-lg mb-2">☠️ DEAD</p>
              {isNewBest && <div className="text-yellow-400 text-sm font-bold mb-2 animate-bounce">🏆 自己ベスト更新！</div>}
              <div className="text-5xl font-black text-white mb-1">{score}</div>
              <div className="text-indigo-400 text-sm mb-1">スコア</div>
              <div className="text-indigo-300 text-xs mb-6">Lv.{displayLevel} / Wave {Math.floor(elapsedRef.current / 15000) + 1}</div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button onClick={saveScore} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  {saving ? "保存中..." : "💾 記録する"}
                </Button>
                <Button onClick={startGame} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold">
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
