"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS = [
  { value: "online", label: "オンライン", color: "bg-green-500", emoji: "🟢" },
  { value: "gaming", label: "ゲーム中", color: "bg-purple-500", emoji: "🎮" },
  { value: "away", label: "離席中", color: "bg-yellow-500", emoji: "🟡" },
  { value: "offline", label: "オフライン", color: "bg-gray-400", emoji: "⚫" },
] as const;

type Props = {
  userId: string;
  currentStatus: string;
  currentGame?: string | null;
  isOwn: boolean;
};

export function StatusBadge({ userId, currentStatus, currentGame, isOwn }: Props) {
  const supabase = createClient();
  const [showPicker, setShowPicker] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [game, setGame] = useState(currentGame || "");

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[3];

  async function updateStatus(newStatus: string) {
    setStatus(newStatus);
    await supabase
      .from("profiles")
      .update({
        status: newStatus,
        current_game: newStatus === "gaming" ? game || null : null,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (newStatus !== "gaming") setShowPicker(false);
  }

  async function updateGame() {
    await supabase
      .from("profiles")
      .update({ current_game: game || null })
      .eq("id", userId);
    setShowPicker(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => isOwn && setShowPicker(!showPicker)}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
          isOwn ? "cursor-pointer hover:opacity-80" : "cursor-default"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
        <span>{statusInfo.label}</span>
        {status === "gaming" && game && (
          <span className="text-muted-foreground">- {game}</span>
        )}
      </button>

      {showPicker && isOwn && (
        <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg p-2 z-50 w-48">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateStatus(opt.value)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm hover:bg-accent flex items-center gap-2 ${
                status === opt.value ? "bg-accent" : ""
              }`}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
          {status === "gaming" && (
            <div className="border-t mt-1 pt-1">
              <input
                type="text"
                value={game}
                onChange={(e) => setGame(e.target.value)}
                placeholder="ゲーム名"
                className="w-full px-3 py-1.5 text-sm border rounded"
                onKeyDown={(e) => e.key === "Enter" && updateGame()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
