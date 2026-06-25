import { createKickAuthURL } from '@/lib/kick-oauth'

/** Redirect browser to Kick OAuth; stores PKCE verifier and return path in cookies. */
export async function startKickLogin(): Promise<void> {
  try {
    const { url, codeVerifier } = await createKickAuthURL()
    const isSecure = window.location.protocol === 'https:'
    const secureFlag = isSecure ? '; Secure' : ''
    const sameSite = isSecure ? 'None' : 'Lax'
    document.cookie = `kickCodeVerifier=${codeVerifier}; path=/; max-age=600; SameSite=${sameSite}${secureFlag}`
    document.cookie = `kickAuthReturn=${window.location.pathname}; path=/; max-age=600; SameSite=${sameSite}${secureFlag}`
    window.location.href = url
  } catch (error) {
    console.error('Failed to create KICK auth URL:', error)
  }
}
