"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Reaction } from "@/lib/types";
import { Plus } from "lucide-react";

interface ReactionBarProps {
  postId: string;
  reactions: Reaction[];
  currentUserId: string;
  onReaction?: () => void;
}

const PRESET_EMOJIS = ["❤️", "👍", "😂", "🔥", "🎮", "⚔️", "🏆", "💀"];

function groupReactions(reactions: Reaction[]): Record<string, string[]> {
  return reactions.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.user_id);
    return acc;
  }, {});
}

export default function ReactionBar({
  postId,
  reactions: initialReactions,
  currentUserId,
  onReaction,
}: ReactionBarProps) {
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const grouped = groupReactions(reactions);

  const myReactionEmojis = reactions
    .filter((r) => r.user_id === currentUserId)
    .map((r) => r.emoji);

  const toggleReaction = async (emoji: string) => {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();
    const existing = reactions.find(
      (r) => r.user_id === currentUserId && r.emoji === emoji
    );

    if (existing) {
      // Remove
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      await supabase.from("cf_reactions").delete().eq("id", existing.id);
    } else {
      // Add
      const { data, error } = await supabase
        .from("cf_reactions")
        .insert({ post_id: postId, user_id: currentUserId, emoji })
        .select()
        .single();
      if (!error && data) {
        setReactions((prev) => [...prev, data as Reaction]);
      }
    }

    setLoading(false);
    setShowPicker(false);
    onReaction?.();
  };

  const existingEmojis = Object.keys(grouped);

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {existingEmojis.map((emoji) => {
        const userIds = grouped[emoji];
        const isMine = myReactionEmojis.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggleReaction(emoji)}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors ${
              isMine
                ? "bg-indigo-900/60 border-indigo-500 text-indigo-300"
                : "bg-indigo-950/40 border-indigo-700 text-gray-300 hover:bg-indigo-900/40"
            }`}
          >
            <span>{emoji}</span>
            <span className="text-xs font-medium">{userIds.length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-950/40 border border-indigo-700 hover:bg-indigo-900/40 transition-colors"
          aria-label="リアクションを追加"
        >
          <Plus className="h-3.5 w-3.5 text-indigo-400" />
        </button>

        {showPicker && (
          <div className="absolute bottom-9 left-0 z-10 bg-indigo-950 border border-indigo-700 rounded-2xl shadow-lg p-2 flex gap-1">
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => toggleReaction(emoji)}
                className={`text-xl px-1.5 py-1 rounded-lg hover:bg-indigo-800 transition-colors ${
                  myReactionEmojis.includes(emoji) ? "bg-indigo-800" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
