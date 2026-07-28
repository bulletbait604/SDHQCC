import { putBufferToR2 } from '@/lib/r2'
import {
  getClipEditorJob,
  updateClipEditorJobPasses,
  updateClipEditorJobState,
  markClipEditorJobComplete,
} from '@/lib/clip-editor/jobs'
import { scheduleClipEditorStep } from '@/lib/clip-editor/dispatch'
import type { ClipEditorJobDocument } from '@/lib/clip-editor/types'
import {
  getReapProjectClips,
  getReapProjectStatus,
  isReapSuccessStatus,
  isReapTerminalStatus,
  pickBestReapClip,
  reapClipPlaybackUrl,
  reapClipsToViralSegments,
  startReapViralProject,
  type ReapGenre,
} from '@/lib/clip-editor/services/reap'
import { generatePresignedReadUrl } from '@/lib/r2'
import { viralityReviewSchema } from '@/lib/clip-editor/schemas'
import { updateVideoStatusForJob, markSelectedClipComplete } from '@/lib/clip-editor/clipStore'

export type AdvanceStepResult = {
  done: boolean
  rescheduled: boolean
  state: ClipEditorJobDocument['state']
  phasePaused?: boolean
}

async function refreshSourceUrl(r2FileKey: string): Promise<string> {
  const url = await generatePresignedReadUrl(r2FileKey, 86400)
  if (!url) throw new Error('Could not refresh R2 read URL for clip')
  return url
}

function reapOptionsFromJob(job: ClipEditorJobDocument) {
  return {
    platform: job.platform,
    layoutTemplate: job.layoutTemplate,
    landscapeMode: job.landscapeMode,
    genre: job.reapGenre as ReapGenre | undefined,
    captionsPreset: job.reapCaptionsPreset,
    enableEmojis: job.reapEnableEmojis,
    enableHighlights: job.reapEnableHighlights,
    prompt: job.reapPrompt,
    durationSeconds: job.sourceDurationSeconds,
    fileName: undefined as string | undefined,
    mimeType: job.mimeType,
  }
}

