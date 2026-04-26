"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureProfile } from "@/lib/ensureProfile";

const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 28;

const TETROMINOES: { shape: number[][]; color: string }[] = [
  { shape: [[1,1,1,1]], color: "#06b6d4" },           // I - cyan
  { shape: [[1,1],[1,1]], color: "#eab308" },          // O - yellow
  { shape: [[0,1,0],[1,1,1]], color: "#a855f7" },      // T - purple
  { shape: [[1,0,0],[1,1,1]], color: "#3b82f6" },      // J - blue
  { shape: [[0,0,1],[1,1,1]], color: "#f97316" },      // L - orange
  { shape: [[0,1,1],[1,1,0]], color: "#22c55e" },      // S - green
  { shape: [[1,1,0],[0,1,1]], color: "#ef4444" },      // Z - red
];

type Piece = { shape: number[][]; color: string; x: number; y: number };
type ScoreEntry = {
  id: string; user_id: string; score: number; created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

function createBoard(): string[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(""));
}

function randomPiece(): Piece {
  const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return { shape: t.shape.map(r => [...r]), color: t.color, x: Math.floor((COLS - t.shape[0].length) / 2), y: 0 };
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length, cols = shape[0].length;
  const result: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function collides(board: string[][], piece: Piece): boolean {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) {
        const nx = piece.x + c, ny = piece.y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
  return false;
}

function merge(board: string[][], piece: Piece): string[][] {
  const nb = board.map(r => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) {
        const ny = piece.y + r, nx = piece.x + c;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS)
          nb[ny][nx] = piece.color;
      }
  return nb;
}

function clearLines(board: string[][]): { board: string[][]; cleared: number } {
  const kept = board.filter(row => row.some(cell => !cell));
  const cleared = ROWS - kept.length;
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(""));
  return { board: [...empty, ...kept], cleared };
}

