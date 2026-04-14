import { Kick } from "arctic";

const kick = new Kick(
  process.env.KICK_CLIENT_ID!,
  process.env.KICK_CLIENT_SECRET!,
  process.env.KICK_REDIRECT_URI!
);

export async function createKickAuthURL() {
  const state = generateRandomString();
  const scopes = ["user:read", "chat:read", "chat:write", "channel:read"];
  const url = await kick.createAuthorizationURL(state, scopes);
  return { url, state };
}

export async function validateKickAuthorizationCode(code: string) {
  try {
    const tokens = await kick.validateAuthorizationCode(code);
    return {
      accessToken: tokens.accessToken(),
      refreshToken: tokens.refreshToken(),
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
