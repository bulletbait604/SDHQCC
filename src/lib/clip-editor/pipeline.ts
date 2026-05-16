import { generatePresignedReadUrl } from '@/lib/r2'
import {
  getClipEditorJob,
  markClipEditorJobComplete,
  markClipEditorJobFailed,
  updateClipEditorJobPasses,
  updateClipEditorJobState,
} from '@/lib/clip-editor/jobs'
import { scheduleClipEditorStep } from '@/lib/clip-editor/dispatch'
import type { ClipEditorJobState } from '@/lib/clip-editor/jobStates'
import { runTranscriptionPass } from '@/lib/clip-editor/services/deepgram'
import { runGeminiVideoAnalysisPass } from '@/lib/clip-editor/passes/pass01-geminiVideo'
import { runHookAnalysisPass } from '@/lib/clip-editor/passes/pass02-hooks'
import { runRetentionAnalysisPass } from '@/lib/clip-editor/passes/pass03-retention'
import { runCutRankingPass } from '@/lib/clip-editor/passes/pass04-cutRanking'
import { runPacingPass } from '@/lib/clip-editor/passes/pass05-pacing'
import { runReframingPass } from '@/lib/clip-editor/passes/pass06-reframing'
import { runCaptionIntelligencePass } from '@/lib/clip-editor/passes/pass07-captions'
import { runHookOverlayPass } from '@/lib/clip-editor/passes/pass08-hookOverlay'
import { runBrollPass } from '@/lib/clip-editor/passes/pass09-broll'
import { runFinalEditPlanPass } from '@/lib/clip-editor/passes/pass10-finalEditPlan'
import {
  finalizeShotstackOutput,
  submitShotstackRenderPass,
} from '@/lib/clip-editor/passes/pass11-render'
import { runMetadataPass } from '@/lib/clip-editor/passes/pass12-metadata'
import { pollShotstackRender } from '@/lib/clip-editor/services/shotstack'

async function refreshSourceUrl(r2FileKey: string): Promise<string> {
  const url = await generatePresignedReadUrl(r2FileKey, 86400)
  if (!url) throw new Error('Could not refresh R2 read URL for clip')
  return url
}

export type AdvanceStepResult = {
  done: boolean
  rescheduled: boolean
  state: ClipEditorJobState
}

