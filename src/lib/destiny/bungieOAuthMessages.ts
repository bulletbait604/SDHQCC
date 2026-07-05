/** Client-safe Bungie OAuth user-facing error messages. */

export function bungieOAuthErrorMessage(code: string): string {
  const lower = code.toLowerCase()
  if (lower.includes('redirect_uri') || lower.includes('redirect uri')) {
    return 'Redirect URI mismatch. Copy the redirect URL shown below into your Bungie app settings exactly.'
  }
  if (lower.includes('invalid_grant') || lower.includes('authorization code')) {
    return 'Authorization code expired or already used. Click Connect and complete Bungie login in one try.'
  }
  if (lower.includes('client_id') || lower.includes('client secret') || lower.includes('unauthorized')) {
    return 'Bungie client ID, secret, or API key is wrong. All three must come from the same Bungie application.'
  }

  switch (code) {
    case 'invalid_state':
      return 'OAuth session expired or was interrupted. Click Connect again without refreshing during Bungie login.'
    case 'missing_code':
      return 'Bungie did not return an authorization code.'
    case 'no_destiny_account':
      return 'No Destiny account is linked to this Bungie.net login.'
    case 'exchange_failed':
      return 'Token exchange failed. Confirm your Bungie app redirect URI matches this site exactly.'
    case 'redirect_uri_mismatch':
      return 'Redirect URI mismatch. Copy the redirect URL from Profile (below) into Bungie OAuth settings exactly.'
    case 'auth_required':
      return 'Your SDHQCC session expired during Bungie login. Log in with Kick and try again.'
    default:
      return code
  }
}
