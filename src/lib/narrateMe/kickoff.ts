import {
  INTERNAL_API_SECRET_HEADER,
  getInternalApiSecret,
} from '@/lib/internalApi'

export function appBaseUrl(): string {
  const explicit = process.env.APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  return 'http://localhost:3000'
}

export function kickNarrateMeTick(jobId: string): void {
  const secret = getInternalApiSecret() || process.env.MODAL_SECRET?.trim() || ''
  const url = `${appBaseUrl()}/api/narrate-me/tick`
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret
        ? {
            [INTERNAL_API_SECRET_HEADER]: secret,
            Authorization: `Bearer ${secret}`,
          }
        : {}),
    },
    body: JSON.stringify({ jobId }),
  }).catch(() => {
    console.error('[narrate-me] background tick could not start')
  })
}
