import { NextResponse } from 'next/server'
import { clipEditorTierPublicSummary, clipEditorTierConfig } from '@/lib/clip-editor/tier'
import { clipEditorRenderBackend } from '@/lib/vizard'
import { isReapConfigured } from '@/lib/clip-editor/services/reap'

export const dynamic = 'force-dynamic'

/** Public clip-editor tier from CLIP_EDITOR_QUALITY_TIER (no auth). */
export async function GET() {
  const config = clipEditorTierConfig()
  const renderBackend = clipEditorRenderBackend()
  return NextResponse.json({
    ...clipEditorTierPublicSummary(config),
    renderResolution: config.renderResolution,
    renderCutPreview: config.renderCutPreview,
    richCaptions: config.richCaptions,
    useGeminiVideoAnalysis: config.useGeminiVideoAnalysis,
    renderBackend,
    reapConfigured: isReapConfigured(),
    /** Max upload seconds: Reap long-form clipping allows up to 3h; local path stays short. */
    maxClipSeconds: renderBackend === 'reap' ? 1800 : 90,
  })
}
