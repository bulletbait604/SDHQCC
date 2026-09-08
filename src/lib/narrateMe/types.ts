export type NarrateMeJobStatus =
  | 'awaiting_upload'
  | 'uploaded'
  | 'analyzing'
  | 'awaiting_script_approval'
  | 'generating_voice'
  | 'processing_audio'
  | 'ready'
  | 'failed'

export type NarrateMeStage =
  | 'upload'
  | 'analyzing'
  | 'understanding'
  | 'timeline'
  | 'writing'
  | 'awaiting_approval'
  | 'generating_voice'
  | 'building_audio'
  | 'generating_captions'
  | 'packaging'
  | 'ready'
  | 'failed'

export type StageStatus = 'idle' | 'queued' | 'running' | 'complete' | 'failed'

export interface TimelineEvent {
  id: string
  startTime: number
  endTime: number
  event: string
  visibleElements: string[]
  actions: string[]
  ocr: string[]
  entities: string[]
  quantities: string[]
  uiState: string[]
  dialogue: string[]
  evidence: string[]
  confidence: number
  chunkIndex: number
}

export interface VideoAnalysis {
  status: StageStatus
  progress: number
  totalChunks: number
  completedChunks: number
  chunks: AnalysisChunk[]
  cacheKey: string
  model: string
  completedAt: string
  /** Gemini Files API URI. Never pass R2 signed URLs as fileUri. */
  geminiFileUri: string
  geminiFileName: string
}

export interface AnalysisChunk {
  index: number
  startTime: number
  endTime: number
  status: StageStatus
  eventCount: number
  error: string
  /** R2 key for the 8-minute FFmpeg clip of this window. */
  clipKey: string
}

export interface NarrationSegment {
  id: string
  sourceStart: number
  sourceEnd: number
  text: string
  eventId: string
  confidence: number
  evidence: string[]
  textHash: string
  version: number
}

export interface AlignmentChar {
  char: string
  start: number
  end: number
}

export interface AlignmentWord {
  word: string
  start: number
  end: number
}

export interface Alignment {
  characters: AlignmentChar[]
  words: AlignmentWord[]
}

export interface VoiceSegment {
  id: string
  sourceStart: number
  sourceEnd: number
  text: string
  textHash: string
  elevenLabsRequestId: string
  audioKey: string
  duration: number
  sampleRate: number
  alignment: Alignment
}

export interface CaptionCue {
  index: number
  start: number
  end: number
  text: string
}

export interface NarrateMeSourceVideo {
  fileKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
  uploadedAt: string
}

export interface NarrateMeExport {
  status: StageStatus
  packageKey: string
}

export interface NarrateMeJob {
  jobId: string
  userId: string
  username: string
  status: NarrateMeJobStatus
  currentStage: NarrateMeStage
  progress: number
  progressLabel: string
  prompt: string
  sourceVideo: NarrateMeSourceVideo
  analysis: VideoAnalysis
  timeline: TimelineEvent[]
  script: {
    status: StageStatus
    segments: NarrationSegment[]
    version: number
    approved: boolean
    updatedAt: string
  }
  voice: {
    status: StageStatus
    voiceId: string
    segments: VoiceSegment[]
    completedCount: number
    completedAt: string
  }
  audio: {
    status: StageStatus
    wavKey: string
    mp3Key: string
  }
  captions: {
    status: StageStatus
    srtKey: string
    vttKey: string
  }
  export: NarrateMeExport
  error: string
  retryable: boolean
  createdAt: string
  updatedAt: string
  startedAt: string
}

export type NarrateMePublicJob = Omit<NarrateMeJob, never>