async function storeReapOutputToR2(
  job: ClipEditorJobDocument,
  clipUrl: string,
  kind: 'cut-preview' | 'final'
): Promise<{ outputUrl: string; outputR2Key: string }> {
  const res = await fetch(clipUrl)
  if (!res.ok) throw new Error(`Could not download Reap clip (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const suffix = kind === 'cut-preview' ? 'reap-cut-preview' : 'reap-final'
  const outputR2Key = `uploads/clips/${job.username}/${Date.now()}-${suffix}.mp4`
  const wrote = await putBufferToR2(outputR2Key, buffer, 'video/mp4')
  if (!wrote) throw new Error('Failed to store Reap clip on R2')
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '')
  const outputUrl = publicBase ? `${publicBase}/${outputR2Key}` : clipUrl
  return { outputUrl, outputR2Key }
}

async function applyCompletedClips(
  jobId: string,
  job: ClipEditorJobDocument,
  projectId: string,
  asCutPreview: boolean
): Promise<{ bestUrl: string; bestId: string }> {
  const clipsRes = await getReapProjectClips(projectId)
  const clips = clipsRes.clips || []
  const best = pickBestReapClip(clips)
  const bestUrl = reapClipPlaybackUrl(best)
  if (!bestUrl || !best?.id) {
    throw new Error('Reap project completed but no downloadable clips were returned')
  }

  const viralSegments = reapClipsToViralSegments(clips)
  const topScore = Math.max(1, Math.min(100, Math.round((Number(best.viralityScore) || 7) * 10)))

  const viralityCut = viralityReviewSchema.parse({
    phase: 'cut',
    viralityScore: topScore,
    platformFitScore: topScore,
    summary:
      best.caption ||
      best.title ||
      `Reap generated ${clips.length} viral-ready clip${clips.length === 1 ? '' : 's'} with captions, reframing, and pacing.`,
    strengths: [
      'AI virality scoring',
      'Animated captions with highlights',
      'AI clip selection & pacing',
      ...(best.enableEmojis ? ['Emoji-enhanced captions'] : []),
    ].slice(0, 8),
    risks: clips.length === 0 ? ['No clips returned'] : [],
    promptHints: 'Prefer punchy hooks and platform-native pacing.',
    recommendedAdjustments: [],
  })

  await updateClipEditorJobPasses(jobId, {
    viralityCut,
    geminiVideo: {
      hookTitle: best.title || 'Viral clip',
      hookPlan: best.caption || 'Reap viral edit',
      primaryWindow: {
        start: Number(best.startTime) || 0,
        end: Number(best.endTime) || Number(best.duration) || job.sourceDurationSeconds || 30,
        confidence: 0.9,
        reason: 'Selected by Reap virality score',
      },
      viralSegments: viralSegments.length
        ? viralSegments
        : [
            {
              start: Number(best.startTime) || 0,
              end: Number(best.endTime) || 30,
              title: best.title || 'Viral clip',
              explanation: best.caption || 'Reap AI pick',
              viralityScore: topScore,
            },
          ],
      layoutTemplate: job.layoutTemplate,
    },
    metadata: {
      tiktok: {
        caption: best.caption || best.title || 'Viral clip',
        hashtags: ['#fyp', '#viral', '#clip'],
      },
      youtube: {
        title: best.title || 'Viral Short',
        description: best.caption || '',
        tags: ['shorts', 'viral', 'clip'],
      },
      instagram: {
        caption: best.caption || best.title || 'Viral clip',
        hashtags: ['#reels', '#viral'],
      },
      engagementScore: topScore,
    },
  })

  if (asCutPreview) {
    const stored = await storeReapOutputToR2(job, bestUrl, 'cut-preview')
    await updateClipEditorJobState(jobId, 'CUT_PHASE_DONE', {
      cutPreviewUrl: stored.outputUrl,
      cutPreviewR2Key: stored.outputR2Key,
      reapProjectId: projectId,
    })
    return { bestUrl: stored.outputUrl, bestId: best.id }
  }

  return { bestUrl, bestId: best.id }
}

/**
 * Reap-backed cut/finish pipeline using existing job states.
 * Cut: upload → Reap viral project → poll → cut preview
 * Finish: re-host best clip as final output
 */
export async function advanceReapClipEditorStep(jobId: string): Promise<AdvanceStepResult> {
  const job = await getClipEditorJob(jobId)
  if (!job) throw new Error(`Clip editor job not found: ${jobId}`)
  if (job.state === 'COMPLETE') return { done: true, rescheduled: false, state: 'COMPLETE' }
  if (job.state === 'FAILED') return { done: true, rescheduled: false, state: 'FAILED' }
  if (job.state === 'CUT_PHASE_DONE') {
    return { done: false, rescheduled: false, state: 'CUT_PHASE_DONE', phasePaused: true }
  }

  const sourceReadUrl = await refreshSourceUrl(job.r2FileKey)

  switch (job.state) {
    case 'UPLOADED':
    case 'TRANSCRIBING':
    case 'VIDEO_ANALYSIS':
    case 'HOOK_ANALYSIS':
    case 'RETENTION_ANALYSIS':
    case 'CUT_RANKING':
    case 'REFRAMING':
    case 'VIRALITY_CUT':
    case 'RENDERING_CUT_PREVIEW': {
      if (!job.reapProjectId) {
        await updateClipEditorJobState(jobId, 'RENDERING_CUT_PREVIEW')
        const started = await startReapViralProject(sourceReadUrl, reapOptionsFromJob(job))
        await updateClipEditorJobState(jobId, 'RENDERING_CUT_PREVIEW', {
          reapProjectId: started.projectId,
          reapUploadId: started.uploadId,
          reapMode: started.mode,
          reapStage: 'primary',
        })
        await scheduleClipEditorStep(jobId, 8)
        return { done: false, rescheduled: true, state: 'RENDERING_CUT_PREVIEW' }
      }

      const status = await getReapProjectStatus(job.reapProjectId)
      if (!isReapTerminalStatus(status.status)) {
        await scheduleClipEditorStep(jobId, 8)
        return { done: false, rescheduled: true, state: 'RENDERING_CUT_PREVIEW' }
      }
      if (!isReapSuccessStatus(status.status)) {
        throw new Error(`Reap project ${status.status}: ${job.reapProjectId}`)
      }

      await applyCompletedClips(jobId, job, job.reapProjectId, true)
      await updateVideoStatusForJob(jobId, 'CUT_PHASE_DONE').catch(() => undefined)
      return { done: false, rescheduled: false, state: 'CUT_PHASE_DONE', phasePaused: true }
    }

    case 'PACING':
    case 'BROLL_PLANNING':
    case 'VIRALITY_EFFECTS':
    case 'RENDERING_EFFECTS_PREVIEW':
    case 'EFFECTS_PHASE_DONE':
    case 'TEXT_TRANSCRIBING':
    case 'CAPTIONING':
    case 'EDIT_PLAN':
    case 'RENDERING': {
      // Finish: Reap already delivered viral edit — promote cut preview / best clip to final
      const preview = job.cutPreviewUrl
      const projectId = job.reapProjectId
      let finalUrl = preview
      let bestId = projectId || job._id

      if (projectId) {
        const clipsRes = await getReapProjectClips(projectId)
        const best = pickBestReapClip(clipsRes.clips)
        const url = reapClipPlaybackUrl(best)
        if (url) {
          finalUrl = url
          bestId = best?.id || bestId
        }
      }
      if (!finalUrl) throw new Error('No Reap cut preview available to finalize')

      const stored = await storeReapOutputToR2(job, finalUrl, 'final')
      const viralityText = viralityReviewSchema.parse({
        phase: 'text',
        viralityScore: job.passes.viralityCut?.viralityScore ?? 80,
        platformFitScore: job.passes.viralityCut?.platformFitScore ?? 80,
        summary:
          'Finalized Reap viral edit with captions, keyword highlights, and platform-ready export.',
        strengths: job.passes.viralityCut?.strengths || ['Reap viral pipeline'],
        risks: [],
        promptHints: '',
        recommendedAdjustments: [],
      })
      await updateClipEditorJobPasses(jobId, {
        viralityText,
        viralityEffects: viralityReviewSchema.parse({
          phase: 'effects',
          viralityScore: job.passes.viralityCut?.viralityScore ?? 80,
          platformFitScore: job.passes.viralityCut?.platformFitScore ?? 80,
          summary: 'Reap applied AI clip selection, pacing cuts, and caption styling for viral retention.',
          strengths: ['AI clipping', 'Caption presets', 'Virality ranking'],
          risks: [],
          promptHints: '',
          recommendedAdjustments: [],
        }),
      })

      await markClipEditorJobComplete(jobId, {
        outputUrl: stored.outputUrl,
        outputR2Key: stored.outputR2Key,
      })
      await updateVideoStatusForJob(jobId, 'COMPLETE')
      await markSelectedClipComplete({
        jobId,
        shotstackJobId: `reap:${bestId}`,
        finalVideoUrl: stored.outputUrl,
        finalR2Key: stored.outputR2Key,
      }).catch(() => undefined)

      return { done: true, rescheduled: false, state: 'COMPLETE' }
    }

    default:
      throw new Error(`Unhandled Reap job state: ${job.state}`)
  }
}

/** Called from webhook when a Reap project reaches a terminal state. */
export async function handleReapProjectWebhook(payload: {
  projectId?: string
  status?: string
}): Promise<{ ok: boolean; matched?: boolean; jobId?: string }> {
  const projectId = payload.projectId?.trim()
  if (!projectId || projectId === '000000000000000000000000') {
    // Dashboard test payload — accept silently
    return { ok: true, matched: false }
  }
  if (!isReapTerminalStatus(payload.status)) {
    return { ok: true, matched: false }
  }

  const clientPromise = (await import('@/lib/mongodb')).default
  const col = (await clientPromise).db('sdhq').collection('clipEditorJobs')
  const row = await col.findOne({
    $or: [{ reapProjectId: projectId }, { reapReframeProjectId: projectId }],
  })
  if (!row) return { ok: true, matched: false }

  const jobId = String(row._id)
  // Kick the step runner — it will poll status / finalize
  await scheduleClipEditorStep(jobId, 1)
  return { ok: true, matched: true, jobId }
}
