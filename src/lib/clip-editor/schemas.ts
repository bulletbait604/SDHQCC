import { z } from 'zod'

export const clipEditorPlatformSchema = z.enum(['tiktok', 'youtube', 'reels'])
export type ClipEditorPlatform = z.infer<typeof clipEditorPlatformSchema>

export const layoutTemplateSchema = z.enum([
  'auto',
  'fullFrame',
  'stackedFacecam',
  'pictureInPicture',
  'splitScreen',
  'focusCrop',
])
export type ClipLayoutTemplate = z.infer<typeof layoutTemplateSchema>

const timeRangeSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
})

export const transcriptWordSchema = z.object({
  word: z.string(),
  start: z.number().finite(),
  end: z.number().finite(),
  speaker: z.number().int().optional(),
  confidence: z.number().finite().optional(),
})

export const pauseSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
  durationSeconds: z.number().finite(),
})

export const toneShiftSchema = z.object({
  atSeconds: z.number().finite(),
  label: z.string(),
  intensity: z.number().finite().min(0).max(1).optional(),
})

export const emotionSignalSchema = z.object({
  atSeconds: z.number().finite(),
  emotion: z.string(),
  intensity: z.number().finite().min(0).max(1),
})

export const transcriptAnalysisSchema = z.object({
  fullTranscript: z.string(),
  words: z.array(transcriptWordSchema),
  speakers: z.array(z.number().int()),
  pauses: z.array(pauseSchema),
  toneShifts: z.array(toneShiftSchema),
  emotionSignals: z.array(emotionSignalSchema),
  durationSeconds: z.number().finite().positive(),
})

export const hookItemSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
  score: z.number().finite().min(0).max(100),
  reason: z.string(),
  category: z.preprocess(
    (value) => (value === 'arguments' ? 'argument' : value),
    z
      .enum([
        'surprise',
        'controversy',
        'humor',
        'emotion',
        'curiosity',
        'challenge',
        'argument',
        'gaming',
        'reaction',
        'other',
      ])
      .optional()
  ),
})

export const hookAnalysisSchema = z.object({
  hooks: z.array(hookItemSchema),
})

const cropRegionSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  width: z.number().finite().min(0).max(1),
  height: z.number().finite().min(0).max(1),
  label: z.string().optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
})

export const geminiVideoPlanSchema = z.object({
  hookTitle: z.string(),
  hookSubtitle: z.string().optional(),
  hookPlan: z.string(),
  pacePlan: z.string().optional(),
  contentType: z
    .enum(['gameplayStream', 'talkingHead', 'sportsAction', 'screenShare', 'unknown'])
    .optional(),
  layoutTemplate: layoutTemplateSchema.optional(),
  cutSeconds: z.number().finite().positive().optional(),
  introHookSeconds: z.number().finite().positive().optional(),
  renderSeconds: z.number().finite().positive().optional(),
  captionStyle: z.enum(['karaoke', 'bold', 'clean']).optional(),
  hookStyle: z.enum(['pop', 'glitch', 'clean', 'urgent']).optional(),
  keywordHighlights: z.array(z.string()).optional(),
  primaryWindow: z.object({
    start: z.number().finite(),
    end: z.number().finite(),
    confidence: z.number().finite().min(0).max(1),
    reason: z.string(),
  }),
  regions: z
    .object({
      gameplay: cropRegionSchema.optional(),
      facecam: cropRegionSchema.optional(),
      speaker: cropRegionSchema.optional(),
      action: cropRegionSchema.optional(),
    })
    .optional(),
})

export const dropMomentSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
  severity: z.number().finite().min(0).max(1),
  reason: z.string(),
})

export const retentionPointSchema = z.object({
  atSeconds: z.number().finite(),
  retention: z.number().finite().min(0).max(1),
})

export const retentionAnalysisSchema = z.object({
  dropMoments: z.array(dropMomentSchema),
  retentionCurve: z.array(retentionPointSchema),
})

export const rankedSegmentSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
  score: z.number().finite(),
  hookScore: z.number().finite().optional(),
  emotionalIntensity: z.number().finite().optional(),
  speakingSpeed: z.number().finite().optional(),
  surpriseFactor: z.number().finite().optional(),
  deadAirPenalty: z.number().finite().optional(),
  fillerPenalty: z.number().finite().optional(),
  reason: z.string().optional(),
})

export const cutRankingSchema = z.object({
  segments: z.array(rankedSegmentSchema),
})

export const pacingCutSchema = z.object({
  atSeconds: z.number().finite(),
  type: z.enum(['hard', 'soft', 'jump']),
  reason: z.string().optional(),
})

export const pacingZoomSchema = z.object({
  atSeconds: z.number().finite(),
  style: z.enum(['zoomIn', 'zoomInSlow', 'zoomOut', 'zoomOutSlow']),
  durationSeconds: z.number().finite().positive(),
})

export const effectTimingSchema = z.object({
  atSeconds: z.number().finite(),
  effect: z.string(),
  durationSeconds: z.number().finite().positive().optional(),
})

export const pacingPlanSchema = z.object({
  cuts: z.array(pacingCutSchema),
  zooms: z.array(pacingZoomSchema),
  effectTiming: z.array(effectTimingSchema),
  targetVisualChangeSeconds: z.number().finite().positive(),
})

