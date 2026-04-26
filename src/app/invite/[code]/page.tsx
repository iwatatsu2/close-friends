"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Group } from "@/lib/types";

type JoinState = "loading" | "found" | "already_member" | "not_found" | "error";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const supabase = createClient();

  const [group, setGroup] = useState<Group | null>(null);
  const [joinState, setJoinState] = useState<JoinState>("loading");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from("cf_groups")
        .select("*")
        .eq("invite_code", code)
        .single();

      if (groupError || !groupData) {
        setJoinState("not_found");
        return;
      }

      setGroup(groupData);

      // Check if already a member
      const { data: memberData } = await supabase
        .from("cf_group_members")
        .select("id")
        .eq("group_id", groupData.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberData) {
        setJoinState("already_member");
      } else {
        setJoinState("found");
      }
    };

    fetchGroup();
  }, [code]);

  const handleJoin = async () => {
    if (!group) return;
    setJoining(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("cf_group_members")
        .insert({ group_id: group.id, user_id: user.id, role: "member" });

      if (error) throw error;

      router.push(`/groups/${group.id}`);
    } catch (err) {
      console.error(err);
      setJoinState("error");
    } finally {
      setJoining(false);
    }
  };

  if (joinState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">確認中...</p>
      </div>
    );
  }

  if (joinState === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="py-10">
            <p className="text-lg font-semibold">招待リンクが無効です</p>
            <p className="text-sm text-muted-foreground mt-2">
              リンクが正しいか確認してください。
            </p>
            <Button className="mt-6 w-full" onClick={() => router.push("/")}>
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joinState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="py-10">
            <p className="text-lg font-semibold">エラーが発生しました</p>
            <p className="text-sm text-muted-foreground mt-2">
              もう一度お試しください。
            </p>
            <Button className="mt-6 w-full" onClick={() => router.push("/")}>
              ホームに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joinState === "already_member" && group) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle className="text-xl">{group.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              すでにこのグループのメンバーです。
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => router.push(`/groups/${group.id}`)}
            >
              グループを見る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-xl">グループへの招待</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="py-4">
            <p className="text-sm text-muted-foreground">招待されたグループ</p>
            <p className="text-2xl font-bold mt-1">{group?.name}</p>
          </div>
          <Button
            className="w-full"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? "参加中..." : "参加する"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/")}
            disabled={joining}
          >
            キャンセル
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
