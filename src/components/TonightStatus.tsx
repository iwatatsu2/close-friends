"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TonightStatusProps {
  groupId: string;
  currentUserId: string;
}

type StatusOption = {
  key: string;
  emoji: string;
  label: string;
  color: string;
};

const STATUSES: StatusOption[] = [
  { key: "ready", emoji: "🟢", label: "参戦OK！", color: "bg-green-900/50 border-green-600 text-green-300" },
  { key: "maybe", emoji: "🟡", label: "寝かしつけ中", color: "bg-yellow-900/50 border-yellow-600 text-yellow-300" },
  { key: "late", emoji: "🔵", label: "遅れて参戦", color: "bg-blue-900/50 border-blue-600 text-blue-300" },
  { key: "off", emoji: "⚫", label: "今日は無理", color: "bg-gray-900/50 border-gray-600 text-gray-400" },
];

type MemberStatus = {
  user_id: string;
  status: string;
  display_name: string;
  avatar_url: string | null;
  updated_at: string;
};

export default function TonightStatus({ groupId, currentUserId }: TonightStatusProps) {
  const supabase = createClient();
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadStatuses();
  }, [groupId]);

  async function loadStatuses() {
    const { data } = await supabase
      .from("cf_tonight_status")
      .select("*, profiles(*)")
      .eq("group_id", groupId)
      .eq("date", today);

    if (data) {
      const mapped = data.map((d: Record<string, unknown>) => ({
        user_id: d.user_id as string,
        status: d.status as string,
        display_name: (d.profiles as Record<string, unknown>)?.display_name as string ?? "?",
        avatar_url: (d.profiles as Record<string, unknown>)?.avatar_url as string | null,
        updated_at: d.updated_at as string,
      }));
      setMembers(mapped);
      const mine = mapped.find((m) => m.user_id === currentUserId);
      if (mine) setMyStatus(mine.status);
    }
  }

  async function setStatus(statusKey: string) {
    if (loading) return;
    setLoading(true);

    if (myStatus === statusKey) {
      // Toggle off
      await supabase
        .from("cf_tonight_status")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", currentUserId)
        .eq("date", today);
      setMyStatus(null);
      setMembers((prev) => prev.filter((m) => m.user_id !== currentUserId));
    } else {
      await supabase
        .from("cf_tonight_status")
        .upsert(
          {
            group_id: groupId,
            user_id: currentUserId,
            date: today,
            status: statusKey,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "group_id,user_id,date" }
        );
      setMyStatus(statusKey);
      await loadStatuses();
    }

    setLoading(false);
  }

  const readyCount = members.filter((m) => m.status === "ready").length;

  return (
    <div className="border border-indigo-700 bg-indigo-950/60 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">🌙 今夜やれる？</h3>
        {readyCount > 0 && (
          <span className="text-xs bg-green-900/60 text-green-300 px-2 py-0.5 rounded-full">
            {readyCount}人参戦OK
          </span>
        )}
      </div>

      {/* Status buttons */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            disabled={loading}
            className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-center transition-all ${
              myStatus === s.key
                ? `${s.color} ring-1 ring-white/20 scale-105`
                : "border-indigo-800 bg-indigo-950/40 text-indigo-400 hover:bg-indigo-900/40"
            }`}
          >
            <span className="text-lg">{s.emoji}</span>
            <span className="text-[10px] font-medium leading-tight">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Member statuses */}
      {members.length > 0 && (
        <div className="space-y-1.5">
          {members.map((m) => {
            const statusInfo = STATUSES.find((s) => s.key === m.status);
            return (
              <div key={m.user_id} className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                  <AvatarFallback className="bg-indigo-800 text-indigo-300 text-[10px]">
                    {m.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-indigo-200 flex-1 truncate">{m.display_name}</span>
                <span className="text-xs">
                  {statusInfo?.emoji} {statusInfo?.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {members.length === 0 && (
        <p className="text-xs text-indigo-500 text-center">まだ誰もステータスを設定していません</p>
      )}
    </div>
  );
}