export const cropKeyframeSchema = z.object({
  atSeconds: z.number().finite(),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  width: z.number().finite().min(0).max(1),
  height: z.number().finite().min(0).max(1),
  confidence: z.number().finite().min(0).max(1).optional(),
})

export const reframingPlanSchema = z.object({
  orientation: z.enum(['horizontal', 'vertical', 'square']),
  multipleFaces: z.boolean(),
  hasMovement: z.boolean(),
  layoutTemplate: layoutTemplateSchema,
  cropKeyframes: z.array(cropKeyframeSchema),
  trackingMode: z.enum(['center', 'face', 'speaker', 'motion', 'smart']),
  smartCropConfidence: z.number().finite().min(0).max(1),
})

export const captionCueSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
  text: z.string(),
  emphasis: z.boolean().optional(),
  style: z.enum(['normal', 'shout', 'whisper']).optional(),
})

export const captionTimelineSchema = z.object({
  cues: z.array(captionCueSchema),
  emphasisWords: z.array(z.string()),
})

export const hookOverlayItemSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
  text: z.string(),
  animation: z.enum(['pop', 'slide', 'glitch', 'fade']),
})

export const hookOverlayPlanSchema = z.object({
  overlays: z.array(hookOverlayItemSchema),
})

export const brollPlacementSchema = z.object({
  start: z.number().finite(),
  end: z.number().finite(),
  prompt: z.string(),
  confidence: z.number().finite().min(0).max(1),
  provider: z.enum(['runway', 'fal', 'none']).optional(),
})

export const brollPlanSchema = z.object({
  enabled: z.boolean(),
  placements: z.array(brollPlacementSchema),
  maxRuntimePercent: z.number().finite().max(20),
})

export const finalEditPlanSchema = z.object({
  cuts: z.array(
    z.object({
      start: z.number().finite(),
      end: z.number().finite(),
      trimStart: z.number().finite().optional(),
    })
  ),
  zooms: z.array(pacingZoomSchema),
  captions: z.array(captionCueSchema),
  cropKeyframes: z.array(cropKeyframeSchema),
  effects: z.array(effectTimingSchema),
  stickers: z.array(
    z.object({
      text: z.string(),
      atSeconds: z.number().finite(),
      durationSeconds: z.number().finite().positive(),
      position: z.string(),
    })
  ),
  hook: z.array(hookOverlayItemSchema),
  broll: z.array(brollPlacementSchema),
  rankedSegments: z.array(rankedSegmentSchema),
  layoutTemplate: layoutTemplateSchema,
  landscapeMode: z.enum(['crop', 'letterbox']),
})

export const publishMetadataSchema = z.object({
  tiktok: z
    .object({
      caption: z.string(),
      hashtags: z.array(z.string()),
    })
    .optional(),
  youtube: z
    .object({
      title: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      thumbnailTimestampSeconds: z.number().finite().optional(),
    })
    .optional(),
  instagram: z
    .object({
      caption: z.string(),
      hashtags: z.array(z.string()),
    })
    .optional(),
  facebook: z
    .object({
      caption: z.string(),
      hashtags: z.array(z.string()),
    })
    .optional(),
  engagementScore: z.number().finite().min(0).max(100).optional(),
})

export const viralityReviewSchema = z.object({
  phase: z.enum(['cut', 'effects', 'text']),
  viralityScore: z.number().finite().min(0).max(100),
  platformFitScore: z.number().finite().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).max(8),
  risks: z.array(z.string()).max(8),
  /** Fed into the next AI pass prompts for this platform. */
  promptHints: z.string(),
  recommendedAdjustments: z.array(z.string()).max(10),
})

export const clipEditorJobPassesSchema = z.object({
  transcript: transcriptAnalysisSchema.optional(),
  geminiVideo: geminiVideoPlanSchema.optional(),
  hooks: hookAnalysisSchema.optional(),
  retention: retentionAnalysisSchema.optional(),
  cutRanking: cutRankingSchema.optional(),
  pacing: pacingPlanSchema.optional(),
  reframing: reframingPlanSchema.optional(),
  captions: captionTimelineSchema.optional(),
  hookOverlay: hookOverlayPlanSchema.optional(),
  broll: brollPlanSchema.optional(),
  viralityCut: viralityReviewSchema.optional(),
  viralityEffects: viralityReviewSchema.optional(),
  viralityText: viralityReviewSchema.optional(),
  cutPhasePlan: finalEditPlanSchema.optional(),
  effectsPhasePlan: finalEditPlanSchema.optional(),
  finalEditPlan: finalEditPlanSchema.optional(),
  metadata: publishMetadataSchema.optional(),
})

export const startClipEditorPhaseSchema = z.object({
  phase: z.enum(['cut', 'finish']),
})

export const createClipEditorJobBodySchema = z.object({
  r2FileKey: z.string().min(1).max(500),
  platform: clipEditorPlatformSchema,
  layoutTemplate: layoutTemplateSchema.default('auto'),
  landscapeMode: z.enum(['crop', 'letterbox']).default('crop'),
  sourceDurationSeconds: z.number().finite().positive().max(120).optional(),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
})
