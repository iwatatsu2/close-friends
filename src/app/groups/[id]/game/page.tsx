"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

const GAMES = [
  {
    id: "tap",
    emoji: "⚔️",
    name: "タップバトル",
    description: "10秒間で何回タップできるか勝負！",
    color: "from-indigo-600 to-purple-600",
  },
  {
    id: "tetris",
    emoji: "🧱",
    name: "テトリス",
    description: "ブロックを積んでライン消し！ハイスコアを狙え",
    color: "from-emerald-600 to-cyan-600",
  },
  {
    id: "breakout",
    emoji: "🏓",
    name: "ブロック崩し",
    description: "パドルでボールを弾いてブロックを全部壊せ！",
    color: "from-orange-600 to-red-600",
  },
];

export default function GameHubPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  return (
    <div className="min-h-screen pb-6">
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={() => router.push(`/groups/${groupId}`)} className="text-indigo-400 text-sm mb-2">
          ← タイムラインに戻る
        </button>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">🎮 ゲームセンター</h1>
          <p className="text-sm text-indigo-400 mt-1">みんなでスコアを競おう！</p>
        </div>

        <div className="space-y-4">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => router.push(`/groups/${groupId}/game/${game.id}`)}
              className="w-full text-left"
            >
              <Card className="border-indigo-700 bg-indigo-950/60 hover:bg-indigo-900/60 transition-colors overflow-hidden">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-r ${game.color} px-5 py-6 flex items-center gap-4`}>
                    <span className="text-5xl">{game.emoji}</span>
                    <div>
                      <h2 className="text-xl font-bold text-white">{game.name}</h2>
                      <p className="text-sm text-white/80 mt-1">{game.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
