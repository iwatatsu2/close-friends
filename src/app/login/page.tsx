'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

type LoginMode = 'magic' | 'password'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<LoginMode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError('メール送信に失敗しました。もう一度お試しください')
      setLoading(false)
      return
    }

    setMagicLinkSent(true)
    setLoading(false)
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (magicLinkSent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="text-3xl">✉️</div>
            <h1 className="text-2xl font-bold text-white">メールを確認してね</h1>
            <p className="text-sm text-indigo-300 mt-2">
              <span className="font-medium text-white">{email}</span> に<br />
              ログインリンクを送りました
            </p>
          </div>

          <Card className="border-indigo-800 bg-indigo-950/60 shadow-lg backdrop-blur">
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-indigo-300 text-center">
                メールのリンクをタップするとログインできます
              </p>
              <Button
                variant="outline"
                className="w-full border-indigo-600 text-indigo-300 hover:bg-indigo-900/50 hover:text-white"
                onClick={() => {
                  setMagicLinkSent(false)
                  setLoading(false)
                }}
              >
                戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-3xl">🎮</div>
          <h1 className="text-2xl font-bold text-white">ログイン</h1>
          <p className="text-sm text-indigo-300">YoruBaseへようこそ</p>
        </div>

        <Card className="border-indigo-800 bg-indigo-950/60 shadow-lg backdrop-blur">
          <CardContent className="pt-6">
            {/* Tab switcher */}
            <div className="flex mb-5 rounded-lg bg-indigo-900/50 p-1">
              <button
                type="button"
                onClick={() => { setMode('magic'); setError(null) }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'magic'
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-400 hover:text-indigo-200'
                }`}
              >
                メールで簡単ログイン
              </button>
              <button
                type="button"
                onClick={() => { setMode('password'); setError(null) }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'password'
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-400 hover:text-indigo-200'
                }`}
              >
                パスワード
              </button>
            </div>

            {mode === 'magic' ? (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-magic" className="text-indigo-200">メールアドレス</Label>
                  <Input
                    id="email-magic"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <p className="text-xs text-indigo-400">
                  ログインリンクをメールに送信します。パスワード不要！
                </p>

                {error && (
                  <p className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold"
                  size="lg"
                >
                  {loading ? '送信中...' : 'ログインリンクを送る'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-pw" className="text-indigo-200">メールアドレス</Label>
                  <Input
                    id="email-pw"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-indigo-200">パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold"
                  size="lg"
                >
                  {loading ? 'ログイン中...' : 'ログイン'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center space-y-2 text-sm text-indigo-400">
          <p>
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-indigo-300 font-medium hover:underline">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
