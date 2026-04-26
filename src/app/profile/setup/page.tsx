'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function ProfileSetupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, bio')
        .eq('id', user.id)
        .single()

      if (profile) {
        setDisplayName(profile.display_name ?? '')
        setBio(profile.bio ?? '')
      }
      setFetching(false)
    }

    fetchProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      setError('プロフィールの保存に失敗しました。もう一度お試しください')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

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
          <div className="text-4xl">✏️</div>
          <h1 className="text-2xl font-bold text-white">プロフィール設定</h1>
          <p className="text-sm text-indigo-300">グループのメンバーに表示されます</p>
        </div>

        <Card className="border-indigo-800 bg-indigo-950/60 shadow-lg backdrop-blur">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
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

              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-indigo-200">
                  自己紹介 <span className="text-indigo-500 font-normal">（任意）</span>
                </Label>
                <textarea
                  id="bio"
                  placeholder="ひとことメッセージや自己紹介を書いてみよう"
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

              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  disabled={loading || !displayName.trim()}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold disabled:opacity-50"
                  size="lg"
                >
                  {loading ? '保存中...' : '保存する'}
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
