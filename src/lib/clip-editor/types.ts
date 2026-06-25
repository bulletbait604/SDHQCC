import type { z } from 'zod'
import type {
  brollPlanSchema,
  captionTimelineSchema,
  clipEditorJobPassesSchema,
  clipEditorPlatformSchema,
  createClipEditorJobBodySchema,
  cutRankingSchema,
  finalEditPlanSchema,
  geminiVideoPlanSchema,
  hookAnalysisSchema,
  hookOverlayPlanSchema,
  layoutTemplateSchema,
  pacingPlanSchema,
  publishMetadataSchema,
  reframingPlanSchema,
  retentionAnalysisSchema,
  transcriptAnalysisSchema,
  viralityReviewSchema,
  viralSegmentSchema,
} from '@/lib/clip-editor/schemas'
import type { ClipEditorJobState, ClipEditorUserPhase } from '@/lib/clip-editor/jobStates'

export type ClipEditorPlatform = z.infer<typeof clipEditorPlatformSchema>
export type ClipLayoutTemplate = z.infer<typeof layoutTemplateSchema>
export type CreateClipEditorJobBody = z.infer<typeof createClipEditorJobBodySchema>
export type TranscriptAnalysis = z.infer<typeof transcriptAnalysisSchema>
export type GeminiVideoPlan = z.infer<typeof geminiVideoPlanSchema>
export type ViralSegment = z.infer<typeof viralSegmentSchema>
export type HookAnalysis = z.infer<typeof hookAnalysisSchema>
export type RetentionAnalysis = z.infer<typeof retentionAnalysisSchema>
export type CutRanking = z.infer<typeof cutRankingSchema>
export type PacingPlan = z.infer<typeof pacingPlanSchema>
export type ReframingPlan = z.infer<typeof reframingPlanSchema>
export type CaptionTimeline = z.infer<typeof captionTimelineSchema>
export type HookOverlayPlan = z.infer<typeof hookOverlayPlanSchema>
export type BrollPlan = z.infer<typeof brollPlanSchema>
export type FinalEditPlan = z.infer<typeof finalEditPlanSchema>
export type PublishMetadata = z.infer<typeof publishMetadataSchema>
export type ViralityReview = z.infer<typeof viralityReviewSchema>
export type ClipEditorJobPasses = z.infer<typeof clipEditorJobPassesSchema>

export type ClipEditorJobDocument = {
  _id: string
  userId: string
  username: string
  r2FileKey: string
  sourceReadUrl: string
  platform: ClipEditorPlatform
  layoutTemplate: ClipLayoutTemplate
  landscapeMode: 'crop' | 'letterbox'
  sourceDurationSeconds?: number
  mimeType: string
  state: ClipEditorJobState
  userPhase: ClipEditorUserPhase
  progress: number
  error?: string
  passes: ClipEditorJobPasses
  shotstackRenderId?: string
  cutShotstackRenderId?: string
  effectsShotstackRenderId?: string
  cutPreviewUrl?: string
  cutPreviewR2Key?: string
  effectsPreviewUrl?: string
  effectsPreviewR2Key?: string
  outputR2Key?: string
  outputUrl?: string
  createdAt: string
  updatedAt: string
}
