"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Comment } from "@/lib/types";
import { Loader2, SendHorizonal } from "lucide-react";

interface CommentSectionProps {
  postId: string;
  comments: Comment[];
  currentUserId: string;
  onNewComment?: (comment: Comment) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export default function CommentSection({
  postId,
  comments: initialComments,
  currentUserId,
  onNewComment,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from("cf_comments")
      .insert({
        post_id: postId,
        user_id: currentUserId,
        content: text.trim(),
      })
      .select("*, profiles(*)")
      .single();

    if (insertError) {
      setError("コメントの送信に失敗しました");
    } else if (data) {
      const newComment = data as Comment;
      setComments((prev) => [...prev, newComment]);
      onNewComment?.(newComment);
      setText("");
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">
          まだコメントはありません
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const profile = comment.profiles;
            const displayName = profile?.display_name ?? "ユーザー";
            const initial = displayName.charAt(0).toUpperCase();
            return (
              <li key={comment.id} className="flex gap-2">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs font-semibold">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-gray-800 truncate">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-snug mt-0.5 break-words">
                    {comment.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Input */}
      <div className="flex gap-2 items-center">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="コメントを追加..."
          className="flex-1 h-9 text-sm rounded-full bg-gray-50 border-gray-200 focus-visible:ring-indigo-400"
          disabled={loading}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="h-9 w-9 rounded-full bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
