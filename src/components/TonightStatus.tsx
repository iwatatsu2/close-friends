"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TonightStatusProps {
  groupId: string;
  currentUserId: string;
}

const STATUSES = [
  { key: "ready", emoji: "🟢", label: "参戦OK！", color: "bg-green-900/50 border-green-600 text-green-300" },
  { key: "maybe", emoji: "🟡", label: "寝かしつけ中", color: "bg-yellow-900/50 border-yellow-600 text-yellow-300" },
  { key: "late", emoji: "🔵", label: "遅れて参戦", color: "bg-blue-900/50 border-blue-600 text-blue-300" },
  { key: "off", emoji: "⚫", label: "今日は無理", color: "bg-gray-900/50 border-gray-600 text-gray-400" },
] as const;

type MemberStatus = {
  user_id: string;
  status: string;
  display_name: string;
  avatar_url: string | null;
};

function getJSTToday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
  return jst.toISOString().split("T")[0];
}

export default function TonightStatus({ groupId, currentUserId }: TonightStatusProps) {
  const supabaseRef = useRef(createClient());
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [myName, setMyName] = useState("自分");
  const [initialized, setInitialized] = useState(false);

  const today = getJSTToday();

  // Load statuses once on mount (when currentUserId is available)
  useEffect(() => {
    if (!currentUserId || !groupId || initialized) return;

    const supabase = supabaseRef.current;

    // Load my profile name
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", currentUserId)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setMyName(data.display_name);
      });

    // Load existing statuses
    (async () => {
      try {
        const { data: statusData, error } = await supabase
          .from("cf_tonight_status")
          .select("user_id, status")
          .eq("group_id", groupId)
          .eq("date", today);

        if (error) {
          console.error("loadStatuses error:", error);
          setInitialized(true);
          return;
        }

        if (statusData && statusData.length > 0) {
          const userIds = statusData.map((d: any) => d.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", userIds);

          const profileMap = new Map<string, any>();
          (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

          const mapped: MemberStatus[] = statusData.map((d: any) => ({
            user_id: d.user_id,
            status: d.status,
            display_name: profileMap.get(d.user_id)?.display_name ?? "?",
            avatar_url: profileMap.get(d.user_id)?.avatar_url ?? null,
          }));

          setMembers(mapped);
          const mine = mapped.find((m) => m.user_id === currentUserId);
          if (mine) {
            setMyStatus(mine.status);
            setMyName(mine.display_name);
          }
        }
      } catch (e) {
        console.error("loadStatuses exception:", e);
      }
      setInitialized(true);
    })();
  }, [currentUserId, groupId, today, initialized]);

  async function handleSetStatus(statusKey: string) {
    if (loading || !currentUserId) return;
    setLoading(true);

    const supabase = supabaseRef.current;

    if (myStatus === statusKey) {
      // Toggle off
      setMyStatus(null);
      setMembers((prev) => prev.filter((m) => m.user_id !== currentUserId));

      await supabase
        .from("cf_tonight_status")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", currentUserId)
        .eq("date", today);
    } else {
      // Set new status - optimistic update
      const newMember: MemberStatus = {
        user_id: currentUserId,
        status: statusKey,
        display_name: myName,
        avatar_url: null,
      };
      setMyStatus(statusKey);
      setMembers((prev) => {
        const others = prev.filter((m) => m.user_id !== currentUserId);
        return [...others, newMember];
      });

      // DB: delete then insert
      await supabase
        .from("cf_tonight_status")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", currentUserId)
        .eq("date", today);

      const { error } = await supabase
        .from("cf_tonight_status")
        .insert({
          group_id: groupId,
          user_id: currentUserId,
          date: today,
          status: statusKey,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("setStatus insert error:", error);
      }
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
            onClick={() => handleSetStatus(s.key)}
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
      {members.length > 0 ? (
        <div className="space-y-1.5">
          {members.map((m) => {
            const statusInfo = STATUSES.find((s) => s.key === m.status);
            const isMe = m.user_id === currentUserId;
            return (
              <div key={m.user_id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isMe ? "bg-indigo-900/40" : ""}`}>
                <Avatar className="h-6 w-6">
                  {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                  <AvatarFallback className="bg-indigo-800 text-indigo-300 text-[10px]">
                    {m.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-indigo-200 flex-1 truncate">
                  {m.display_name}{isMe && " (自分)"}
                </span>
                <span className="text-xs">
                  {statusInfo?.emoji} {statusInfo?.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-indigo-500 text-center">まだ誰もステータスを設定していません</p>
      )}
    </div>
  );
}
