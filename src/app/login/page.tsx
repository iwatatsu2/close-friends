'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <Link href="/" className="text-3xl block">💌</Link>
          <h1 className="text-2xl font-bold text-gray-900">ログイン</h1>
          <p className="text-sm text-gray-500">CloseFriendsへようこそ</p>
        </div>

        {/* Form card */}
        <Card className="border-rose-100 shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-700">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-700">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                size="lg"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer links */}
        <div className="text-center space-y-2 text-sm text-gray-500">
          <p>
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="text-rose-500 font-medium hover:underline">
              新規登録
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className="hover:text-gray-700 hover:underline">
              パスワードをお忘れですか？
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
