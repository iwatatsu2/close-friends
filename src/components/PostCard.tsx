"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Post } from "@/lib/types";
import ReactionBar from "./ReactionBar";
import CommentSection from "./CommentSection";

interface PostCardProps {
  post: Post;
  currentUserId: string;
  groupId: string;
  onReaction?: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

export default function PostCard({ post, currentUserId, groupId, onReaction }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState(post.comments ?? []);

  const profile = post.profiles;
  const displayName = profile?.display_name ?? "ユーザー";
  const avatarUrl = profile?.avatar_url ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  const commentCount = localComments.length;

  return (
    <Card className="mb-4 overflow-hidden shadow-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
            <AvatarFallback className="bg-indigo-100 text-indigo-600 font-semibold text-sm">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400">{timeAgo(post.created_at)}</p>
          </div>
          {post.mood && (
            <span className="text-2xl" role="img" aria-label="mood">
              {post.mood}
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">
          {post.content}
        </p>

        {/* Image */}
        {post.image_url && (
          <div className="mb-3 rounded-xl overflow-hidden">
            <img
              src={post.image_url}
              alt="投稿画像"
              className="w-full object-cover max-h-80"
            />
          </div>
        )}

        {/* Reaction Bar */}
        <ReactionBar
          postId={post.id}
          reactions={post.reactions ?? []}
          currentUserId={currentUserId}
          onReaction={onReaction}
        />

        {/* Comment Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs text-gray-500 px-0 h-auto hover:text-indigo-600"
          onClick={() => setShowComments((v) => !v)}
        >
          {showComments
            ? "コメントを閉じる"
            : commentCount > 0
            ? `コメントを見る（${commentCount}件）`
            : "コメントする"}
        </Button>

        {/* Comments */}
        {showComments && (
          <div className="mt-3 border-t pt-3">
            <CommentSection
              postId={post.id}
              groupId={groupId}
              comments={localComments}
              currentUserId={currentUserId}
              onNewComment={(c) => setLocalComments((prev) => [...prev, c])}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
