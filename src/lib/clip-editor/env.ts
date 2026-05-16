const REQUIRED_CLOUD_ENV = [
  'MONGODB_URI',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'DEEPGRAM_API_KEY',
  'GEMINI_API',
  'SHOTSTACK_API_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const

export function clipEditorGeminiModel(): string {
  return (
    process.env.CLIP_EDITOR_GEMINI_MODEL ||
    process.env.CLIP_EDITOR_PLAN_GEMINI_MODEL ||
    'gemini-2.5-flash'
  ).trim()
}

export function clipEditorDeepgramModel(): string {
  return (process.env.CLIP_EDITOR_TRANSCRIPTION_MODEL || process.env.DEEPGRAM_MODEL || 'nova-3').trim()
}

export function validateClipEditorCloudEnv(): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = REQUIRED_CLOUD_ENV.filter((name) => {
    const v = process.env[name]
    return typeof v !== 'string' || v.trim().length === 0
  })
  const base =
    (process.env.CLIP_EDITOR_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || '').trim()
  if (!base) missing.push('CLIP_EDITOR_APP_URL or VERCEL_URL')
  if (missing.length > 0) return { ok: false, missing: Array.from(new Set(missing)) }
  return { ok: true }
}

export function openAiFallbackEnabled(): boolean {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  return key.length > 0
}
