"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/PostCard";
import type { Group, Post } from "@/lib/types";

export default function GroupTimelinePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const [{ data: groupData }, { data: postsData }] = await Promise.all([
        supabase.from("cf_groups").select("*").eq("id", id).single(),
        supabase
          .from("cf_posts")
          .select("*, profiles:user_id(*)")
          .eq("group_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (groupData) setGroup(groupData);
      if (postsData) setPosts(postsData as Post[]);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleCopyInvite = async () => {
    if (!group) return;
    const inviteUrl = `${window.location.origin}/invite/${group.invite_code}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">グループが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold truncate">{group.name}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyInvite}
            className="shrink-0 text-xs"
          >
            {copied ? "コピー済み!" : "招待リンクをコピー"}
          </Button>
        </div>
        <div className="max-w-lg mx-auto mt-1">
          <p className="text-xs text-muted-foreground">
            招待コード: <span className="font-mono font-medium">{group.invite_code}</span>
          </p>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">まだ投稿がありません</p>
              <p className="text-muted-foreground text-sm mt-1">最初の投稿をしてみましょう！</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} />
          ))
        )}
      </div>

      {/* Floating + button */}
      <button
        onClick={() => router.push(`/groups/${id}/post`)}
        className="fixed bottom-20 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center text-2xl font-light hover:bg-primary/90 active:scale-95 transition-transform"
        aria-label="新しい投稿"
      >
        +
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-10">
        <div className="max-w-lg mx-auto flex">
          <button className="flex-1 py-3 text-center text-xs font-medium text-primary">
            <span className="text-lg block">📝</span>
            タイムライン
          </button>
          <button
            onClick={() => router.push(`/groups/${id}/sessions`)}
            className="flex-1 py-3 text-center text-xs text-muted-foreground hover:text-primary"
          >
            <span className="text-lg block">🎮</span>
            セッション
          </button>
          <button
            onClick={() => router.push(`/groups/${id}/schedule`)}
            className="flex-1 py-3 text-center text-xs text-muted-foreground hover:text-primary"
          >
            <span className="text-lg block">📅</span>
            スケジュール
          </button>
        </div>
      </nav>
    </div>
  );
}
