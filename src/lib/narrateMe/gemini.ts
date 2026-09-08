import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { extractBalancedJsonObject } from '@/lib/algorithmPlatformNormalize'
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
  clipRelative: boolean
}): string {
  const window = `${params.startTime.toFixed(1)}–${params.endTime.toFixed(1)}`
  const timing = params.clipRelative
    ? `The attached file is an 8-minute CLIP of the original.
Original video duration: ${params.durationSeconds.toFixed(1)}s.
This clip is original time ${window}. The first frame of THIS file is clip time 0.0.
Report startTime/endTime in seconds from the START OF THIS CLIP (0 = first frame).
Example: a moment 12.4s into this clip → startTime 12.4, even if that is original time ${(params.startTime + 12.4).toFixed(1)}.`
    : `Source video duration: ${params.durationSeconds.toFixed(1)}s
Analyze ONLY timestamps ${params.startTime.toFixed(1)}s through ${params.endTime.toFixed(1)}s.
Use the actual video timeline. Do not invent timestamps.`

  const exampleStart = params.clipRelative ? 12.4 : 421.2
  const exampleEnd = params.clipRelative ? 18.1 : 438.7
  const timeRule = params.clipRelative
    ? `- startTime/endTime must fall inside 0.0–${(params.endTime - params.startTime).toFixed(1)} (clip time).`
    : `- startTime/endTime must fall inside ${window}.`

  return `You are a forensic video analyst. Watch ONLY this span of video.

${timing}

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
      "startTime": ${exampleStart},
      "endTime": ${exampleEnd},
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
${timeRule}
- Only include meaningful events (UI opens, selections, visible requirements, player actions, spoken lines that are actually heard).
- evidence must describe what was seen or heard, not guesses.
- If this span has no confident events, return {"events":[]}.`
}

export function shiftTimelineEvents(events: TimelineEvent[], offsetSeconds: number): TimelineEvent[] {
  if (!offsetSeconds) return events
  return events.map((event) => ({
    ...event,
    startTime: roundTs(event.startTime + offsetSeconds),
    endTime: roundTs(event.endTime + offsetSeconds),
  }))
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
  fileUri: string
  mimeType: string
  prompt: string
  startTime: number
  endTime: number
  durationSeconds: number
  chunkIndex: number
  clipRelative?: boolean
}): Promise<TimelineEvent[]> {
  const apiKey = narrateMeGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')
  if (!params.fileUri.startsWith('https://generativelanguage.googleapis.com/')) {
    throw new Error('Video analysis needs a Gemini Files API URI, not a storage URL.')
  }

  const clipRelative = Boolean(params.clipRelative)
  const mime = params.mimeType.startsWith('video/') ? params.mimeType : 'video/mp4'
  const model = narrateMeGeminiModel()
  const genAI = new GoogleGenAI({ apiKey })
  const prompt = buildChunkPrompt({
    prompt: params.prompt,
    startTime: params.startTime,
    endTime: params.endTime,
    durationSeconds: params.durationSeconds,
    clipRelative,
  })

  const fileData = { fileUri: params.fileUri, mimeType: mime }
  const filePart = clipRelative
    ? { fileData }
    : {
        fileData,
        videoMetadata: {
          startOffset: `${Math.max(0, Math.floor(params.startTime))}s`,
          endOffset: `${Math.max(1, Math.ceil(params.endTime))}s`,
        },
      }

  const run = async (withMeta: boolean) => {
    const parts =
      withMeta && !clipRelative
        ? [filePart, { text: prompt }]
        : [{ fileData }, { text: prompt }]
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
    response = await run(!clipRelative)
  } catch {
    response = await run(false)
  }

  const raw = geminiText(response as { text?: string })
  const parsed = parseJsonObject(raw)
  if (!parsed) return []
  const parseStart = clipRelative ? 0 : params.startTime
  const parseEnd = clipRelative
    ? Math.max(0.5, params.endTime - params.startTime)
    : params.endTime
  const events = parseTimelineEvents(parsed, params.chunkIndex, parseStart, parseEnd)
  return clipRelative ? shiftTimelineEvents(events, params.startTime) : events
}

export { analysisWindows, geminiText, parseJsonObject }
