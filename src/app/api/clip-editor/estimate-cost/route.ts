import { NextRequest, NextResponse } from 'next/server'
import { estimateClipEditorCost } from '@/lib/clip-editor/estimateCost'

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
  return NextResponse.json(estimateClipEditorCost(durationSeconds))
}
