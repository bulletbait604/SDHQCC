import { Client, Receiver } from '@upstash/qstash'

export function clipEditorAppBaseUrl(): string {
  const explicit = (
    process.env.CLIP_EDITOR_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = (process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
  return ''
}

export function clipEditorStepUrl(): string {
  const base = clipEditorAppBaseUrl()
  if (!base) {
    throw new Error(
      'Set CLIP_EDITOR_APP_URL to your public Vercel URL (e.g. https://your-app.vercel.app)'
    )
  }
  return `${base}/api/clip-editor/steps/run`
}

/** Regional QStash API — must match the region shown in your Upstash QStash console. */
export function qStashBaseUrl(): string | undefined {
  const url = (
    process.env.QSTASH_URL ||
    process.env.CLIP_EDITOR_QSTASH_URL ||
    ''
  ).trim()
  return url ? url.replace(/\/$/, '') : undefined
}

export function qStashClient(): Client {
  const token = (process.env.QSTASH_TOKEN || '').trim()
  if (!token) {
    throw new Error('QSTASH_TOKEN is not configured (Upstash QStash — cloud queue for Vercel)')
  }
  const baseUrl = qStashBaseUrl()
  return baseUrl ? new Client({ token, baseUrl }) : new Client({ token })
}

export function isQStashConfigured(): boolean {
  return Boolean((process.env.QSTASH_TOKEN || '').trim())
}

export function qStashReceiver(): Receiver | null {
  const current = (process.env.QSTASH_CURRENT_SIGNING_KEY || '').trim()
  const next = (process.env.QSTASH_NEXT_SIGNING_KEY || '').trim()
  if (!current || !next) return null
  return new Receiver({ currentSigningKey: current, nextSigningKey: next })
}

export async function scheduleClipEditorStep(
  jobId: string,
  delaySeconds = 0
): Promise<void> {
  const client = qStashClient()
  await client.publishJSON({
    url: clipEditorStepUrl(),
    body: { jobId },
    retries: 3,
    ...(delaySeconds > 0 ? { delay: delaySeconds } : {}),
  })
}

export async function verifyClipEditorStepRequest(params: {
  signature: string | null
  body: string
}): Promise<boolean> {
  const receiver = qStashReceiver()
  if (!receiver || !params.signature) return false
  try {
    await receiver.verify({
      signature: params.signature,
      body: params.body,
      url: clipEditorStepUrl(),
    })
    return true
  } catch {
    return false
  }
}
