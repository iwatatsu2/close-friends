import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId, endpoint, p256dh, auth } = await req.json();

  if (!userId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();

  await supabase.from("cf_push_subscriptions").upsert(
    { user_id: userId, endpoint, p256dh, auth },
    { onConflict: "endpoint" }
  );

  return NextResponse.json({ ok: true });
}
