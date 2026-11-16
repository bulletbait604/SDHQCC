/** Redirect the browser to Twitch. Tokens stay on the server. */
export function startTwitchLogin(): void {
  const returnPath = window.location.pathname + window.location.search
  window.location.href = `/api/auth/twitch/start?return=${encodeURIComponent(returnPath)}`
}
