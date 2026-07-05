/** Client-safe Bungie OAuth user-facing error messages. */

export function bungieOAuthErrorMessage(code: string): string {
  switch (code) {
    case 'invalid_state':
      return 'OAuth session expired or was interrupted. Click Connect again without refreshing during Bungie login.'
    case 'missing_code':
      return 'Bungie did not return an authorization code.'
    case 'no_destiny_account':
      return 'No Destiny account is linked to this Bungie.net login.'
    case 'exchange_failed':
      return 'Token exchange failed. Confirm your Bungie app redirect URI matches this site exactly.'
    case 'auth_required':
      return 'Your SDHQCC session expired during Bungie login. Log in with Kick and try again.'
    default:
      return code
  }
}
