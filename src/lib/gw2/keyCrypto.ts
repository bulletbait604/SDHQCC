import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

function encryptionSecret(): string {
  return (
    process.env.GW2_KEY_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.INTERNAL_API_SECRET ||
    ''
  ).trim()
}

export function gw2KeyEncryptionReady(): boolean {
  return encryptionSecret().length >= 8
}

function keyBytes(): Buffer {
  const secret = encryptionSecret()
  if (secret.length < 8) {
    throw new Error('Missing SESSION_SECRET (or GW2_KEY_SECRET) to store GW2 API keys.')
  }
  return scryptSync(secret, 'sdhqcc-gw2-user-key-v1', 32)
}

export function encryptGw2ApiKey(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptGw2ApiKey(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 3) throw new Error('Invalid stored GW2 key.')
  const iv = Buffer.from(parts[0], 'base64url')
  const tag = Buffer.from(parts[1], 'base64url')
  const encrypted = Buffer.from(parts[2], 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function gw2KeyLastFour(plain: string): string {
  const trimmed = plain.trim()
  if (trimmed.length < 4) return '****'
  return trimmed.slice(-4)
}
