import RunwayML from '@runwayml/sdk'
import { resolveRunwayApiSecret } from '@/lib/clipEditorServerKeys'
import { putBufferToR2 } from '@/lib/r2'

const RUNWAY_BROLL_VIRALITY_THRESHOLD = 85
const POLL_INTERVAL_MS = 4000
const MAX_POLL_ATTEMPTS = 45

export { RUNWAY_BROLL_VIRALITY_THRESHOLD }

async function pollRunwayTask(
  client: RunwayML,
  taskId: string
): Promise<string | null> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const task = await client.tasks.retrieve(taskId)
    const status = String(task.status || '').toUpperCase()
    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
      const output = (task as { output?: unknown }).output
      if (Array.isArray(output) && typeof output[0] === 'string') return output[0]
      if (output && typeof output === 'object') {
        const o = output as Record<string, unknown>
        if (typeof o.url === 'string') return o.url
        if (Array.isArray(o.video) && typeof o.video[0] === 'string') return o.video[0]
      }
      return null
    }
    if (status === 'FAILED' || status === 'CANCELLED') return null
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return null
}

/** Generate a short vertical B-roll clip via Runway Gen-4.5 text-to-video. */
export async function generateRunwayBrollAsset(params: {
  prompt: string
  username: string
  durationSeconds?: number
}): Promise<{ assetUrl: string; assetR2Key: string } | null> {
  const apiKey = resolveRunwayApiSecret()
  if (!apiKey) return null

  const prompt = params.prompt.trim().slice(0, 900)
  if (prompt.length < 8) return null

  const client = new RunwayML({ apiKey })
  const duration = Math.max(2, Math.min(4, Math.round(params.durationSeconds ?? 3)))

  try {
    const task = await client.textToVideo.create({
      model: 'gen4.5',
      promptText: prompt,
      ratio: '720:1280',
      duration,
    })

    const outputUrl = await pollRunwayTask(client, task.id)
    if (!outputUrl) return null

    const res = await fetch(outputUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const assetR2Key = `uploads/clips/${params.username}/${Date.now()}-runway-broll.mp4`
    await putBufferToR2(assetR2Key, buffer, 'video/mp4')

    const publicBase = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '')
    const assetUrl = publicBase ? `${publicBase}/${assetR2Key}` : outputUrl

    return { assetUrl, assetR2Key }
  } catch (error) {
    console.error('[clip-editor/runway-broll]', error)
    return null
  }
}

export function shouldEnrichWithRunway(viralityScore: number): boolean {
  return viralityScore >= RUNWAY_BROLL_VIRALITY_THRESHOLD
}
