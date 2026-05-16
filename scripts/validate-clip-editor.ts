import { CLIP_EDITOR_JOB_STATES } from '../src/lib/clip-editor/jobStates'
import {
  finalEditPlanSchema,
  hookAnalysisSchema,
  transcriptAnalysisSchema,
} from '../src/lib/clip-editor/schemas'
import { validateClipEditorCloudEnv } from '../src/lib/clip-editor/env'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  assert(CLIP_EDITOR_JOB_STATES.length === 12, 'Expected 12 job states')

  transcriptAnalysisSchema.parse({
    fullTranscript: 'hello world',
    words: [{ word: 'hello', start: 0, end: 0.4 }],
    speakers: [0],
    pauses: [],
    toneShifts: [],
    emotionSignals: [],
    durationSeconds: 1,
  })

  hookAnalysisSchema.parse({
    hooks: [{ start: 0, end: 2, score: 80, reason: 'strong opener' }],
  })

  finalEditPlanSchema.parse({
    cuts: [{ start: 0, end: 10 }],
    zooms: [],
    captions: [],
    cropKeyframes: [],
    effects: [],
    stickers: [],
    hook: [],
    broll: [],
    rankedSegments: [{ start: 0, end: 10, score: 80 }],
    layoutTemplate: 'auto',
    landscapeMode: 'crop',
  })

  const env = validateClipEditorCloudEnv()
  if (!env.ok) {
    console.warn('[validate-clip-editor] Cloud env missing (set in Vercel):', env.missing.join(', '))
  } else {
    console.log('[validate-clip-editor] Cloud environment OK')
  }

  console.log('[validate-clip-editor] Schemas and job states validated')
}

main()
