import { buildShotstackPackageFromEditPlan } from '@/lib/clip-editor/editPlanToShotstack'
import { submitShotstackRender } from '@/lib/clip-editor/services/shotstack'
import { putBufferToR2 } from '@/lib/r2'
import type { ClipEditorJobDocument } from '@/lib/clip-editor/types'

export async function submitShotstackRenderPass(
  job: ClipEditorJobDocument
): Promise<{ renderId: string }> {
  const transcript = job.passes.transcript
  const editPlan = job.passes.finalEditPlan
  if (!transcript || !editPlan) {
    throw new Error('Missing transcript or final edit plan before render')
  }

  const payload = buildShotstackPackageFromEditPlan({
    sourceUrl: job.sourceReadUrl,
    platform: job.platform,
    editPlan,
    transcript,
    sourceDurationSeconds: job.sourceDurationSeconds,
  })

  const renderId = await submitShotstackRender(payload)
  return { renderId }
}

export async function finalizeShotstackOutput(
  job: ClipEditorJobDocument,
  shotstackUrl: string
): Promise<{ outputUrl: string; outputR2Key: string }> {
  const res = await fetch(shotstackUrl)
  if (!res.ok) throw new Error(`Could not download Shotstack output (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const outputR2Key = `uploads/clips/${job.username}/${Date.now()}-opus-render.mp4`
  const wrote = await putBufferToR2(outputR2Key, buffer, 'video/mp4')
  if (!wrote) throw new Error('Failed to store rendered clip on R2')

  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '')
  const outputUrl = publicBase ? `${publicBase}/${outputR2Key}` : shotstackUrl

  return { outputUrl, outputR2Key }
}
