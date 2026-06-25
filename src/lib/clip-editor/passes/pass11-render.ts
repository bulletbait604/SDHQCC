import { buildShotstackPackageFromEditPlan } from '@/lib/clip-editor/editPlanToShotstack'
import { submitShotstackRender } from '@/lib/clip-editor/services/shotstack'
import { putBufferToR2 } from '@/lib/r2'
import {
  readResolvedSegmentsFromShotstack,
  uploadClipEditorCaptionVtt,
} from '@/lib/clip-editor/vttCaptions'
import type { ClipEditorTierConfig } from '@/lib/clip-editor/tier'
import { clipEditorTierConfig } from '@/lib/clip-editor/tier'
import type { ClipEditorJobDocument, FinalEditPlan } from '@/lib/clip-editor/types'

export type ShotstackOutputKind = 'cut-preview' | 'effects-preview' | 'final'

function applyRenderResolution(
  output: Record<string, unknown>,
  resolution: ClipEditorTierConfig['renderResolution']
): Record<string, unknown> {
  return {
    ...output,
    resolution,
    quality: resolution === '720' ? 'medium' : 'high',
  }
}

export async function submitShotstackRenderForEditPlan(
  job: ClipEditorJobDocument,
  editPlan: FinalEditPlan,
  options?: { richCaptions?: boolean; tier?: ClipEditorTierConfig }
): Promise<{ renderId: string }> {
  const tier = options?.tier ?? clipEditorTierConfig()
  const transcript = job.passes.transcript
  if (!transcript) {
    throw new Error('Missing transcript before render')
  }

  const useRichCaptions = options?.richCaptions ?? (tier.richCaptions && editPlan.captions.length > 0)

  let payload = buildShotstackPackageFromEditPlan({
    sourceUrl: job.sourceReadUrl,
    platform: job.platform,
    editPlan,
    transcript,
    geminiVideo: job.passes.geminiVideo,
    sourceDurationSeconds: job.sourceDurationSeconds,
  })

  payload = {
    ...payload,
    output: applyRenderResolution(
      payload.output && typeof payload.output === 'object'
        ? (payload.output as Record<string, unknown>)
        : {},
      tier.renderResolution
    ),
  }

  if (useRichCaptions) {
    const segments = readResolvedSegmentsFromShotstack({
      metadata: payload.metadata,
      timeline: payload.timeline,
    })
    const richCaptionUrl = await uploadClipEditorCaptionVtt({
      username: job.username,
      words: transcript.words,
      segments,
    })
    if (richCaptionUrl) {
      payload = buildShotstackPackageFromEditPlan({
        sourceUrl: job.sourceReadUrl,
        platform: job.platform,
        editPlan,
        transcript,
        geminiVideo: job.passes.geminiVideo,
        sourceDurationSeconds: job.sourceDurationSeconds,
        richCaptionUrl,
      })
      payload = {
        ...payload,
        output: applyRenderResolution(
          payload.output && typeof payload.output === 'object'
            ? (payload.output as Record<string, unknown>)
            : {},
          tier.renderResolution
        ),
      }
    }
  }

  const renderId = await submitShotstackRender({
    timeline: payload.timeline,
    output: payload.output,
  })
  return { renderId }
}

/** Final render (text pass) — uses full edit plan + karaoke captions when tier allows. */
export async function submitShotstackRenderPass(
  job: ClipEditorJobDocument,
  tier: ClipEditorTierConfig = clipEditorTierConfig()
): Promise<{ renderId: string }> {
  const editPlan = job.passes.finalEditPlan
  if (!editPlan) {
    throw new Error('Missing final edit plan before render')
  }
  return submitShotstackRenderForEditPlan(job, editPlan, {
    richCaptions: tier.richCaptions,
    tier,
  })
}

export async function finalizeShotstackOutput(
  job: ClipEditorJobDocument,
  shotstackUrl: string,
  kind: ShotstackOutputKind = 'final'
): Promise<{ outputUrl: string; outputR2Key: string }> {
  const res = await fetch(shotstackUrl)
  if (!res.ok) throw new Error(`Could not download Shotstack output (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const suffix =
    kind === 'cut-preview'
      ? 'cut-preview'
      : kind === 'effects-preview'
        ? 'effects-preview'
        : 'final-render'
  const outputR2Key = `uploads/clips/${job.username}/${Date.now()}-${suffix}.mp4`
  const wrote = await putBufferToR2(outputR2Key, buffer, 'video/mp4')
  if (!wrote) throw new Error('Failed to store rendered clip on R2')

  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '')
  const outputUrl = publicBase ? `${publicBase}/${outputR2Key}` : shotstackUrl

  return { outputUrl, outputR2Key }
}
