import { SupabaseClient } from "@supabase/supabase-js";

/**
 * profilesテーブルにレコードがなければ自動作成する
 */
export async function ensureProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!data) {
    // profileが存在しない → auth.usersのメタデータから作成
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const displayName =
      user?.user_metadata?.display_name ?? "名無しさん";

    await supabase.from("profiles").upsert(
      { id: userId, display_name: displayName },
      { onConflict: "id" }
    );
  }
}
