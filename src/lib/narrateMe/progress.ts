import type { NarrateMeJob, NarrateMeStage } from '@/lib/narrateMe/types'

export function stageLabel(stage: NarrateMeStage, job: NarrateMeJob): string {
  switch (stage) {
    case 'upload':
      return 'Waiting for video upload'
    case 'analyzing':
      return `Analyzing video events: ${Math.round(job.analysis.progress)}%`
    case 'understanding':
      return 'Understanding events'
    case 'timeline':
      return 'Building timeline'
    case 'writing':
      return 'Writing narration'
    case 'awaiting_approval':
      return 'Waiting for script approval'
    case 'generating_voice': {
      const total = job.script.segments.length
      const done = job.voice.completedCount
      return `Generating narration: ${done} / ${total} segments`
    }
    case 'building_audio':
      return 'Assembling narration track...'
    case 'generating_captions':
      return 'Generating captions from audio timing'
    case 'packaging':
      return 'Packaging CapCut files'
    case 'ready':
      return 'Ready'
    case 'failed':
      return job.error || 'Failed'
  }
}

export function computeProgress(job: NarrateMeJob): { progress: number; stage: NarrateMeStage } {
  if (job.status === 'ready') return { progress: 100, stage: 'ready' }
  if (job.status === 'awaiting_upload') return { progress: 4, stage: 'upload' }
  if (job.status === 'uploaded') return { progress: 8, stage: 'upload' }

  if (job.status === 'analyzing') {
    const chunkPct =
      job.analysis.totalChunks > 0
        ? job.analysis.completedChunks / job.analysis.totalChunks
        : 0
    if (chunkPct < 0.55) return { progress: Math.round(10 + chunkPct * 30), stage: 'analyzing' }
    if (chunkPct < 0.9) return { progress: Math.round(28 + chunkPct * 20), stage: 'understanding' }
    return { progress: Math.round(48 + chunkPct * 6), stage: 'timeline' }
  }

  if (job.status === 'awaiting_script_approval') {
    if (job.script.status === 'running') return { progress: 56, stage: 'writing' }
    return { progress: 60, stage: 'awaiting_approval' }
  }

  if (job.status === 'generating_voice') {
    const total = Math.max(1, job.script.segments.length)
    const done = job.voice.completedCount
    return {
      progress: Math.round(62 + (done / total) * 16),
      stage: 'generating_voice',
    }
  }

  if (job.status === 'processing_audio') {
    if (job.audio.status !== 'complete') return { progress: 82, stage: 'building_audio' }
    if (job.captions.status !== 'complete') return { progress: 90, stage: 'generating_captions' }
    return { progress: 95, stage: 'packaging' }
  }

  if (job.status === 'failed') return { progress: job.progress || 0, stage: 'failed' }
  return { progress: job.progress || 0, stage: job.currentStage }
}

export function applyProgress(job: NarrateMeJob): Pick<
  NarrateMeJob,
  'progress' | 'currentStage' | 'progressLabel'
> {
  const { progress, stage } = computeProgress(job)
  return {
    progress,
    currentStage: stage,
    progressLabel: stageLabel(stage, { ...job, currentStage: stage, progress }),
  }
}

export function elapsedSeconds(job: NarrateMeJob): number {
  const start = Date.parse(job.startedAt || job.createdAt)
  if (!Number.isFinite(start)) return 0
  return Math.max(0, Math.round((Date.now() - start) / 1000))
}

export function estimateRemainingSeconds(job: NarrateMeJob): number | null {
  const elapsed = elapsedSeconds(job)
  if (elapsed < 8 || job.progress <= 5 || job.progress >= 100) return null
  if (job.status === 'awaiting_script_approval' || job.status === 'ready') return null
  const remainingPct = Math.max(1, 100 - job.progress)
  return Math.round((elapsed / job.progress) * remainingPct)
}
