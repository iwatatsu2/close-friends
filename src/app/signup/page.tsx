'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('このメールアドレスはすでに登録されています')
      } else {
        setError('登録に失敗しました。しばらくしてからもう一度お試しください')
      }
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
      })

      if (profileError) {
        console.error('Profile insert error:', profileError.message)
      }
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-3xl">🎮</div>
          <h1 className="text-2xl font-bold text-white">新規登録</h1>
          <p className="text-sm text-indigo-300">YoruBaseを始めましょう</p>
        </div>

        <Card className="border-indigo-800 bg-indigo-950/60 shadow-lg backdrop-blur">
          <CardContent className="pt-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-indigo-200">表示名</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="例：たなか ゆい"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoComplete="name"
                  className="border-indigo-700 bg-indigo-900/50 text-white placeholder:text-indigo-500 focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="text-xs text-indigo-500">グループ内で表示される名前です</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-indigo-200">メールアドレス</Label>
                <Input
                  id="email"
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
                  placeholder="8文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
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
                {loading ? '登録中...' : '無料で始める'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-indigo-400">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-indigo-300 font-medium hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  )
}
