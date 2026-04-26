'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Loader2 } from 'lucide-react'

export default function ProfileSetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, bio, avatar_url')
        .eq('id', user.id)
        .single()

      if (profile) {
        setDisplayName(profile.display_name ?? '')
        setBio(profile.bio ?? '')
        setAvatarUrl(profile.avatar_url ?? null)
      }
      setFetching(false)
    }

    fetchProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('画像は2MB以下にしてください')
      return
    }
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      let newAvatarUrl = avatarUrl

      if (avatarFile) {
        setUploading(true)
        const ext = avatarFile.name.split('.').pop()
        const fileName = `${userId}/avatar-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true })

        if (uploadError) {
          // avatarsバケットがなければpost-imagesを使用
          const { error: uploadError2 } = await supabase.storage
            .from('post-images')
            .upload(`avatars/${fileName}`, avatarFile, { upsert: true })

          if (uploadError2) throw uploadError2

          const { data: urlData } = supabase.storage
            .from('post-images')
            .getPublicUrl(`avatars/${fileName}`)
          newAvatarUrl = urlData.publicUrl
        } else {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)
          newAvatarUrl = urlData.publicUrl
        }
        setUploading(false)
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          avatar_url: newAvatarUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (updateError) throw updateError

      setAvatarUrl(newAvatarUrl)
      setAvatarFile(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存に失敗しました'
      setError(msg)
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?'
  const previewSrc = avatarPreview ?? avatarUrl

  if (fetching) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-indigo-400 text-sm animate-pulse">読み込み中...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white">プロフィール編集</h1>
          <p className="text-sm text-indigo-300">グループのメンバーに表示されます</p>
        </div>

        <Card className="border-indigo-800 bg-indigo-950/60 shadow-lg backdrop-blur">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-2 border-indigo-600">
                    {previewSrc ? (
                      <AvatarImage src={previewSrc} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="bg-indigo-800 text-indigo-200 text-2xl font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-500 hover:bg-indigo-400 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    <Camera className="h-4 w-4 text-white" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <p className="text-xs text-indigo-500">タップして画像を変更（2MB以下）</p>
              </div>

              {/* Display name */}
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-indigo-200">
                  表示名 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="例：たなか ゆい"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={50}
                  className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500 focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="text-xs text-indigo-500">{displayName.length}/50文字</p>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-indigo-200">
                  自己紹介 <span className="text-indigo-500 font-normal">（任意）</span>
                </Label>
                <textarea
                  id="bio"
                  placeholder="好きなゲームや自己紹介を書いてみよう"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={4}
                  className="w-full rounded-md border border-indigo-700 bg-indigo-900/50 px-3 py-2 text-sm text-white placeholder:text-indigo-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-indigo-500">{bio.length}/200文字</p>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-sm text-green-400 bg-green-900/30 border border-green-800 rounded-md px-3 py-2">
                  保存しました！
                </p>
              )}

              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  disabled={loading || !displayName.trim()}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold disabled:opacity-50"
                  size="lg"
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />画像アップロード中...</>
                  ) : loading ? '保存中...' : '保存する'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-indigo-400 hover:text-indigo-300"
                  onClick={() => router.back()}
                >
                  戻る
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
