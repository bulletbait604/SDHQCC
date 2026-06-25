import { NextRequest, NextResponse } from 'next/server'
import { estimateClipEditorCost } from '@/lib/clip-editor/estimateCost'
import { parseClipEditorQualityTier } from '@/lib/clip-editor/tier'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('durationSeconds') || '90'
  const durationSeconds = Number.parseFloat(raw)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 120) {
    return NextResponse.json(
      { error: 'durationSeconds must be between 1 and 120' },
      { status: 400 }
    )
  }
  const tierOverride = request.nextUrl.searchParams.get('tier')
  const tier = tierOverride ? parseClipEditorQualityTier(tierOverride) : undefined
  return NextResponse.json(estimateClipEditorCost(durationSeconds, tier))
}
