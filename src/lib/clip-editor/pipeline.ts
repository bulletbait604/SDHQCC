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
import { runCutPhaseEditPlanPass, runFinalEditPlanPass } from '@/lib/clip-editor/passes/phaseEditPlans'
import {
  finalizeShotstackOutput,
  submitShotstackRenderForEditPlan,
  submitShotstackRenderPass,
} from '@/lib/clip-editor/passes/pass11-render'
import { runMetadataPass } from '@/lib/clip-editor/passes/pass12-metadata'
import { runViralityReviewPass } from '@/lib/clip-editor/passes/passVirality'
import { pollShotstackRender } from '@/lib/clip-editor/services/shotstack'
import { formatUnknownError } from '@/lib/clip-editor/formatError'
import {
  buildHeuristicGeminiVideoPlan,
  buildHeuristicHookAnalysis,
  buildHeuristicRetentionAnalysis,
} from '@/lib/clip-editor/passes/heuristicAnalysis'
import { runRulesPacingPass } from '@/lib/clip-editor/passes/rulesPacing'
import { hookOverlayPlanSchema } from '@/lib/clip-editor/schemas'
import {
  clipEditorTierConfig,
  shouldRunViralityPhase,
} from '@/lib/clip-editor/tier'

async function refreshSourceUrl(r2FileKey: string): Promise<string> {
  const url = await generatePresignedReadUrl(r2FileKey, 86400)
  if (!url) throw new Error('Could not refresh R2 read URL for clip')
  return url
}

export type AdvanceStepResult = {
  done: boolean
  rescheduled: boolean
  state: ClipEditorJobState
  /** Pipeline paused waiting for user to start the next wizard step. */
  phasePaused?: boolean
}

/** Pipeline stops here until the user starts the Finish pass. */
const PHASE_PAUSE_STATES: ClipEditorJobState[] = ['CUT_PHASE_DONE']

