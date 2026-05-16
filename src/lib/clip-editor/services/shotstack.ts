import {
  shotstackEditApiRoot,
  shotstackEditApiVersion,
  shotstackSubmitUserMessage,
} from '@/lib/shotstackEditUrl'
import { resolveShotstackApiKey } from '@/lib/clipEditorServerKeys'

export type ShotstackRenderPayload = {
  timeline: Record<string, unknown>
  output: Record<string, unknown>
}

export async function submitShotstackRender(
  payload: ShotstackRenderPayload
): Promise<string> {
  const apiKey = resolveShotstackApiKey()
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY is not configured')

  const res = await fetch(`${shotstackEditApiRoot()}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as {
    response?: { id?: string }
    id?: string
    message?: string
  }
  if (!res.ok) {
    throw new Error(shotstackSubmitUserMessage(data) || `Shotstack submit failed (${res.status})`)
  }
  const renderId = data.response?.id || data.id
  if (!renderId) throw new Error('Shotstack did not return a render id')
  return renderId
}

export type ShotstackRenderStatus = {
  status: string
  url?: string
  done: boolean
  failed: boolean
}

export async function pollShotstackRender(renderId: string): Promise<ShotstackRenderStatus> {
  const apiKey = resolveShotstackApiKey()
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY is not configured')

  const res = await fetch(`${shotstackEditApiRoot()}/render/${encodeURIComponent(renderId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as {
    response?: { status?: string; url?: string }
    status?: string
    url?: string
  }
  if (!res.ok) {
    throw new Error(shotstackSubmitUserMessage(data) || `Shotstack status failed (${res.status})`)
  }
  const response = data.response || data
  const status = String(response.status || '').toUpperCase()
  const url = typeof response.url === 'string' ? response.url : undefined
  return {
    status,
    url,
    done: status === 'DONE',
    failed: status === 'FAILED' || status === 'CANCELLED',
  }
}

export async function waitForShotstackRender(
  renderId: string,
  options?: { pollMs?: number; maxAttempts?: number }
): Promise<string> {
  const pollMs = options?.pollMs ?? 4000
  const maxAttempts = options?.maxAttempts ?? 120
  for (let i = 0; i < maxAttempts; i++) {
    const snap = await pollShotstackRender(renderId)
    if (snap.done && snap.url) return snap.url
    if (snap.failed) throw new Error(`Shotstack render ${renderId} failed (${snap.status})`)
    await new Promise((r) => setTimeout(r, pollMs))
  }
  throw new Error(`Shotstack render ${renderId} timed out`)
}

export function defaultShotstackOutput(): Record<string, unknown> {
  return {
    format: 'mp4',
    resolution: '1080',
    aspectRatio: '9:16',
    fps: 30,
    quality: 'high',
  }
}

export function shotstackApiVersionLabel(): string {
  return shotstackEditApiVersion()
}
