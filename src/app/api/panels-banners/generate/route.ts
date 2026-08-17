import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { runPanelsBannersPipeline } from '@/lib/panelsBanners/generate'
import {
  getPanelsBannersPlatform,
  isPanelsBannersOutputMode,
  isPanelsBannersPlatformId,
  normalizePanelTitles,
  MAX_PANEL_TITLES,
} from '@/lib/panelsBanners/platforms'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_REFERENCES = 3
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_PROMPT_CHARS = 2000

type IncomingRef = {
  base64?: string
  mimeType?: string
}

function normalizeRef(raw: IncomingRef): { base64: string; mimeType: string } | null {
  if (typeof raw?.base64 !== 'string' || !raw.base64.trim()) return null
  const base64 = raw.base64.replace(/^data:[^;]+;base64,/, '').trim()
  if (!base64) return null
  // rough size check from base64 length
  const approxBytes = Math.floor((base64.length * 3) / 4)
  if (approxBytes > MAX_IMAGE_BYTES) return null
  const mimeType =
    typeof raw.mimeType === 'string' && raw.mimeType.startsWith('image/')
      ? raw.mimeType
      : 'image/jpeg'
  return { base64, mimeType }
}

/** Owner-only R&D: research platform banner/panel sizes, then paint 2 mockups via Gemini. */
export async function POST(req: NextRequest) {
  try {
    await verifyOwnerUser(req)

    const body = await req.json()
    const {
      platformId,
      outputMode,
      prompt,
      references,
      panelTitles: panelTitlesRaw,
    } = body as {
      platformId?: string
      outputMode?: string
      prompt?: string
      references?: IncomingRef[]
      panelTitles?: unknown
    }

    if (!platformId || !isPanelsBannersPlatformId(platformId)) {
      return NextResponse.json({ error: 'Choose a valid streaming platform.' }, { status: 400 })
    }
    if (!outputMode || !isPanelsBannersOutputMode(outputMode)) {
      return NextResponse.json(
        { error: 'Choose banner, panels, or both.' },
        { status: 400 }
      )
    }

    const platform = getPanelsBannersPlatform(platformId)
    if (!platform) {
      return NextResponse.json({ error: 'Unknown platform.' }, { status: 400 })
    }

    const needPanels = outputMode === 'panels' || outputMode === 'both'
    const panelTitles = normalizePanelTitles(panelTitlesRaw)
    if (needPanels && panelTitles.length === 0) {
      return NextResponse.json(
        { error: `Select at least one panel title (up to ${MAX_PANEL_TITLES}).` },
        { status: 400 }
      )
    }

    const userPrompt = typeof prompt === 'string' ? prompt.trim().slice(0, MAX_PROMPT_CHARS) : ''
    const refsIn = Array.isArray(references) ? references.slice(0, MAX_REFERENCES) : []
    const refs = refsIn.map(normalizeRef).filter(Boolean) as {
      base64: string
      mimeType: string
    }[]

    if (refs.length === 0) {
      return NextResponse.json(
        { error: 'Upload 1–3 reference images.' },
        { status: 400 }
      )
    }

    const result = await runPanelsBannersPipeline({
      platform,
      outputMode,
      userPrompt,
      references: refs,
      panelTitles: needPanels ? panelTitles : [],
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[panels-banners]', err)
    const message = err instanceof Error ? err.message : 'P&B generation failed'
    return NextResponse.json(
      {
        error: message,
        userMessage: 'Could not generate panels/banners. Try again with clearer references.',
      },
      { status: 503 }
    )
  }
}
