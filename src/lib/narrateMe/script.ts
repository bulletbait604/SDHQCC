import { randomUUID } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { hashNarrationText, narrateMeGeminiApiKey, narrateMeGeminiModel, roundTs } from '@/lib/narrateMe/config'
import { geminiText, parseJsonObject } from '@/lib/narrateMe/gemini'
import type { NarrationSegment, TimelineEvent } from '@/lib/narrateMe/types'

function asSegments(raw: Record<string, unknown>, timeline: TimelineEvent[]): NarrationSegment[] {
  const list = Array.isArray(raw.segments) ? raw.segments : []
  const byId = new Map(timeline.map((e) => [e.id, e]))
  const out: NarrationSegment[] = []

  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const text = String(rec.text || '').trim().slice(0, 800)
    if (!text) continue
    const eventId = String(rec.eventId || '')
    const matched = byId.get(eventId)
    let sourceStart = roundTs(Number(rec.sourceStart))
    let sourceEnd = roundTs(Number(rec.sourceEnd))
    if (matched) {
      sourceStart = matched.startTime
      sourceEnd = matched.endTime
    }
    if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd) || sourceEnd <= sourceStart) {
      continue
    }
    const evidence = Array.isArray(rec.evidence)
      ? rec.evidence.filter((e): e is string => typeof e === 'string').slice(0, 8)
      : matched?.evidence || []
    out.push({
      id: randomUUID(),
      sourceStart,
      sourceEnd,
      text,
      eventId: matched?.id || eventId,
      confidence: Math.min(1, Math.max(0, Number(rec.confidence) || matched?.confidence || 0.7)),
      evidence,
      textHash: hashNarrationText(text),
      version: 1,
    })
  }

  if (out.length === 0) {
    for (const event of timeline) {
      if (event.confidence < 0.6) continue
      const text = event.event.trim()
      if (!text) continue
      out.push({
        id: randomUUID(),
        sourceStart: event.startTime,
        sourceEnd: event.endTime,
        text,
        eventId: event.id,
        confidence: event.confidence,
        evidence: event.evidence,
        textHash: hashNarrationText(text),
        version: 1,
      })
    }
  }

  out.sort((a, b) => a.sourceStart - b.sourceStart)
  return out
}

function timelineBrief(timeline: TimelineEvent[]): string {
  return timeline
    .map((e) => {
      const ocr = e.ocr.length ? ` OCR:${e.ocr.join(' | ')}` : ''
      const qty = e.quantities.length ? ` qty:${e.quantities.join(', ')}` : ''
      return `[${e.startTime.toFixed(1)}-${e.endTime.toFixed(1)} id=${e.id} c=${e.confidence.toFixed(2)}] ${e.event}
  seen: ${e.visibleElements.join(', ') || 'n/a'}
  actions: ${e.actions.join(', ') || 'n/a'}
  evidence: ${e.evidence.join('; ') || 'n/a'}${ocr}${qty}
  ui: ${e.uiState.join(', ') || 'n/a'}
  dialogue: ${e.dialogue.join(' | ') || 'none'}`
    })
    .join('\n')
}

export async function generateNarrationScript(params: {
  prompt: string
  timeline: TimelineEvent[]
}): Promise<NarrationSegment[]> {
  if (params.timeline.length === 0) return []
  const apiKey = narrateMeGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const model = narrateMeGeminiModel()
  const genAI = new GoogleGenAI({ apiKey })
  const prompt = `Write timestamped narration for a gameplay/research video.

Creator prompt (what to emphasize — not a license to invent facts):
"""
${params.prompt.replace(/"""/g, '"').slice(0, 2000)}
"""

Verified timeline from the actual video. Only narrate these events. Do not add mechanics, names, quantities, menus, or lore that are not in the evidence.

${timelineBrief(params.timeline).slice(0, 24000)}

Return ONLY JSON:
{
  "segments": [
    {
      "eventId": "copy the timeline id",
      "sourceStart": 421.2,
      "sourceEnd": 438.7,
      "text": "Here we open the Pal Researching Lab.",
      "confidence": 0.97,
      "evidence": ["Researching Lab UI visible"]
    }
  ]
}

Rules:
- Follow the exact sequence in the timeline.
- sourceStart/sourceEnd must match the event times.
- Speak as a calm researcher/narrator in present tense.
- If confidence is low, qualify ("a menu labeled … appears") instead of naming unknowns.
- Skip events that cannot be narrated without guessing.
- Do not mention timestamps out loud unless the UI shows a timer.
- One segment per meaningful event. Keep each line 1–3 sentences.`

  const response = await genAI.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.25,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  })
  const parsed = parseJsonObject(geminiText(response as { text?: string }))
  if (!parsed) throw new Error('Could not write narration from the timeline.')
  return asSegments(parsed, params.timeline)
}

export async function regenerateNarrationSegment(params: {
  prompt: string
  segment: NarrationSegment
  event?: TimelineEvent
}): Promise<string> {
  const apiKey = narrateMeGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API is not configured')
  const event = params.event
  const evidence = event
    ? `Event: ${event.event}
Visible: ${event.visibleElements.join(', ') || 'n/a'}
Actions: ${event.actions.join(', ') || 'n/a'}
OCR: ${event.ocr.join(' | ') || 'none'}
Evidence: ${event.evidence.join('; ')}
Dialogue: ${event.dialogue.join(' | ') || 'none'}`
    : `Evidence: ${params.segment.evidence.join('; ') || 'none'}`

  const genAI = new GoogleGenAI({ apiKey: apiKey })
  const response = await genAI.models.generateContent({
    model: narrateMeGeminiModel(),
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Rewrite this one narration line. Do not invent facts.

Creator prompt:
${params.prompt.slice(0, 1500)}

${evidence}

Current text:
${params.segment.text}

Return ONLY JSON: {"text":"..."}`,
          },
        ],
      },
    ],
    config: { temperature: 0.3, maxOutputTokens: 400, responseMimeType: 'application/json' },
  })
  const parsed = parseJsonObject(geminiText(response as { text?: string }))
  const text = String(parsed?.text || '').trim().slice(0, 800)
  if (!text) throw new Error('Could not regenerate that line.')
  return text
}
