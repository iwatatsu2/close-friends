"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Availability } from "@/lib/types";

function getWeekDates(offset: number = 0): Date[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() + offset * 7 - today.getDay() + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const supabase = createClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("24:00");

  const weekDates = getWeekDates(weekOffset);
  const weekStart = formatDate(weekDates[0]);
  const weekEnd = formatDate(weekDates[6]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data } = await supabase
        .from("cf_availability")
        .select("*, profiles(*)")
        .eq("group_id", groupId)
        .gte("available_date", weekStart)
        .lte("available_date", weekEnd)
        .order("available_date");

      setAvailability(data || []);
      setLoading(false);
    }
    load();
  }, [groupId, weekOffset, supabase, weekStart, weekEnd]);

  async function toggleAvailability(dateStr: string) {
    const existing = availability.find(
      (a) => a.user_id === currentUserId && a.available_date === dateStr
    );

    if (existing) {
      await supabase.from("cf_availability").delete().eq("id", existing.id);
      setAvailability((prev) => prev.filter((a) => a.id !== existing.id));
    } else {
      setEditingDate(dateStr);
    }
  }

  async function saveAvailability() {
    if (!editingDate) return;
    const { data } = await supabase
      .from("cf_availability")
      .insert({
        group_id: groupId,
        user_id: currentUserId,
        available_date: editingDate,
        start_time: startTime,
        end_time: endTime,
      })
      .select("*, profiles(*)")
      .single();

    if (data) {
      setAvailability((prev) => [...prev, data]);
    }
    setEditingDate(null);
  }

  if (loading) {
    return <div className="flex justify-center p-8 text-indigo-400">読み込み中...</div>;
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <button onClick={() => router.push(`/groups/${groupId}`)} className="text-indigo-400 text-sm mb-1">
        ← タイムラインに戻る
      </button>
      <h1 className="text-xl font-bold mb-4 text-white">遊べる日カレンダー</h1>

      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" className="border-indigo-600 text-indigo-300 hover:bg-indigo-900/50" onClick={() => setWeekOffset((w) => w - 1)}>
          ← 前の週
        </Button>
        <span className="text-sm font-medium text-indigo-200">
          {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} 〜 {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
        </span>
        <Button variant="outline" size="sm" className="border-indigo-600 text-indigo-300 hover:bg-indigo-900/50" onClick={() => setWeekOffset((w) => w + 1)}>
          次の週 →
        </Button>
      </div>

      <div className="space-y-2">
        {weekDates.map((date, i) => {
          const dateStr = formatDate(date);
          const dayAvail = availability.filter((a) => a.available_date === dateStr);
          const myAvail = dayAvail.find((a) => a.user_id === currentUserId);
          const isToday = formatDate(new Date()) === dateStr;
          const isPast = date < new Date(formatDate(new Date()));

          return (
            <Card key={dateStr} className={`border-indigo-800 bg-indigo-950/60 ${isToday ? "ring-2 ring-indigo-400" : ""} ${isPast ? "opacity-50" : ""}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold w-6 text-center ${i >= 5 ? "text-blue-400" : "text-indigo-200"} ${i === 6 ? "text-red-400" : ""}`}>
                      {WEEKDAYS[i]}
                    </span>
                    <span className="text-sm text-indigo-200">
                      {date.getMonth() + 1}/{date.getDate()}
                    </span>
                    {isToday && <span className="text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded">今日</span>}
                  </div>
                  {!isPast && (
                    <Button
                      size="sm"
                      onClick={() => toggleAvailability(dateStr)}
                      className={myAvail
                        ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                        : "bg-transparent border border-indigo-600 text-indigo-300 hover:bg-indigo-900/50"
                      }
                    >
                      {myAvail ? "✓ 遊べる" : "遊べる"}
                    </Button>
                  )}
                </div>

                {dayAvail.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dayAvail.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900/50 text-green-300"
                      >
                        {a.profiles?.display_name || "?"}
                        {a.start_time && (
                          <span className="text-green-400">
                            {a.start_time.slice(0, 5)}~{a.end_time?.slice(0, 5)}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingDate && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setEditingDate(null)}>
          <div className="bg-indigo-950 border-t border-indigo-800 w-full max-w-lg rounded-t-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3 text-white">遊べる時間帯</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-sm text-indigo-400">開始</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border-indigo-700 bg-indigo-900/50 text-white" />
              </div>
              <div>
                <label className="text-sm text-indigo-400">終了</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border-indigo-700 bg-indigo-900/50 text-white" />
              </div>
            </div>
            <Button className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold" onClick={saveAvailability}>登録する</Button>
          </div>
        </div>
      )}
    </div>
  );
}
