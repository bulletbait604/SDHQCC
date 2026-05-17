import { Client, Receiver } from '@upstash/qstash'
import { formatUnknownError } from '@/lib/clip-editor/formatError'

/** Default QStash region for this project (Upstash US). Override with QSTASH_URL for EU. */
export const QSTASH_US_BASE_URL = 'https://qstash-us-east-1.upstash.io'

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

/** QStash API base URL — defaults to US; set QSTASH_URL for EU (eu-central-1). */
export function qStashBaseUrl(): string {
  const url = (
    process.env.QSTASH_URL ||
    process.env.CLIP_EDITOR_QSTASH_URL ||
    QSTASH_US_BASE_URL
  ).trim()
  return url.replace(/\/$/, '')
}

export function qStashClient(): Client {
  const token = (process.env.QSTASH_TOKEN || '').trim()
  if (!token) {
    throw new Error('QSTASH_TOKEN is not configured (Upstash QStash — cloud queue for Vercel)')
  }
  return new Client({ token, baseUrl: qStashBaseUrl() })
}

export function isQStashConfigured(): boolean {
  return Boolean((process.env.QSTASH_TOKEN || '').trim())
}

/** Token alone is not enough — step callbacks require signing keys. */
export function isQStashFullyConfigured(): boolean {
  return isQStashConfigured() && qStashReceiver() !== null
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
  const url = clipEditorStepUrl()
  try {
    await client.publishJSON({
      url,
      body: { jobId },
      retries: 3,
      ...(delaySeconds > 0 ? { delay: delaySeconds } : {}),
    })
  } catch (error) {
    throw new Error(`QStash could not schedule next step (${url}): ${formatUnknownError(error)}`)
  }
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
