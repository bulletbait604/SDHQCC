// KICK OAuth 2.1 implementation with PKCE
// Docs: https://github.com/KickEngineering/KickDevDocs

// PKCE helper functions
function generateRandomString(): string {
  const array = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    require('crypto').randomFillSync(array);
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    require('crypto').randomFillSync(array);
  }
  return base64URLEncode(array.buffer);
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(digest);
  } else {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

export async function createKickAuthURL() {
  const state = generateRandomString();
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const scopes = ["user:read"];
  const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI || window.location.origin + '/auth/kick/callback';

  // Correct KICK OAuth endpoint: https://id.kick.com/oauth/authorize
  const url = `https://id.kick.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes.join('+')}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  return { url, state, codeVerifier };
}

export async function validateKickAuthorizationCode(code: string, codeVerifier: string) {
  try {
    const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID;
    const clientSecret = process.env.KICK_CLIENT_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI || window.location.origin + '/auth/kick/callback';

    // Correct KICK token endpoint: https://id.kick.com/oauth/token
    const response = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    };
  } catch (error) {
    console.error("Kick OAuth validation failed:", error);
    throw error;
  }
}

export async function getKickUser(accessToken: string) {
  try {
    const response = await fetch("https://api.kick.com/public/v1/user", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error("Failed to fetch Kick user:", error);
    throw error;
  }
}
