"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus, Loader2, X } from "lucide-react";

interface PostFormProps {
  groupId: string;
  onSuccess?: () => void;
}

const MOOD_EMOJIS = ["😊", "😎", "🥰", "😅", "😴", "🤔", "😤", "🥳", "😷", "💪"];

export default function PostForm({ groupId, onSuccess }: PostFormProps) {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("本文を入力してください");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("ログインが必要です");
        setLoading(false);
        return;
      }

      let imageUrl: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(path, imageFile, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("cf_posts").insert({
        user_id: user.id,
        group_id: groupId,
        content: content.trim(),
        mood: mood,
        image_url: imageUrl,
      });

      if (insertError) throw insertError;

      setContent("");
      setMood(null);
      removeImage();
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "投稿に失敗しました";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4">
      {/* Mood selector */}
      <div className="flex gap-1 flex-wrap mb-3">
        {MOOD_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setMood(mood === emoji ? null : emoji)}
            className={`text-xl px-2 py-1 rounded-lg transition-colors ${
              mood === emoji
                ? "bg-indigo-100 ring-2 ring-indigo-400"
                : "hover:bg-gray-100"
            }`}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <Textarea
        placeholder="今どんな気分？気軽につぶやいて 📝"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[80px] resize-none border-0 focus-visible:ring-0 p-0 text-sm placeholder:text-gray-400"
      />

      {/* Image preview */}
      {imagePreview && (
        <div className="relative mt-2 inline-block">
          <img
            src={imagePreview}
            alt="プレビュー"
            className="max-h-48 rounded-xl object-cover"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-gray-400 hover:text-indigo-500 transition-colors"
          aria-label="画像を追加"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />

        <Button
          onClick={handleSubmit}
          disabled={loading || !content.trim()}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              投稿中...
            </>
          ) : (
            "投稿する"
          )}
        </Button>
      </div>
    </div>
  );
}
