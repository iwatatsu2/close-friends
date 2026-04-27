"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

const W = 320;
const H = 480;
const PLAYER_R = 16;
const BULLET_R = 6;
const BULLET_SPEED = 5;
const ZOMBIE_R = 12;
const ZOMBIE_BASE_SPEED = 0.5;
const SPAWN_INTERVAL_BASE = 1000;
const GEM_R = 6;
const GEM_MAGNET_R = 60;

type Weapon = {
  type: "gun" | "orbit" | "area";
  level: number;
  cooldown: number;
  lastFire: number;
  bulletCount: number;
  damage: number;
};

type Zombie = { x: number; y: number; hp: number; maxHp: number; speed: number; type: number; flash: number };
type Bullet = { x: number; y: number; dx: number; dy: number; damage: number; piercing: number; life: number };
type OrbitBullet = { angle: number; damage: number; radius: number };
type Particle = { x: number; y: number; dx: number; dy: number; life: number; color: string; size: number };
type Gem = { x: number; y: number; value: number };
type AreaEffect = { x: number; y: number; radius: number; life: number; maxLife: number; damage: number };

type Upgrade = {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  apply: () => void;
};

type ScoreEntry = {
  id: string; user_id: string; score: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

export default function ZombiePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [phase, setPhase] = useState<"idle" | "playing" | "levelup" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [myBest, setMyBest] = useState(0);
  const [displayLevel, setDisplayLevel] = useState(1);
  const [displayHp, setDisplayHp] = useState(3);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number>(0);
  const userIdRef = useRef("");
  const phaseRef = useRef("idle");

  // Images
  const imgRef = useRef<{
    player?: HTMLImageElement;
    zombie?: HTMLImageElement;
    boss?: HTMLImageElement;
    bullet?: HTMLImageElement;
    bgTile?: HTMLImageElement;
    levelup?: HTMLImageElement;
  }>({});

  // Game state
  const playerRef = useRef({ x: W / 2, y: H / 2 });
  const moveTargetRef = useRef({ x: W / 2, y: H / 2 });
  const zombiesRef = useRef<Zombie[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const orbitRef = useRef<OrbitBullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const gemsRef = useRef<Gem[]>([]);
  const areaEffectsRef = useRef<AreaEffect[]>([]);
  const scoreRef = useRef(0);
  const xpRef = useRef(0);
  const xpToNextRef = useRef(5);
  const levelRef = useRef(1);
  const hpRef = useRef(5);
  const maxHpRef = useRef(5);
  const lastSpawnRef = useRef(0);
  const elapsedRef = useRef(0);
  const killCountRef = useRef(0);
  const weaponsRef = useRef<Weapon[]>([]);
  const invincibleRef = useRef(0);
  const facingRef = useRef(1); // 1=right, -1=left

  // Load images
  useEffect(() => {
    const names: [string, keyof typeof imgRef.current][] = [
      ["/game/zombie/player.png", "player"],
      ["/game/zombie/zombie.png", "zombie"],
      ["/game/zombie/boss.png", "boss"],
      ["/game/zombie/bullet.png", "bullet"],
      ["/game/zombie/bg-tile.png", "bgTile"],
      ["/game/zombie/levelup.png", "levelup"],
    ];
    for (const [src, key] of names) {
      const img = new Image();
      img.src = src;
      (imgRef.current as any)[key] = img;
    }
  }, []);

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
    const p = playerRef.current;
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 80;
    const x = p.x + Math.cos(angle) * dist;
    const y = p.y + Math.sin(angle) * dist;

    const wave = Math.floor(elapsedRef.current / 15000);
    const isBoss = wave > 0 && Math.random() < 0.05 + wave * 0.015;
    const hp = isBoss ? 8 + wave * 4 : 1 + Math.floor(wave * 0.4);
    const speed = ZOMBIE_BASE_SPEED + wave * 0.06 + (isBoss ? -0.15 : Math.random() * 0.25);
    const type = isBoss ? 1 : 0;

    zombiesRef.current.push({ x, y, hp, maxHp: hp, speed, type, flash: 0 });
  }, []);

  const addParticles = useCallback((x: number, y: number, color: string, count: number, size = 2) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particlesRef.current.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 15 + Math.random() * 10,
        color,
        size,
      });
    }
  }, []);

  const fireWeapons = useCallback(() => {
    const p = playerRef.current;
    const now = performance.now();
    const zombies = zombiesRef.current;

    for (const w of weaponsRef.current) {
      if (now - w.lastFire < w.cooldown) continue;

      if (w.type === "gun" && zombies.length > 0) {
        const sorted = [...zombies].sort((a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)
        );
        const targets = sorted.slice(0, w.bulletCount);
        for (const z of targets) {
          const dx = z.x - p.x, dy = z.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist === 0) continue;
          bulletsRef.current.push({
            x: p.x, y: p.y,
            dx: (dx / dist) * BULLET_SPEED,
            dy: (dy / dist) * BULLET_SPEED,
            damage: w.damage,
            piercing: w.level >= 3 ? 1 : 0,
            life: 80,
          });
        }
        w.lastFire = now;
      }

      if (w.type === "orbit") {
        // Orbit bullets are maintained, not fired per cooldown
        const count = 2 + w.level;
        while (orbitRef.current.length < count) {
          orbitRef.current.push({
            angle: (orbitRef.current.length / count) * Math.PI * 2,
            damage: w.damage,
            radius: 40 + w.level * 8,
          });
        }
        // Update damage
        for (const o of orbitRef.current) {
          o.damage = w.damage;
          o.radius = 40 + w.level * 8;
        }
      }

      if (w.type === "area" && zombies.length > 0) {
        // Find cluster of enemies
        const target = zombies[Math.floor(Math.random() * Math.min(5, zombies.length))];
        areaEffectsRef.current.push({
          x: target.x, y: target.y,
          radius: 30 + w.level * 10,
          life: 20,
          maxLife: 20,
          damage: w.damage,
        });
        w.lastFire = now;
      }
    }
  }, []);

  const generateUpgrades = useCallback((): Upgrade[] => {
    const weapons = weaponsRef.current;
    const hasGun = weapons.some(w => w.type === "gun");
    const hasOrbit = weapons.some(w => w.type === "orbit");
    const hasArea = weapons.some(w => w.type === "area");
    const gun = weapons.find(w => w.type === "gun");
    const orbit = weapons.find(w => w.type === "orbit");
    const area = weapons.find(w => w.type === "area");

    const pool: Upgrade[] = [];

    // Gun upgrades
    if (hasGun && gun && gun.level < 8) {
      pool.push({
        id: "gun_damage", name: "銃ダメージUP", desc: `Lv.${gun.level + 1}`, emoji: "🔫",
        apply: () => { gun.damage += 0.5; gun.level++; }
      });
      pool.push({
        id: "gun_speed", name: "連射速度UP", desc: `発射間隔短縮`, emoji: "⚡",
        apply: () => { gun.cooldown = Math.max(150, gun.cooldown - 40); gun.level++; }
      });
      pool.push({
        id: "gun_count", name: "弾数UP", desc: `${gun.bulletCount + 1}発同時`, emoji: "🎯",
        apply: () => { gun.bulletCount = Math.min(8, gun.bulletCount + 1); gun.level++; }
      });
    }

    // Orbit - new or upgrade
    if (!hasOrbit) {
      pool.push({
        id: "orbit_new", name: "ガードオーブ", desc: "周回する守護弾", emoji: "🔵",
        apply: () => { weaponsRef.current.push({ type: "orbit", level: 1, cooldown: 0, lastFire: 0, bulletCount: 3, damage: 1 }); }
      });
    } else if (orbit && orbit.level < 6) {
      pool.push({
        id: "orbit_up", name: "オーブ強化", desc: `Lv.${orbit.level + 1}`, emoji: "🔵",
        apply: () => { orbit.damage += 0.5; orbit.level++; }
      });
    }

    // Area - new or upgrade
    if (!hasArea) {
      pool.push({
        id: "area_new", name: "爆裂弾", desc: "範囲攻撃を追加", emoji: "💥",
        apply: () => { weaponsRef.current.push({ type: "area", level: 1, cooldown: 2500, lastFire: 0, bulletCount: 1, damage: 2 }); }
      });
    } else if (area && area.level < 6) {
      pool.push({
        id: "area_up", name: "爆裂弾強化", desc: `Lv.${area.level + 1}`, emoji: "💥",
        apply: () => { area.damage += 1; area.level++; }
      });
    }

    // Stat upgrades
    pool.push({
      id: "hp_up", name: "HP回復+1", desc: "最大HPも+1", emoji: "❤️",
      apply: () => { maxHpRef.current++; hpRef.current = Math.min(hpRef.current + 2, maxHpRef.current); setDisplayHp(hpRef.current); }
    });
    pool.push({
      id: "magnet", name: "磁石強化", desc: "ジェム吸引範囲UP", emoji: "🧲",
      apply: () => { /* magnet range is handled in update */ }
    });

    // Shuffle and pick 3
    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);

  const checkLevelUp = useCallback(() => {
    if (xpRef.current >= xpToNextRef.current) {
      xpRef.current -= xpToNextRef.current;
      levelRef.current++;
      xpToNextRef.current = Math.floor(5 + levelRef.current * 3 + levelRef.current * levelRef.current * 0.5);
      setDisplayLevel(levelRef.current);
      addParticles(playerRef.current.x, playerRef.current.y, "#fbbf24", 20, 3);

      // Pause game for level-up choice
      const ups = generateUpgrades();
      setUpgrades(ups);
      phaseRef.current = "levelup";
      setPhase("levelup");
    }
  }, [addParticles, generateUpgrades]);

  const selectUpgrade = useCallback((upgrade: Upgrade) => {
    upgrade.apply();
    setUpgrades([]);
    phaseRef.current = "playing";
    setPhase("playing");

    // Resume game loop
    let lastTime = performance.now();
    const loop = (time: number) => {
      if (phaseRef.current !== "playing") return;
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      update(dt);
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, []);

  const update = useCallback((dt: number) => {
    const p = playerRef.current;
    const target = moveTargetRef.current;
    elapsedRef.current += dt;

    // Move player toward target
    const pdx = target.x - p.x, pdy = target.y - p.y;
    const pdist = Math.hypot(pdx, pdy);
    if (pdist > 3) {
      const speed = 2.2;
      p.x += (pdx / pdist) * speed;
      p.y += (pdy / pdist) * speed;
      facingRef.current = pdx > 0 ? 1 : -1;
    }
    // No boundary clamping - free roaming in infinite space (camera follows)

    if (invincibleRef.current > 0) invincibleRef.current--;

    // Auto fire all weapons
    fireWeapons();

    // Spawn zombies
    const now = performance.now();
    const wave = Math.floor(elapsedRef.current / 15000);
    const spawnInterval = Math.max(200, SPAWN_INTERVAL_BASE - wave * 60);
    const spawnCount = 1 + Math.floor(wave * 0.3);
    if (now - lastSpawnRef.current > spawnInterval) {
      for (let i = 0; i < spawnCount; i++) spawnZombie();
      lastSpawnRef.current = now;
    }

    // Update orbit bullets
    for (const o of orbitRef.current) {
      o.angle += 0.04;
      // Check hit zombies
      const ox = p.x + Math.cos(o.angle) * o.radius;
      const oy = p.y + Math.sin(o.angle) * o.radius;
      for (const z of zombiesRef.current) {
        if (Math.hypot(ox - z.x, oy - z.y) < ZOMBIE_R + 8) {
          z.hp -= o.damage * 0.1; // Continuous damage
          z.flash = 3;
        }
      }
    }

    // Update area effects
    areaEffectsRef.current = areaEffectsRef.current.filter(a => {
      a.life--;
      if (a.life === a.maxLife - 1) {
        // Apply damage on first frame
        for (const z of zombiesRef.current) {
          if (Math.hypot(a.x - z.x, a.y - z.y) < a.radius) {
            z.hp -= a.damage;
            z.flash = 5;
            addParticles(z.x, z.y, "#f97316", 3);
          }
        }
      }
      return a.life > 0;
    });

    // Update bullets
    bulletsRef.current = bulletsRef.current.filter(b => {
      b.x += b.dx;
      b.y += b.dy;
      b.life--;
      if (b.life <= 0) return false;

      for (const z of zombiesRef.current) {
        if (Math.hypot(b.x - z.x, b.y - z.y) < ZOMBIE_R + BULLET_R) {
          z.hp -= b.damage;
          z.flash = 5;
          addParticles(b.x, b.y, "#a3e635", 3);
          if (b.piercing > 0) { b.piercing--; return true; }
          return false;
        }
      }
      return true;
    });

    // Update zombies
    zombiesRef.current = zombiesRef.current.filter(z => {
      if (z.flash > 0) z.flash--;

      if (z.hp <= 0) {
        const pts = z.type === 1 ? 50 : 10;
        scoreRef.current += pts;
        killCountRef.current++;
        setScore(scoreRef.current);
        addParticles(z.x, z.y, z.type === 1 ? "#ef4444" : "#22c55e", z.type === 1 ? 12 : 5);
        // Drop XP gem
        const gemValue = z.type === 1 ? 3 : 1;
        gemsRef.current.push({ x: z.x, y: z.y, value: gemValue });
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
        invincibleRef.current = 60;
        addParticles(p.x, p.y, "#ef4444", 8);
        if (hpRef.current <= 0) {
          phaseRef.current = "gameover";
          setPhase("gameover");
          setScore(scoreRef.current);
        }
      }
      return true;
    });

    // Update gems (magnet toward player)
    gemsRef.current = gemsRef.current.filter(g => {
      const dx = p.x - g.x, dy = p.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < GEM_MAGNET_R) {
        const speed = 3 + (GEM_MAGNET_R - dist) * 0.1;
        g.x += (dx / dist) * speed;
        g.y += (dy / dist) * speed;
      }
      if (dist < PLAYER_R) {
        xpRef.current += g.value;
        addParticles(g.x, g.y, "#818cf8", 4, 1.5);
        checkLevelUp();
        return false;
      }
      return true;
    });

    // Update particles
    particlesRef.current = particlesRef.current.filter(pt => {
      pt.x += pt.dx;
      pt.y += pt.dy;
      pt.life--;
      pt.dx *= 0.95;
      pt.dy *= 0.95;
      return pt.life > 0;
    });
  }, [fireWeapons, spawnZombie, addParticles, checkLevelUp]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = playerRef.current;
    const img = imgRef.current;

    // Camera offset (center on player)
    const camX = p.x - W / 2;
    const camY = p.y - H / 2;

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, W, H);

    // Tile background
    if (img.bgTile?.complete) {
      const tileW = 80, tileH = 100;
      const startX = Math.floor(camX / tileW) * tileW;
      const startY = Math.floor(camY / tileH) * tileH;
      for (let tx = startX - tileW; tx < camX + W + tileW; tx += tileW) {
        for (let ty = startY - tileH; ty < camY + H + tileH; ty += tileH) {
          ctx.globalAlpha = 0.3;
          ctx.drawImage(img.bgTile, tx - camX, ty - camY, tileW, tileH);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Area effects
    for (const a of areaEffectsRef.current) {
      const alpha = a.life / a.maxLife;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(a.x - camX, a.y - camY, a.radius * (1 - alpha * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(a.x - camX, a.y - camY, a.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Gems
    for (const g of gemsRef.current) {
      const sx = g.x - camX, sy = g.y - camY;
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      const pulse = 1 + Math.sin(performance.now() * 0.005 + g.x) * 0.2;
      ctx.fillStyle = g.value >= 3 ? "#c084fc" : "#818cf8";
      ctx.beginPath();
      // Diamond shape
      ctx.moveTo(sx, sy - GEM_R * pulse);
      ctx.lineTo(sx + GEM_R * 0.7 * pulse, sy);
      ctx.lineTo(sx, sy + GEM_R * pulse);
      ctx.lineTo(sx - GEM_R * 0.7 * pulse, sy);
      ctx.closePath();
      ctx.fill();
      // Shine
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(sx - 1, sy - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles
    for (const pt of particlesRef.current) {
      const sx = pt.x - camX, sy = pt.y - camY;
      ctx.globalAlpha = pt.life / 25;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(sx, sy, pt.size + pt.life * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Zombies
    for (const z of zombiesRef.current) {
      const sx = z.x - camX, sy = z.y - camY;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
      const isBoss = z.type === 1;
      const r = isBoss ? ZOMBIE_R * 2 : ZOMBIE_R;
      const spriteSize = isBoss ? r * 3 : r * 2.5;
      const sprite = isBoss ? img.boss : img.zombie;

      if (z.flash > 0) {
        ctx.globalAlpha = 0.6;
        ctx.filter = "brightness(3)";
      }

      if (sprite?.complete) {
        ctx.drawImage(sprite, sx - spriteSize / 2, sy - spriteSize / 2, spriteSize, spriteSize);
      } else {
        ctx.fillStyle = isBoss ? "#7f1d1d" : "#166534";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.filter = "none";
      ctx.globalAlpha = 1;

      // HP bar for bosses
      if (isBoss && z.hp < z.maxHp) {
        const barW = r * 2.5;
        ctx.fillStyle = "#374151";
        ctx.fillRect(sx - barW / 2, sy - r - 10, barW, 4);
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(sx - barW / 2, sy - r - 10, barW * (z.hp / z.maxHp), 4);
      }
    }

    // Bullets
    for (const b of bulletsRef.current) {
      const sx = b.x - camX, sy = b.y - camY;
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      if (img.bullet?.complete) {
        const angle = Math.atan2(b.dy, b.dx);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.drawImage(img.bullet, -8, -5, 16, 10);
        ctx.restore();
      } else {
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(sx, sy, BULLET_R, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Orbit bullets
    for (const o of orbitRef.current) {
      const ox = p.x + Math.cos(o.angle) * o.radius - camX;
      const oy = p.y + Math.sin(o.angle) * o.radius - camY;
      ctx.fillStyle = "#60a5fa";
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ox, oy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Player
    const blink = invincibleRef.current > 0 && Math.floor(invincibleRef.current / 4) % 2 === 0;
    if (!blink) {
      const px = W / 2, py = H / 2; // Player is always center of screen
      const spriteW = 36, spriteH = 40;
      if (img.player?.complete) {
        ctx.save();
        ctx.translate(px, py);
        if (facingRef.current < 0) ctx.scale(-1, 1);
        ctx.drawImage(img.player, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
        ctx.restore();
      } else {
        ctx.fillStyle = "#6366f1";
        ctx.beginPath();
        ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HUD
    ctx.fillStyle = "#e0e7ff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${scoreRef.current}`, 4, 4);

    // XP bar
    const xpRatio = xpRef.current / xpToNextRef.current;
    ctx.fillStyle = "#374151";
    ctx.fillRect(4, 20, W - 8, 6);
    ctx.fillStyle = "#818cf8";
    ctx.fillRect(4, 20, (W - 8) * xpRatio, 6);
    ctx.fillStyle = "#c7d2fe";
    ctx.font = "9px sans-serif";
    ctx.fillText(`Lv.${levelRef.current}`, 4, 28);

    // HP hearts
    ctx.textAlign = "right";
    ctx.font = "12px sans-serif";
    const hearts = "♥".repeat(Math.max(0, hpRef.current));
    ctx.fillStyle = "#ef4444";
    ctx.fillText(hearts, W - 4, 4);

    // Wave + kill count
    const wave = Math.floor(elapsedRef.current / 15000) + 1;
    ctx.textAlign = "left";
    ctx.fillStyle = "#6b7280";
    ctx.font = "9px sans-serif";
    ctx.fillText(`Wave ${wave}  💀${killCountRef.current}`, 4, 38);

    // Timer
    const sec = Math.floor(elapsedRef.current / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    ctx.textAlign = "center";
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px sans-serif";
    ctx.fillText(`${min}:${s.toString().padStart(2, "0")}`, W / 2, 4);
  }, []);

  const startGame = useCallback(() => {
    playerRef.current = { x: W / 2, y: H / 2 };
    moveTargetRef.current = { x: W / 2, y: H / 2 };
    zombiesRef.current = [];
    bulletsRef.current = [];
    orbitRef.current = [];
    particlesRef.current = [];
    gemsRef.current = [];
    areaEffectsRef.current = [];
    scoreRef.current = 0;
    xpRef.current = 0;
    xpToNextRef.current = 5;
    killCountRef.current = 0;
    levelRef.current = 1;
    hpRef.current = 5;
    maxHpRef.current = 5;
    invincibleRef.current = 0;
    elapsedRef.current = 0;
    lastSpawnRef.current = 0;
    facingRef.current = 1;
    weaponsRef.current = [
      { type: "gun", level: 1, cooldown: 400, lastFire: 0, bulletCount: 1, damage: 1 },
    ];
    phaseRef.current = "playing";
    setScore(0);
    setDisplayLevel(1);
    setDisplayHp(5);
    setUpgrades([]);
    setPhase("playing");

    let lastTime = performance.now();
    const loop = (time: number) => {
      if (phaseRef.current !== "playing") return;
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      update(dt);
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  // Touch/mouse controls - relative movement (joystick style)
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
      const pos = getPos(e.touches[0].clientX, e.touches[0].clientY);
      // Convert screen position to world position
      const camX = playerRef.current.x - W / 2;
      const camY = playerRef.current.y - H / 2;
      moveTargetRef.current = { x: pos.x + camX, y: pos.y + camY };
    };
    const onMouse = (e: MouseEvent) => {
      const pos = getPos(e.clientX, e.clientY);
      const camX = playerRef.current.x - W / 2;
      const camY = playerRef.current.y - H / 2;
      moveTargetRef.current = { x: pos.x + camX, y: pos.y + camY };
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
          <h1 className="text-2xl font-bold text-white">🧟 ゾンビサバイバー</h1>
        </div>

        {phase === "idle" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-12 flex flex-col items-center">
              <div className="text-6xl mb-4">🧟</div>
              <p className="text-indigo-300 text-sm mb-2">360度から押し寄せるゾンビの群れを生き延びろ！</p>
              <p className="text-indigo-400 text-xs mb-1">指で移動 — 攻撃は全自動</p>
              <p className="text-indigo-400 text-xs mb-1">ジェムでレベルUP → 武器を選択強化</p>
              <p className="text-indigo-400 text-xs mb-6">長く生き残るほど高スコア！</p>
              <Button onClick={startGame} className="bg-red-700 hover:bg-red-600 text-white font-bold text-lg px-10 py-6" size="lg">
                サバイブ開始！
              </Button>
            </CardContent>
          </Card>
        )}

        {(phase === "playing" || phase === "levelup") && (
          <>
            <div className="flex justify-center mb-4 relative">
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="border-2 border-red-900 rounded-lg w-full max-w-[320px]"
                style={{ touchAction: "none" }}
              />
              {/* Level-up overlay */}
              {phase === "levelup" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg" style={{ maxWidth: 320, margin: "0 auto" }}>
                  <div className="bg-gray-900 border border-yellow-500 rounded-xl p-4 w-[280px]">
                    <div className="text-center mb-3">
                      <p className="text-yellow-400 font-bold text-lg">⬆️ LEVEL UP!</p>
                      <p className="text-gray-400 text-xs">強化を1つ選んでください</p>
                    </div>
                    <div className="space-y-2">
                      {upgrades.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => selectUpgrade(u)}
                          className="w-full bg-gray-800 hover:bg-indigo-900 border border-gray-600 hover:border-indigo-500 rounded-lg p-3 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{u.emoji}</span>
                            <div>
                              <p className="text-white font-bold text-sm">{u.name}</p>
                              <p className="text-gray-400 text-xs">{u.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
              <div className="text-indigo-300 text-xs mb-1">Lv.{displayLevel} / Wave {Math.floor(elapsedRef.current / 15000) + 1}</div>
              <div className="text-indigo-300 text-xs mb-6">💀 {killCountRef.current}体撃破</div>
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
