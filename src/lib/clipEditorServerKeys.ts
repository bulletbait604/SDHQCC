/**
 * Clip Editor: resolve provider secrets from env (supports user-defined names).
 */

export function resolveOpenAiApiKey(): string | undefined {
  const key =
    (process.env.OPENAI_API_KEY || process.env.OPENAI_API || '').trim() || undefined
  return key
}

export function resolveRunwayApiSecret(): string | undefined {
  const key =
    (process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API || '').trim() || undefined
  return key
}

export function clipEditorOpenAiModel(): string {
  return (
    process.env.CLIP_EDITOR_OPENAI_MODEL ||
    process.env.OPENAI_CLIP_EDITOR_MODEL ||
    'gpt-5.4-mini'
  ).trim()
}
