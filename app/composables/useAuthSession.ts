type SupabaseSessionUser = {
  id: string
  email?: string | null
}

type SupabaseAuthLike = {
  auth: {
    getSession: () => Promise<{
      data: {
        session: {
          user: SupabaseSessionUser
        } | null
      }
    }>
  }
}

/**
 * @deprecated Use the `app/plugins/supabase-auth.client.ts` plugin and `useSupabaseUser()` / `$authReady` instead.
 */
export async function waitForSupabaseSession(
  supabase: SupabaseAuthLike,
  timeoutMs = 1200,
  intervalMs = 75,
) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        return data.session.user
      }
    } catch {
      // Keep polling until the timeout expires; transient auth hydration errors are expected.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return null
}