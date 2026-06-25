import { NextResponse } from 'next/server'
import { clipEditorTierPublicSummary, clipEditorTierConfig } from '@/lib/clip-editor/tier'

export const dynamic = 'force-dynamic'

/** Public clip-editor tier from CLIP_EDITOR_QUALITY_TIER (no auth). */
export async function GET() {
  const config = clipEditorTierConfig()
  return NextResponse.json({
    ...clipEditorTierPublicSummary(config),
    renderResolution: config.renderResolution,
    renderCutPreview: config.renderCutPreview,
    richCaptions: config.richCaptions,
    useGeminiVideoAnalysis: config.useGeminiVideoAnalysis,
  })
}
