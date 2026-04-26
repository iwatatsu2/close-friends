import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import webpush from "web-push";

export async function POST(req: NextRequest) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ sent: 0, error: "VAPID keys not configured" });
  }
  webpush.setVapidDetails("mailto:noreply@closefriends.app", vapidPublic, vapidPrivate);

  const { groupId, title, body, url, excludeUserId } = await req.json();

  const supabase = await createClient();

  // Get all group members
  const { data: members } = await supabase
    .from("cf_group_members")
    .select("user_id")
    .eq("group_id", groupId);

  if (!members || members.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const userIds = members
    .map((m) => m.user_id)
    .filter((id) => id !== excludeUserId);

  // Get their push subscriptions
  const { data: subscriptions } = await supabase
    .from("cf_push_subscriptions")
    .select("*")
    .in("user_id", userIds);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const payload = JSON.stringify({ title, body, url });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err: unknown) {
      // Remove expired subscriptions
      if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
        await supabase.from("cf_push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return NextResponse.json({ sent });
}
