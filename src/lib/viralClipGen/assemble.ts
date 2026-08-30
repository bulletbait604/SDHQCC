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

export async function submitViralClipAssembly(params: {
  segmentUrls: string[]
  segmentDurations: number[]
}): Promise<{ url?: string; renderId?: string }> {
  if (params.segmentUrls.length === 0) {
    throw new Error('No video segments to assemble.')
  }
  if (params.segmentUrls.length === 1) return { url: params.segmentUrls[0] }

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
  return { renderId: data.response.id }
}

export async function checkViralClipAssembly(
  renderId: string
): Promise<{ url?: string; pending?: boolean }> {
  const apiKey = resolveShotstackApiKey()
  if (!apiKey) throw new Error('SHOTSTACK_API_KEY is not configured')

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
  if (status === 'done' && data.response?.url) return { url: data.response.url }
  if (status === 'failed') throw new Error('Final assembly failed. Please try again.')
  return { pending: true }
}