export default function TetrisPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [phase, setPhase] = useState<"idle" | "playing" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [myBest, setMyBest] = useState(0);

  const boardRef = useRef(createBoard());
  const pieceRef = useRef<Piece | null>(null);
  const nextPieceRef = useRef<Piece>(randomPiece());
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const linesRef = useRef(0);
  const gameOverRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number>(0);
  const lastDropRef = useRef(0);
  const userIdRef = useRef("");

  const [nextPieceState, setNextPieceState] = useState<Piece | null>(null);

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
      .eq("group_id", groupId).eq("game_type", "tetris")
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
      .eq("group_id", groupId).eq("game_type", "tetris").eq("user_id", uid)
      .order("score", { ascending: false }).limit(1);
    if (myData && myData.length > 0) setMyBest(myData[0].score);
  }

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = COLS * CELL_SIZE, h = ROWS * CELL_SIZE;
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "#312e81";
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

    // Board
    const board = boardRef.current;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c]) {
          ctx.fillStyle = board[r][c];
          ctx.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + 1, CELL_SIZE - 2, 4);
        }

    // Current piece
    const piece = pieceRef.current;
    if (piece) {
      // Ghost piece
      let ghostY = piece.y;
      while (!collides(board, { ...piece, y: ghostY + 1 })) ghostY++;
      if (ghostY !== piece.y) {
        ctx.globalAlpha = 0.2;
        for (let r = 0; r < piece.shape.length; r++)
          for (let c = 0; c < piece.shape[r].length; c++)
            if (piece.shape[r][c]) {
              const px = (piece.x + c) * CELL_SIZE, py = (ghostY + r) * CELL_SIZE;
              ctx.fillStyle = piece.color;
              ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
            }
        ctx.globalAlpha = 1;
      }

      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c]) {
            const px = (piece.x + c) * CELL_SIZE, py = (piece.y + r) * CELL_SIZE;
            if (py >= 0) {
              ctx.fillStyle = piece.color;
              ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
              ctx.fillStyle = "rgba(255,255,255,0.2)";
              ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, 4);
            }
          }
    }
  }, []);

  const dropPiece = useCallback(() => {
    const piece = pieceRef.current;
    if (!piece || gameOverRef.current) return;

    const moved = { ...piece, y: piece.y + 1 };
    if (!collides(boardRef.current, moved)) {
      pieceRef.current = moved;
    } else {
      // Lock
      boardRef.current = merge(boardRef.current, piece);
      const { board: newBoard, cleared } = clearLines(boardRef.current);
      boardRef.current = newBoard;

      if (cleared > 0) {
        const points = [0, 100, 300, 500, 800][cleared] || 800;
        scoreRef.current += points * levelRef.current;
        linesRef.current += cleared;
        levelRef.current = Math.floor(linesRef.current / 10) + 1;
        setScore(scoreRef.current);
        setLines(linesRef.current);
        setLevel(levelRef.current);
      }

      // Next piece
      pieceRef.current = nextPieceRef.current;
      nextPieceRef.current = randomPiece();
      setNextPieceState(nextPieceRef.current);

      if (collides(boardRef.current, pieceRef.current!)) {
        gameOverRef.current = true;
        setPhase("gameover");
        setScore(scoreRef.current);
      }
    }
  }, []);

  const moveLeft = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    const moved = { ...p, x: p.x - 1 };
    if (!collides(boardRef.current, moved)) pieceRef.current = moved;
    draw();
  }, [draw]);

  const moveRight = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    const moved = { ...p, x: p.x + 1 };
    if (!collides(boardRef.current, moved)) pieceRef.current = moved;
    draw();
  }, [draw]);

  const rotatePiece = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    const rotated = { ...p, shape: rotate(p.shape) };
    if (!collides(boardRef.current, rotated)) pieceRef.current = rotated;
    else {
      // Wall kick attempts
      for (const dx of [1, -1, 2, -2]) {
        const kicked = { ...rotated, x: rotated.x + dx };
        if (!collides(boardRef.current, kicked)) { pieceRef.current = kicked; break; }
      }
    }
    draw();
  }, [draw]);

  const hardDrop = useCallback(() => {
    const p = pieceRef.current;
    if (!p || gameOverRef.current) return;
    while (!collides(boardRef.current, { ...p, y: p.y + 1 })) p.y++;
    pieceRef.current = p;
    dropPiece();
    draw();
  }, [dropPiece, draw]);

  const startGame = useCallback(() => {
    boardRef.current = createBoard();
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
    gameOverRef.current = false;
    pieceRef.current = randomPiece();
    nextPieceRef.current = randomPiece();
    setNextPieceState(nextPieceRef.current);
    setScore(0);
    setLines(0);
    setLevel(1);
    setPhase("playing");
    lastDropRef.current = performance.now();

    const loop = (time: number) => {
      if (gameOverRef.current) return;
      const speed = Math.max(100, 800 - (levelRef.current - 1) * 70);
      if (time - lastDropRef.current > speed) {
        dropPiece();
        lastDropRef.current = time;
      }
      draw();
      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [dropPiece, draw]);

  useEffect(() => {
    return () => { if (loopRef.current) cancelAnimationFrame(loopRef.current); };
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") moveLeft();
      else if (e.key === "ArrowRight") moveRight();
      else if (e.key === "ArrowUp") rotatePiece();
      else if (e.key === "ArrowDown") { dropPiece(); draw(); }
      else if (e.key === " ") { e.preventDefault(); hardDrop(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, moveLeft, moveRight, rotatePiece, dropPiece, hardDrop, draw]);

  async function saveScore() {
    if (saving || !userIdRef.current) return;
    setSaving(true);
    const { error } = await supabase.from("cf_game_scores").insert({
      group_id: groupId,
      user_id: userIdRef.current,
      game_type: "tetris",
      score: score,
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
          <h1 className="text-2xl font-bold text-white">🧱 テトリス</h1>
        </div>

        {phase === "idle" && (
          <Card className="border-indigo-700 bg-indigo-950/60 mb-6">
            <CardContent className="py-16 flex flex-col items-center">
              <div className="text-6xl mb-4">🧱</div>
              <p className="text-indigo-300 text-sm mb-6">ブロックを積んでラインを消せ！</p>
              <Button onClick={startGame} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg px-10 py-6" size="lg">
                スタート！
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "playing" && (
          <>
            {/* Score bar */}
            <div className="flex justify-between text-sm text-indigo-300 mb-2 px-1">
              <span>スコア: <span className="text-white font-bold">{score}</span></span>
              <span>Lv.<span className="text-white font-bold">{level}</span></span>
              <span>ライン: <span className="text-white font-bold">{lines}</span></span>
            </div>

            {/* Game canvas */}
            <div className="flex justify-center mb-3">
              <canvas
                ref={canvasRef}
                width={COLS * CELL_SIZE}
                height={ROWS * CELL_SIZE}
                className="border-2 border-indigo-600 rounded-lg"
              />
              {/* Next piece preview */}
              <div className="ml-3 flex flex-col items-center">
                <p className="text-xs text-indigo-400 mb-1">NEXT</p>
                <div className="border border-indigo-700 rounded bg-indigo-950/80 p-2 w-20 h-20 flex items-center justify-center">
                  {nextPieceState && (
                    <div>
                      {nextPieceState.shape.map((row, ri) => (
                        <div key={ri} className="flex">
                          {row.map((cell, ci) => (
                            <div
                              key={ci}
                              className="w-4 h-4"
                              style={{ backgroundColor: cell ? nextPieceState.color : "transparent" }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-3 mb-2">
              <button onPointerDown={moveLeft} className="w-16 h-14 bg-indigo-800 hover:bg-indigo-700 active:bg-indigo-600 rounded-xl text-white text-2xl font-bold select-none touch-manipulation">←</button>
              <button onPointerDown={rotatePiece} className="w-16 h-14 bg-purple-800 hover:bg-purple-700 active:bg-purple-600 rounded-xl text-white text-xl font-bold select-none touch-manipulation">↻</button>
              <button onPointerDown={moveRight} className="w-16 h-14 bg-indigo-800 hover:bg-indigo-700 active:bg-indigo-600 rounded-xl text-white text-2xl font-bold select-none touch-manipulation">→</button>
            </div>
            <div className="flex justify-center gap-3">
              <button onPointerDown={() => { dropPiece(); draw(); }} className="w-16 h-12 bg-indigo-900 hover:bg-indigo-800 active:bg-indigo-700 rounded-xl text-white text-xl select-none touch-manipulation">▼</button>
              <button onPointerDown={hardDrop} className="flex-0 px-6 h-12 bg-yellow-700 hover:bg-yellow-600 active:bg-yellow-500 rounded-xl text-white text-sm font-bold select-none touch-manipulation">⬇ DROP</button>
            </div>
          </>
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
              <div className="text-indigo-300 text-sm mb-6">Lv.{level} / {lines}ライン</div>

              <div className="flex gap-3 w-full max-w-xs">
                <Button onClick={saveScore} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold">
                  {saving ? "保存中..." : "💾 記録する"}
                </Button>
                <Button onClick={startGame} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
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
