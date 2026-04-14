// Simplified KICK OAuth implementation without Arctic
export async function createKickAuthURL() {
  const state = generateRandomString();
  const scopes = ["user:read", "chat:read", "chat:write", "channel:read"];
  const clientId = process.env.KICK_CLIENT_ID;
  const redirectUri = process.env.KICK_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/auth/kick/callback`;
  
  const url = `https://kick.com/api/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes.join('+')}&state=${state}`;
  
  return { url, state };
}

export async function validateKickAuthorizationCode(code: string) {
  try {
    // This is a simplified implementation - you'll need to implement the actual token exchange
    const response = await fetch('https://kick.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: process.env.KICK_CLIENT_ID!,
        client_secret: process.env.KICK_CLIENT_SECRET!,
        redirect_uri: process.env.KICK_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/auth/kick/callback`,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
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

function generateRandomString(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
