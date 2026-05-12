import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get the current authenticated user, refreshing the session if needed.
 * This prevents unnecessary logouts when the access token has expired
 * but the refresh token is still valid.
 */
export async function getAuthUser(supabase: SupabaseClient) {
  // First try getUser (validates with server)
  const { data: { user }, error } = await supabase.auth.getUser();

  if (user) return user;

  // If getUser failed, try refreshing the session
  if (error) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Session exists but token might be stale, refresh it
      const { data: refreshData } = await supabase.auth.refreshSession();
      return refreshData.user;
    }
  }

  return null;
}
