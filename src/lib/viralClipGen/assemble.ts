import {
  shotstackEditApiRoot,
  shotstackSubmitUserMessage,
} from '@/lib/shotstackEditUrl'
import { VIRAL_CLIP_OUTPUT_SIZE } from '@/lib/viralClipGen/config'

function resolveShotstackApiKey(): string | undefined {
  const key = process.env.SHOTSTACK_API_KEY?.trim()
  return key || undefined
}

export function shotstackConfigured(): boolean {
  return Boolean(resolveShotstackApiKey())
}

async function pollRender(renderId: string, apiKey: string): Promise<string> {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const res = await fetch(`${shotstackEditApiRoot()}/render/${encodeURIComponent(renderId)}`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    })
    const data = (await res.json().catch(() => ({}))) as {
      response?: { status?: string; url?: string }
      message?: string
    }
    if (!res.ok) {
      throw new Error(shotstackSubmitUserMessage(data) || 'Could not check the final render.')
    }
    const status = data.response?.status
    if (status === 'done' && data.response?.url) return data.response.url
    if (status === 'failed') throw new Error('Final assembly failed. Please try again.')
    await new Promise((r) => setTimeout(r, 4000))
  }
  throw new Error('Final assembly timed out. Try a shorter clip.')
}

/** Concatenate fal segments into one 9:16 mp4. No-op for a single clip. */
export async function assembleViralClipIfNeeded(params: {
  segmentUrls: string[]
  segmentDurations: number[]
}): Promise<string> {
  if (params.segmentUrls.length === 0) {
    throw new Error('No video segments to assemble.')
  }
  if (params.segmentUrls.length === 1) return params.segmentUrls[0]!

  const apiKey = resolveShotstackApiKey()
  if (!apiKey) {
    throw new Error(
      'Clips longer than 10 seconds need Shotstack assembly. Add SHOTSTACK_API_KEY on the server, or generate a 5s/10s clip.'
    )
  }

  let start = 0
  const clips = params.segmentUrls.map((src, i) => {
    const length = params.segmentDurations[i] ?? 5
    const clip = {
      asset: { type: 'video', src },
      start,
      length,
      fit: 'cover',
    }
    start += length
    return clip
  })

  const body = {
    timeline: {
      background: '#000000',
      tracks: [{ clips }],
    },
    output: {
      format: 'mp4',
      aspectRatio: '9:16',
      size: VIRAL_CLIP_OUTPUT_SIZE,
    },
  }

  const res = await fetch(`${shotstackEditApiRoot()}/render`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    response?: { id?: string }
    message?: string
  }
  if (!res.ok || !data.response?.id) {
    throw new Error(shotstackSubmitUserMessage(data) || 'Could not start final assembly.')
  }
  return pollRender(data.response.id, apiKey)
}
