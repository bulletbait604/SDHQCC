/** Redirect browser to Kick OAuth via server-side PKCE state (no client cookies). */
export async function startKickLogin(): Promise<void> {
  const returnPath = window.location.pathname + window.location.search
  window.location.href = `/api/auth/kick/start?return=${encodeURIComponent(returnPath)}`
}
