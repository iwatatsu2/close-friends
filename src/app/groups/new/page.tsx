"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewGroupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const invite_code = nanoid(8);

      const { data: group, error: groupError } = await supabase
        .from("cf_groups")
        .insert({ name: groupName.trim(), invite_code, created_by: user.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from("cf_group_members")
        .insert({ group_id: group.id, user_id: user.id, role: "owner" });

      if (memberError) throw memberError;

      router.push(`/groups/${group.id}`);
    } catch (err) {
      setError("グループの作成に失敗しました。もう一度お試しください。");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-center">新しいグループを作成</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">グループ名</Label>
              <Input
                id="groupName"
                type="text"
                placeholder="例：家族、親友グループ"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !groupName.trim()}
            >
              {loading ? "作成中..." : "グループを作成"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.back()}
              disabled={loading}
            >
              キャンセル
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
