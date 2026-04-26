import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: memberships } = await supabase
      .from('cf_group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(1)

    if (memberships && memberships.length > 0) {
      redirect(`/groups/${memberships[0].group_id}`)
    } else {
      redirect('/groups/new')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / App name */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🎮</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">CloseFriends</h1>
          <p className="text-sm text-indigo-300">いつメンとつながる、秘密基地</p>
        </div>

        {/* Group photo */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-600 shadow-2xl shadow-indigo-500/20">
          <Image
            src="/group-photo.png"
            alt="仲間たちの写真"
            width={600}
            height={400}
            className="w-full object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-white text-sm font-bold drop-shadow-lg">最強の宴メン、ここに集結。</p>
          </div>
        </div>

        {/* Feature highlights */}
        <Card className="border-indigo-800 bg-indigo-950/60 shadow-lg backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-indigo-200">こんなアプリです</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-lg">🔒</span>
              <div>
                <p className="font-medium text-white">招待制のクローズドグループ</p>
                <p className="text-indigo-400">リンクを知ってる仲間だけの空間</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🕹️</span>
              <div>
                <p className="font-medium text-white">セッション募集</p>
                <p className="text-indigo-400">「今夜APEXやろう！」をワンタップで</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">📅</span>
              <div>
                <p className="font-medium text-white">遊べる日カレンダー</p>
                <p className="text-indigo-400">みんなの空いてる日が一目でわかる</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">📝</span>
              <div>
                <p className="font-medium text-white">タイムライン</p>
                <p className="text-indigo-400">近況やスクショを気軽にシェア</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA buttons */}
        <div className="space-y-3">
          <Link href="/signup">
            <Button className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold" size="lg">
              はじめる
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full border-indigo-600 text-indigo-300 hover:bg-indigo-900/50 hover:text-white" size="lg">
              ログイン
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-indigo-500">
          登録することで
          <Link href="/terms" className="underline hover:text-indigo-300">利用規約</Link>
          および
          <Link href="/privacy" className="underline hover:text-indigo-300">プライバシーポリシー</Link>
          に同意したことになります
        </p>
      </div>
    </main>
  )
}