/** Runs exactly one pipeline stage, then schedules the next via QStash unless a phase boundary is reached. */
export async function advanceClipEditorStep(jobId: string): Promise<AdvanceStepResult> {
  const job = await getClipEditorJob(jobId)
  if (!job) throw new Error(`Clip editor job not found: ${jobId}`)
  if (job.state === 'COMPLETE') {
    return { done: true, rescheduled: false, state: 'COMPLETE' }
  }
  if (job.state === 'FAILED') {
    return { done: true, rescheduled: false, state: 'FAILED' }
  }
  if (PHASE_PAUSE_STATES.includes(job.state)) {
    return { done: false, rescheduled: false, state: job.state, phasePaused: true }
  }

  try {
    const tier = clipEditorTierConfig()
    const sourceReadUrl = await refreshSourceUrl(job.r2FileKey)
    const jobWithUrl = { ...job, sourceReadUrl }

    switch (job.state) {
      case 'UPLOADED':
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

        const passPatch: {
          geminiVideo?: Awaited<ReturnType<typeof runGeminiVideoAnalysisPass>>
          hooks?: ReturnType<typeof buildHeuristicHookAnalysis>
          retention?: ReturnType<typeof buildHeuristicRetentionAnalysis>
        } = {}

        if (tier.useGeminiVideoAnalysis) {
          if (!job.passes.geminiVideo) {
            passPatch.geminiVideo = await runGeminiVideoAnalysisPass({
              sourceReadUrl,
              r2FileKey: job.r2FileKey,
              mimeType: job.mimeType,
              platform: job.platform,
              layoutTemplate: job.layoutTemplate,
              durationSeconds: transcript.durationSeconds,
              transcriptExcerpt: transcript.fullTranscript,
            })
          }
        } else if (!job.passes.geminiVideo) {
          passPatch.geminiVideo = buildHeuristicGeminiVideoPlan({
            transcript,
            platform: job.platform,
            layoutTemplate: job.layoutTemplate,
          })
        }

        if (!tier.useGeminiHookRetentionAnalysis) {
          if (!job.passes.hooks) {
            passPatch.hooks = buildHeuristicHookAnalysis(transcript)
          }
          if (!job.passes.retention) {
            passPatch.retention = buildHeuristicRetentionAnalysis(transcript)
          }
        }

        if (Object.keys(passPatch).length > 0) {
          await updateClipEditorJobPasses(jobId, passPatch)
        }

        const nextState = tier.useGeminiHookRetentionAnalysis ? 'HOOK_ANALYSIS' : 'CUT_RANKING'
        await updateClipEditorJobState(jobId, nextState)
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: nextState }
      }
      case 'HOOK_ANALYSIS': {
        const transcript = job.passes.transcript
        if (!transcript) throw new Error('Missing transcript')
        if (!tier.useGeminiHookRetentionAnalysis) {
          await updateClipEditorJobState(jobId, 'CUT_RANKING')
          await scheduleClipEditorStep(jobId)
          return { done: false, rescheduled: true, state: 'CUT_RANKING' }
        }
        if (!job.passes.hooks) {
          const hooks = await runHookAnalysisPass(transcript)
          await updateClipEditorJobPasses(jobId, { hooks })
        }
        await updateClipEditorJobState(jobId, 'RETENTION_ANALYSIS')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'RETENTION_ANALYSIS' }
      }
      case 'RETENTION_ANALYSIS': {
        const transcript = job.passes.transcript
        if (!transcript) throw new Error('Missing transcript')
        if (!job.passes.retention) {
          const retention = await runRetentionAnalysisPass(transcript)
          await updateClipEditorJobPasses(jobId, { retention })
        }
        await updateClipEditorJobState(jobId, 'CUT_RANKING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'CUT_RANKING' }
      }
      case 'CUT_RANKING': {
        const transcript = job.passes.transcript
        const hooks = job.passes.hooks
        const retention = job.passes.retention
        if (!transcript || !hooks || !retention) throw new Error('Missing analysis for cut ranking')
        if (!job.passes.cutRanking) {
          const cutRanking = runCutRankingPass(transcript, hooks, retention)
          await updateClipEditorJobPasses(jobId, { cutRanking })
        }
        await updateClipEditorJobState(jobId, 'REFRAMING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'REFRAMING' }
      }
      case 'REFRAMING': {
        const transcript = job.passes.transcript
        const cutRanking = job.passes.cutRanking
        if (!transcript || !cutRanking) throw new Error('Missing data for reframing')
        if (!job.passes.reframing) {
          const reframing = runReframingPass(transcript, job.layoutTemplate, job.landscapeMode)
          await updateClipEditorJobPasses(jobId, { reframing })
        }
        await updateClipEditorJobState(jobId, 'VIRALITY_CUT')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'VIRALITY_CUT' }
      }
      case 'VIRALITY_CUT': {
        const transcript = job.passes.transcript
        const cutRanking = job.passes.cutRanking
        const reframing = job.passes.reframing
        if (!transcript || !cutRanking || !reframing) throw new Error('Missing cut pass outputs')
        if (shouldRunViralityPhase('cut', tier) && !job.passes.viralityCut) {
          const viralityCut = await runViralityReviewPass({
            phase: 'cut',
            platform: job.platform,
            transcript,
            cutRanking,
            geminiVideo: job.passes.geminiVideo,
          })
          await updateClipEditorJobPasses(jobId, { viralityCut })
        }
        if (!job.passes.cutPhasePlan) {
          const cutPhasePlan = runCutPhaseEditPlanPass({
            ranking: cutRanking,
            reframing,
            layoutTemplate: job.layoutTemplate,
            landscapeMode: job.landscapeMode,
            durationSeconds: transcript.durationSeconds,
            geminiVideo: job.passes.geminiVideo,
          })
          await updateClipEditorJobPasses(jobId, { cutPhasePlan })
        }
        if (!tier.renderCutPreview) {
          await updateClipEditorJobState(jobId, 'CUT_PHASE_DONE')
          return { done: false, rescheduled: false, state: 'CUT_PHASE_DONE', phasePaused: true }
        }
        await updateClipEditorJobState(jobId, 'RENDERING_CUT_PREVIEW')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'RENDERING_CUT_PREVIEW' }
      }
      case 'RENDERING_CUT_PREVIEW': {
        const cutPlan = job.passes.cutPhasePlan
        if (!cutPlan) throw new Error('Missing cut phase plan for preview render')
        if (!job.cutShotstackRenderId) {
          const { renderId } = await submitShotstackRenderForEditPlan(jobWithUrl, cutPlan, {
            richCaptions: false,
            tier,
          })
          await updateClipEditorJobState(jobId, 'RENDERING_CUT_PREVIEW', {
            cutShotstackRenderId: renderId,
          })
          await scheduleClipEditorStep(jobId, 5)
          return { done: false, rescheduled: true, state: 'RENDERING_CUT_PREVIEW' }
        }
        const poll = await pollShotstackRender(job.cutShotstackRenderId)
        if (poll.failed) throw new Error(`Cut preview render failed (${poll.status})`)
        if (!poll.done || !poll.url) {
          await scheduleClipEditorStep(jobId, 5)
          return { done: false, rescheduled: true, state: 'RENDERING_CUT_PREVIEW' }
        }
        const finalized = await finalizeShotstackOutput(jobWithUrl, poll.url, 'cut-preview')
        await updateClipEditorJobState(jobId, 'CUT_PHASE_DONE', {
          cutPreviewUrl: finalized.outputUrl,
          cutPreviewR2Key: finalized.outputR2Key,
          cutShotstackRenderId: job.cutShotstackRenderId,
        })
        return { done: false, rescheduled: false, state: 'CUT_PHASE_DONE', phasePaused: true }
      }
      case 'PACING': {
        const transcript = job.passes.transcript
        const cutRanking = job.passes.cutRanking
        if (!transcript || !cutRanking) throw new Error('Missing data for pacing')
        if (!job.passes.pacing) {
          const pacing = tier.useGeminiPacing
            ? await runPacingPass(
                transcript,
                cutRanking,
                job.platform,
                job.passes.viralityCut
              )
            : runRulesPacingPass(transcript, cutRanking, job.platform)
          await updateClipEditorJobPasses(jobId, { pacing })
        }
        await updateClipEditorJobState(jobId, 'BROLL_PLANNING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'BROLL_PLANNING' }
      }
      case 'BROLL_PLANNING': {
        const transcript = job.passes.transcript
        const retention = job.passes.retention
        if (!transcript || !retention) throw new Error('Missing data for b-roll')
        if (!job.passes.broll) {
          const broll = runBrollPass(transcript, retention, tier)
          await updateClipEditorJobPasses(jobId, { broll })
        }
        await updateClipEditorJobState(jobId, 'VIRALITY_EFFECTS')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'VIRALITY_EFFECTS' }
      }
      case 'VIRALITY_EFFECTS': {
        const transcript = job.passes.transcript
        const cutRanking = job.passes.cutRanking
        const pacing = job.passes.pacing
        if (!transcript || !cutRanking || !pacing) throw new Error('Missing effects pass outputs')
        if (shouldRunViralityPhase('effects', tier) && !job.passes.viralityEffects) {
          const viralityEffects = await runViralityReviewPass({
            phase: 'effects',
            platform: job.platform,
            transcript,
            cutRanking,
            geminiVideo: job.passes.geminiVideo,
            pacing,
            cutPhasePlan: job.passes.cutPhasePlan,
            previousReview: job.passes.viralityCut,
          })
          await updateClipEditorJobPasses(jobId, { viralityEffects })
        }
        await updateClipEditorJobState(jobId, 'CAPTIONING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'CAPTIONING' }
      }
      case 'TEXT_TRANSCRIBING': {
        await updateClipEditorJobState(jobId, 'CAPTIONING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'CAPTIONING' }
      }
      case 'CAPTIONING': {
        const transcript = job.passes.transcript
        const hooks = job.passes.hooks
        if (!transcript || !hooks) throw new Error('Missing data for captioning')
        if (shouldRunViralityPhase('text', tier) && !job.passes.viralityText) {
          const viralityText = await runViralityReviewPass({
            phase: 'text',
            platform: job.platform,
            transcript,
            cutRanking: job.passes.cutRanking,
            geminiVideo: job.passes.geminiVideo,
            pacing: job.passes.pacing,
            previousReview: job.passes.viralityEffects,
          })
          await updateClipEditorJobPasses(jobId, { viralityText })
        }
        if (!job.passes.captions) {
          const captions = runCaptionIntelligencePass(transcript)
          await updateClipEditorJobPasses(jobId, { captions })
        }
        const viralityText = job.passes.viralityText
        if (!job.passes.hookOverlay) {
          const hookOverlay = tier.useGeminiHookOverlay
            ? await runHookOverlayPass(hooks, job.platform, viralityText)
            : hookOverlayPlanSchema.parse({
                overlays: [{ start: 0, end: 2, text: 'wait for it', animation: 'pop' }],
              })
          await updateClipEditorJobPasses(jobId, { hookOverlay })
        }
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
        if (!job.passes.finalEditPlan) {
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
        }
        await updateClipEditorJobState(jobId, 'RENDERING')
        await scheduleClipEditorStep(jobId)
        return { done: false, rescheduled: true, state: 'RENDERING' }
      }
      case 'RENDERING': {
        if (!job.shotstackRenderId) {
          const { renderId } = await submitShotstackRenderPass(jobWithUrl, tier)
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

        const finalized = await finalizeShotstackOutput(jobWithUrl, poll.url, 'final')
        const transcript = job.passes.transcript
        const finalEditPlan = job.passes.finalEditPlan
        if (tier.useGeminiMetadata && transcript && finalEditPlan) {
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
    const detail = formatUnknownError(error)
    const message = `[${job.state}] ${detail}`
    await markClipEditorJobFailed(jobId, message)
    throw new Error(message)
  }
}

export type ClipEditorWizardPhase = 'cut' | 'finish'

/** Start or resume a user-facing wizard phase (called from authenticated API). */
export async function startClipEditorWizardPhase(
  jobId: string,
  phase: ClipEditorWizardPhase
): Promise<{ state: ClipEditorJobState }> {
  const job = await getClipEditorJob(jobId)
  if (!job) throw new Error('Job not found')
  if (job.state === 'FAILED') throw new Error('Job failed — create a new job')
  if (job.state === 'COMPLETE') throw new Error('Job already complete')

  switch (phase) {
    case 'cut': {
      if (job.userPhase !== 'ready' && job.state !== 'UPLOADED') {
        if (job.userPhase === 'cut_running') {
          await scheduleClipEditorStep(jobId)
          return { state: job.state }
        }
        throw new Error('Cut pass already started or finished')
      }
      await updateClipEditorJobState(jobId, 'TRANSCRIBING')
      await scheduleClipEditorStep(jobId)
      return { state: 'TRANSCRIBING' }
    }
    case 'finish': {
      if (job.userPhase !== 'cut_ready' && job.state !== 'CUT_PHASE_DONE') {
        if (job.userPhase === 'finish_running') {
          await scheduleClipEditorStep(jobId)
          return { state: job.state }
        }
        throw new Error('Run Cut it first and wait for the cut preview')
      }
      await updateClipEditorJobState(jobId, 'PACING')
      await scheduleClipEditorStep(jobId)
      return { state: 'PACING' }
    }
    default:
      throw new Error('Invalid phase')
  }
}

/** @deprecated Use advanceClipEditorStep via QStash — kept for tests/scripts only */
export async function runClipEditorPipeline(jobId: string): Promise<void> {
  let guard = 0
  while (guard < 60) {
    const result = await advanceClipEditorStep(jobId)
    if (result.done) return
    if (result.phasePaused) return
    guard += 1
  }
  throw new Error('Pipeline exceeded max inline steps')
}