/** Runs exactly one pipeline stage, then schedules the next via QStash (cloud — no local worker). */
export async function advanceClipEditorStep(jobId: string): Promise<AdvanceStepResult> {
  const job = await getClipEditorJob(jobId)
  if (!job) throw new Error(`Clip editor job not found: ${jobId}`)
  if (job.state === 'COMPLETE') {
    return { done: true, rescheduled: false, state: 'COMPLETE' }
  }
  if (job.state === 'FAILED') {
    return { done: true, rescheduled: false, state: 'FAILED' }
  }

  try {
    const sourceReadUrl = await refreshSourceUrl(job.r2FileKey)
    const jobWithUrl = { ...job, sourceReadUrl }

    switch (job.state) {
      case 'UPLOADED': {
        await updateClipEditorJobState(jobId, 'TRANSCRIBING')
        const transcript = await runTranscriptionPass(sourceReadUrl)
        await updateClipEditorJobPasses(jobId, { transcript })
        await updateClipEditorJobState(jobId, 'VIDEO_ANALYSIS')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'VIDEO_ANALYSIS' }
      }
      case 'TRANSCRIBING': {
        if (!job.passes.transcript) {
          const transcript = await runTranscriptionPass(sourceReadUrl)
          await updateClipEditorJobPasses(jobId, { transcript })
        }
        await updateClipEditorJobState(jobId, 'VIDEO_ANALYSIS')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'VIDEO_ANALYSIS' }
      }
      case 'VIDEO_ANALYSIS': {
        const transcript = job.passes.transcript
        if (!transcript) throw new Error('Missing transcript for video analysis')
        const geminiVideo = await runGeminiVideoAnalysisPass({
          sourceReadUrl,
          r2FileKey: job.r2FileKey,
          mimeType: job.mimeType,
          platform: job.platform,
          layoutTemplate: job.layoutTemplate,
          durationSeconds: transcript.durationSeconds,
          transcriptExcerpt: transcript.fullTranscript,
        })
        await updateClipEditorJobPasses(jobId, { geminiVideo })
        await updateClipEditorJobState(jobId, 'HOOK_ANALYSIS')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'HOOK_ANALYSIS' }
      }
      case 'HOOK_ANALYSIS': {
        const transcript = job.passes.transcript
        if (!transcript) throw new Error('Missing transcript')
        const hooks = await runHookAnalysisPass(transcript)
        await updateClipEditorJobPasses(jobId, { hooks })
        await updateClipEditorJobState(jobId, 'RETENTION_ANALYSIS')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'RETENTION_ANALYSIS' }
      }
      case 'RETENTION_ANALYSIS': {
        const transcript = job.passes.transcript
        if (!transcript) throw new Error('Missing transcript')
        const retention = await runRetentionAnalysisPass(transcript)
        await updateClipEditorJobPasses(jobId, { retention })
        await updateClipEditorJobState(jobId, 'CUT_RANKING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'CUT_RANKING' }
      }
      case 'CUT_RANKING': {
        const transcript = job.passes.transcript
        const hooks = job.passes.hooks
        const retention = job.passes.retention
        if (!transcript || !hooks || !retention) throw new Error('Missing analysis for cut ranking')
        const cutRanking = runCutRankingPass(transcript, hooks, retention)
        await updateClipEditorJobPasses(jobId, { cutRanking })
        await updateClipEditorJobState(jobId, 'PACING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'PACING' }
      }
      case 'PACING': {
        const transcript = job.passes.transcript
        const cutRanking = job.passes.cutRanking
        if (!transcript || !cutRanking) throw new Error('Missing data for pacing')
        const pacing = await runPacingPass(transcript, cutRanking, job.platform)
        await updateClipEditorJobPasses(jobId, { pacing })
        await updateClipEditorJobState(jobId, 'REFRAMING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'REFRAMING' }
      }
      case 'REFRAMING': {
        const transcript = job.passes.transcript
        if (!transcript) throw new Error('Missing transcript for reframing')
        const reframing = runReframingPass(transcript, job.layoutTemplate, job.landscapeMode)
        await updateClipEditorJobPasses(jobId, { reframing })
        await updateClipEditorJobState(jobId, 'CAPTIONING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'CAPTIONING' }
      }
      case 'CAPTIONING': {
        const transcript = job.passes.transcript
        const hooks = job.passes.hooks
        const retention = job.passes.retention
        if (!transcript || !hooks || !retention) throw new Error('Missing data for captioning')
        const captions = runCaptionIntelligencePass(transcript)
        const hookOverlay = await runHookOverlayPass(hooks)
        const broll = runBrollPass(transcript, retention)
        await updateClipEditorJobPasses(jobId, { captions, hookOverlay, broll })
        await updateClipEditorJobState(jobId, 'EDIT_PLAN')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'EDIT_PLAN' }
      }
      case 'EDIT_PLAN': {
        const cutRanking = job.passes.cutRanking
        const pacing = job.passes.pacing
        const captions = job.passes.captions
        const reframing = job.passes.reframing
        const hookOverlay = job.passes.hookOverlay
        const broll = job.passes.broll
        const transcript = job.passes.transcript
        if (!cutRanking || !pacing || !captions || !reframing || !hookOverlay || !broll || !transcript) {
          throw new Error('Missing pass outputs for final edit plan')
        }
        const finalEditPlan = runFinalEditPlanPass({
          ranking: cutRanking,
          pacing,
          captions,
          reframing,
          hookOverlay,
          broll,
          layoutTemplate: job.layoutTemplate,
          landscapeMode: job.landscapeMode,
          durationSeconds: transcript.durationSeconds,
          geminiVideo: job.passes.geminiVideo,
        })
        await updateClipEditorJobPasses(jobId, { finalEditPlan })
        await updateClipEditorJobState(jobId, 'RENDERING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'RENDERING' }
      }
      case 'RENDERING': {
        if (!job.shotstackRenderId) {
          const { renderId } = await submitShotstackRenderPass(jobWithUrl)
          await updateClipEditorJobState(jobId, 'RENDERING', { shotstackRenderId: renderId })
          await scheduleClipEditorStep(jobId, 5)
          return { done: false, rescheduled: true, state: 'RENDERING' }
        }

        const poll = await pollShotstackRender(job.shotstackRenderId)
        if (poll.failed) {
          throw new Error(`Shotstack render failed (${poll.status})`)
        }
        if (!poll.done || !poll.url) {
          await scheduleClipEditorStep(jobId, 5)
          return { done: false, rescheduled: true, state: 'RENDERING' }
        }

        const finalized = await finalizeShotstackOutput(jobWithUrl, poll.url)
        const transcript = job.passes.transcript
        const finalEditPlan = job.passes.finalEditPlan
        if (transcript && finalEditPlan) {
          const metadata = await runMetadataPass(transcript, finalEditPlan)
          await updateClipEditorJobPasses(jobId, { metadata })
        }

        await markClipEditorJobComplete(jobId, {
          outputUrl: finalized.outputUrl,
          outputR2Key: finalized.outputR2Key,
          shotstackRenderId: job.shotstackRenderId,
        })
        return { done: true, rescheduled: false, state: 'COMPLETE' }
      }
      default:
        throw new Error(`Unhandled job state: ${job.state}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clip editor step failed'
    await markClipEditorJobFailed(jobId, message)
    throw error
  }
}

/** @deprecated Use advanceClipEditorStep via QStash — kept for tests/scripts only */
export async function runClipEditorPipeline(jobId: string): Promise<void> {
  let guard = 0
  while (guard < 40) {
    const result = await advanceClipEditorStep(jobId)
    if (result.done) return
    guard += 1
  }
  throw new Error('Pipeline exceeded max inline steps')
}
