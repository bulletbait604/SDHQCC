import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { extractBalancedJsonObject } from '@/lib/algorithmPlatformNormalize'
import { generatePresignedReadUrl } from '@/lib/r2'
import {
  analysisWindows,
  narrateMeGeminiApiKey,
  narrateMeGeminiModel,
  roundTs,
} from '@/lib/narrateMe/config'
import type { TimelineEvent } from '@/lib/narrateMe/types'

function geminiText(response: { text?: string }): string {
  if (typeof response.text === 'string' && response.text.trim()) return response.text
  const rec = response as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = rec.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n').trim()
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const balanced = extractBalancedJsonObject(trimmed)
    if (!balanced) return null
    try {
      return JSON.parse(balanced) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function asStringArray(value: unknown, max = 16): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((s) => s.trim().slice(0, 240))
    .slice(0, max)
}

function clampConfidence(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0.5
  return Math.min(1, Math.max(0, n))
}

function buildChunkPrompt(params: {
  prompt: string
  startTime: number
  endTime: number
  durationSeconds: number
}): string {
  return `You are a forensic video analyst. Watch ONLY the specified span of this video.

Source video duration: ${params.durationSeconds.toFixed(1)}s
Analyze ONLY timestamps ${params.startTime.toFixed(1)}s through ${params.endTime.toFixed(1)}s.
Use the actual video timeline. Do not invent timestamps.

Creator focus prompt:
"""
${params.prompt.replace(/"""/g, '"').slice(0, 2000)}
"""

The VIDEO is the source of truth. The prompt only controls what to pay attention to.
If something is not clearly visible or audible in this span, omit it or mark low confidence.
Do NOT invent item names, quantities, UI options, buildings, characters, Pals, resources, requirements, dialogue, actions, menus, buttons, events, timestamps, or game mechanics.

Return ONLY JSON:
{
  "events": [
    {
      "startTime": 421.2,
      "endTime": 438.7,
      "event": "Player opens the Pal Researching Lab",
      "visibleElements": ["Researching Lab UI"],
      "actions": ["opens research interface"],
      "ocr": [],
      "entities": [],
      "quantities": [],
      "uiState": ["Research menu opens"],
      "dialogue": [],
      "evidence": ["Researching Lab UI visible", "Research menu opens"],
      "confidence": 0.97
    }
  ]
}

Rules:
- startTime/endTime must fall inside ${params.startTime.toFixed(1)}–${params.endTime.toFixed(1)}.
- Only include meaningful events (UI opens, selections, visible requirements, player actions, spoken lines that are actually heard).
- evidence must describe what was seen or heard, not guesses.
- If this span has no confident events, return {"events":[]}.`
}

export function parseTimelineEvents(
  raw: Record<string, unknown>,
  chunkIndex: number,
  windowStart: number,
  windowEnd: number
): TimelineEvent[] {
  const eventsRaw = Array.isArray(raw.events) ? raw.events : []
  const events: TimelineEvent[] = []
  for (const item of eventsRaw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    let start = roundTs(Number(rec.startTime))
    let end = roundTs(Number(rec.endTime))
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    if (end < start) {
      const swap = start
      start = end
      end = swap
    }
    if (start < windowStart - 1.5 || start > windowEnd + 1.5) continue
    start = Math.max(windowStart, start)
    end = Math.min(windowEnd, Math.max(start + 0.2, end))
    const event = String(rec.event || '').trim().slice(0, 400)
    if (!event) continue
    const confidence = clampConfidence(rec.confidence)
    if (confidence < 0.45) continue
    events.push({
      id: randomUUID(),
      startTime: start,
      endTime: end,
      event,
      visibleElements: asStringArray(rec.visibleElements),
      actions: asStringArray(rec.actions),
      ocr: asStringArray(rec.ocr),
      entities: asStringArray(rec.entities),
      quantities: asStringArray(rec.quantities),
      uiState: asStringArray(rec.uiState),
      dialogue: asStringArray(rec.dialogue),
      evidence: asStringArray(rec.evidence).length
        ? asStringArray(rec.evidence)
        : [event],
      confidence,
      chunkIndex,
    })
  }
  return events
}

export function mergeTimelineEvents(existing: TimelineEvent[], incoming: TimelineEvent[]): TimelineEvent[] {
  const merged = [...existing]
  for (const event of incoming) {
    const dup = merged.find(
      (row) =>
        Math.abs(row.startTime - event.startTime) < 3 &&
        row.event.toLowerCase().slice(0, 48) === event.event.toLowerCase().slice(0, 48)
    )
    if (dup) {
      if (event.confidence > dup.confidence) {
        Object.assign(dup, event, { id: dup.id })
      }
      continue
    }
    merged.push(event)
  }
  merged.sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime)
  return merged
}

export async function analyzeVideoChunk(params: {
  fileKey: string
  mimeType: string
  prompt: string
  startTime: number
  endTime: number
  durationSeconds: number
  chunkIndex: number
}): Promise<TimelineEvent[]> {
  const apiKey = narrateMeGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const readUrl = await generatePresignedReadUrl(params.fileKey, 7200)
  if (!readUrl) throw new Error('Could not create a video read URL for analysis')

  const mime = params.mimeType.startsWith('video/') ? params.mimeType : 'video/mp4'
  const model = narrateMeGeminiModel()
  const genAI = new GoogleGenAI({ apiKey })
  const prompt = buildChunkPrompt({
    prompt: params.prompt,
    startTime: params.startTime,
    endTime: params.endTime,
    durationSeconds: params.durationSeconds,
  })

  const filePart = {
    fileData: { fileUri: readUrl, mimeType: mime },
    videoMetadata: {
      startOffset: `${Math.max(0, Math.floor(params.startTime))}s`,
      endOffset: `${Math.max(1, Math.ceil(params.endTime))}s`,
    },
  }

  const run = async (withMeta: boolean) => {
    const parts = withMeta
      ? [filePart, { text: prompt }]
      : [{ fileData: { fileUri: readUrl, mimeType: mime } }, { text: prompt }]
    return genAI.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.15,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    })
  }

  let response
  try {
    response = await run(true)
  } catch {
    response = await run(false)
  }

  const raw = geminiText(response as { text?: string })
  const parsed = parseJsonObject(raw)
  if (!parsed) return []
  return parseTimelineEvents(parsed, params.chunkIndex, params.startTime, params.endTime)
}

export { analysisWindows, geminiText, parseJsonObject }
