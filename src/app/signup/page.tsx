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

    // Create auth user
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
      // Insert into profiles table
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
        email: email,
      })

      if (profileError) {
        // Profile insert failed but auth user was created — proceed anyway
        console.error('Profile insert error:', profileError.message)
      }
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
          <h1 className="text-2xl font-bold text-gray-900">新規登録</h1>
          <p className="text-sm text-gray-500">CloseFriendsを始めましょう</p>
        </div>

        {/* Form card */}
        <Card className="border-rose-100 shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-gray-700">表示名</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="例：たなか ゆい"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoComplete="name"
                  className="border-gray-200 focus:border-rose-300 focus:ring-rose-200"
                />
                <p className="text-xs text-gray-400">グループ内で表示される名前です</p>
              </div>

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
                  placeholder="8文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
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
                {loading ? '登録中...' : '無料で始める'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-rose-500 font-medium hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  )
}
