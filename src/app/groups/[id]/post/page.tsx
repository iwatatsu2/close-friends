"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MOODS = [
  { emoji: "😊", label: "うれしい" },
  { emoji: "😢", label: "かなしい" },
  { emoji: "😤", label: "むかつく" },
  { emoji: "🎉", label: "やったー" },
  { emoji: "😴", label: "ねむい" },
  { emoji: "🤔", label: "なやむ" },
];

export default function CreatePostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      let image_url: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageFile, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);

        image_url = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("cf_posts").insert({
        user_id: user.id,
        group_id: id,
        content: content.trim(),
        mood: selectedMood,
        image_url,
      });

      if (insertError) throw insertError;

      router.push(`/groups/${id}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`投稿に失敗しました: ${errMsg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-lg mx-auto">
        <Card className="border-indigo-800 bg-indigo-950/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">新しい投稿</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">内容</Label>
                <Textarea
                  id="content"
                  placeholder="今日はどんな気分？何かシェアしたいことは？"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  disabled={loading}
                  required
                />
              </div>

              {/* Mood selector */}
              <div className="space-y-2">
                <Label>気分（任意）</Label>
                <div className="flex gap-2 flex-wrap">
                  {MOODS.map(({ emoji, label }) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() =>
                        setSelectedMood(selectedMood === emoji ? null : emoji)
                      }
                      disabled={loading}
                      className={`flex flex-col items-center p-2 rounded-xl border-2 transition-colors text-2xl w-14
                        ${selectedMood === emoji
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-muted-foreground"
                        }`}
                      aria-label={label}
                      title={label}
                    >
                      {emoji}
                      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label>画像（任意）</Label>
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="プレビュー"
                      className="w-full rounded-lg object-cover max-h-48"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={loading}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !content.trim()}
                >
                  {loading ? "投稿中..." : "投稿する"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
