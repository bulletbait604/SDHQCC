/**
 * Clip Analyzer prompt + score calibration (algorithm-ranked coaching).
 */
import { post4mePlatformPlaybook } from '@/lib/post4meViralityPrompt'
import {
  isYouTubeClipPlatform,
  youtubeShortsMetadataPromptBlock,
} from '@/lib/clipAnalyzerMetadata'

export const CLIP_ANALYZE_MODEL_DEFAULT = 'gemini-3.1-flash-lite'

export function resolveClipAnalyzeModel(): string {
  return (
    process.env.CLIP_ANALYZE_MODEL?.trim() ||
    process.env.CLIP_ANALYZER_GEMINI_MODEL?.trim() ||
    CLIP_ANALYZE_MODEL_DEFAULT
  )
}

/** Align with Vercel maxDuration=300; leave headroom for ingest/cleanup. */
export function clipAnalyzeTimeoutMs(): number {
  const raw = Number(process.env.CLIP_ANALYZE_TIMEOUT_MS ?? '240000')
  if (!Number.isFinite(raw) || raw < 30_000) return 240_000
  return Math.min(280_000, Math.round(raw))
}

export function truncateClipAlgoContext(block: string, maxChars = 2000): string {
  const t = (block || '').trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars - 1).trimEnd()}…`
}

type TargetPlatform = 'tiktok' | 'youtube' | 'reels'

function playbookPlatformId(target: TargetPlatform): string {
  if (target === 'youtube') return 'youtube-shorts'
  if (target === 'reels') return 'instagram'
  return 'tiktok'
}

export function platformEditingDirective(platform: TargetPlatform): string {
  if (platform === 'youtube') {
    return `Focus on the "Loop." Ensure the last 2 seconds lead back into the first 2 seconds for infinite loop potential.`
  }
  if (platform === 'reels') {
    return `Focus on "Cinematic Quality." Use longer cuts (3-4 seconds) and ensure the center of the frame is the priority for the Grid view.`
  }
  return `Focus on a 3-second visual hook. Edit for "Chaos Pacing"—cut every 1.5 seconds to keep retention high.`
}

export function buildClipAnalyzePrompt(params: {
  platformLabel: string
  targetPlatform: TargetPlatform
  algoBlock: string
  locationBlock: string
  timezone: string
  areaLabel: string
  algorithmPlatformId: string
  algorithmUpdatedAt: string | null
}): string {
  const playbookId = playbookPlatformId(params.targetPlatform)
  const playbook = post4mePlatformPlaybook(playbookId)
  const isYouTubeMetadata = isYouTubeClipPlatform(params.platformLabel)
  const algo = truncateClipAlgoContext(params.algoBlock)

  return `You are an expert social media algorithm analyst. Rank this clip against LIVE ${params.platformLabel} algorithm data and give concrete edits to improve reach.

PLATFORM EDITING DIRECTIVE:
${platformEditingDirective(params.targetPlatform)}

${playbook}

LIVE ALGORITHM DATA (must drive scoring + recommendations — cite it):
${algo}

${params.locationBlock}

ALGORITHM RANKING RULES (mandatory):
1) Score THIS platform only — do not inflate because the clip would do well on Facebook.
2) In algorithmAlignment, cite 1–2 concrete lines from the LIVE snapshot (title/hook, retention, posting).
3) recommendations[] must map to snapshot gaps (hook, audio, watermark, pacing, posting windows).
4) Be honest: weak first 1–3s or watermarked cross-posts must lower hookStrength / score.
5) Prefer specific timestamps and edit actions over vague advice.

CRITICAL ANALYSIS REQUIREMENTS:
1. SUBJECT: topic, niche, audience; game name if gaming; original stream platform if visible; content type.
2. VISUAL: first 3s / middle / end; pacing; overlays; thumbnail moments; cross-platform watermarks.
3. AUDIO: speech, music mood, mix; trending-sound friendliness.
4. HOOK: exact timestampSeconds; type; platform fit; one concrete first-1–3s fix.
5. TRENDING AUDIO: keep / layer / replace + searchKeywords (no fake song titles).
6. WATERMARK: detect + action.
7. POSTING: best local windows for ${params.timezone} using LIVE posting tips.
8. SCORING (0–100): Hook 25 + Engagement 20 + Visual/Audio 15 + Platform fit 20 + Metadata 20. Sub-scores must justify the overall score — do not invent a high overall with weak subs.
9. TAGS:
${
  isYouTubeMetadata
    ? youtubeShortsMetadataPromptBlock()
    : `5–12 high-signal #tags for Reels/TikTok (not spam).`
}

Return ONLY this JSON (no markdown, no preamble):
{
  "score": <0-100>,
  "scoreTitle": "<Excellent|Good|Fair|Needs Improvement>",
  "scoreSummary": "<2 sentences: strength + key fix>",
  "hookStrength": <0-100>,
  "engagementPotential": <0-100>,
  "visualQuality": <0-100>,
  "audioQuality": <0-100>,
  "algorithmAlignment": "<cite LIVE snapshot lines this score follows; note gaps>",
  "insights": [
    { "icon": "🎯", "label": "Hook Strength", "value": "<Strong|Moderate|Weak>", "description": "<why + fix>", "score": <0-100> },
    { "icon": "⚡", "label": "Engagement Potential", "value": "<High|Medium|Low>", "description": "<why + boost>", "score": <0-100> },
    { "icon": "🎬", "label": "Visual Quality", "value": "<Professional|Good|Fair>", "description": "<why + fix>", "score": <0-100> },
    { "icon": "🔊", "label": "Audio Quality", "value": "<Clear|Muffled|Unbalanced>", "description": "<why + fix>", "score": <0-100> }
  ],
  "hookAnalysis": {
    "timestampSeconds": <number>,
    "type": "<visual|audio|conceptual|mixed>",
    "summary": "<hook>",
    "platformFit": "<fit for ${params.platformLabel}>",
    "improvement": "<first 1-3s edit>"
  },
  "trendingAudioAdvice": {
    "recommendation": "<keep_original|layer_trending|replace_with_trending>",
    "rationale": "<why>",
    "searchKeywords": "<sound-search phrase>",
    "mixTip": "<mix tip>"
  },
  "watermarkCheck": {
    "detected": <true|false>,
    "details": "<seen or none>",
    "action": "<re-export / crop / safe>"
  },
  "postingPlan": {
    "timezone": "${params.timezone}",
    "areaLabel": "${params.areaLabel}",
    "bestWindowsLocal": ["<w1>", "<w2>", "<w3>"],
    "frequencyTip": "<frequency for ${params.platformLabel}>",
    "crossPostNote": "<vs Facebook Reels if identical cross-post>"
  },
  "recommendations": [
    { "priority": "high", "category": "Hook", "text": "<actionable>" },
    { "priority": "high", "category": "Trending Audio", "text": "<actionable>" },
    { "priority": "high", "category": "Watermark", "text": "<actionable>" },
    { "priority": "med", "category": "Pacing", "text": "<actionable>" },
    { "priority": "med", "category": "Visual", "text": "<actionable>" },
    { "priority": "med", "category": "Posting Time", "text": "<local ${params.timezone}>" },
    { "priority": "low", "category": "Metadata", "text": "<actionable>" }
  ],
  "overlays": [
    { "type": "text", "description": "<short>", "timing": "<ts>" },
    { "type": "sound", "description": "<short>", "timing": "<ts>" },
    { "type": "visual", "description": "<short>", "timing": "<ts>" },
    { "type": "cta", "description": "<short>", "timing": "<ts>" }
  ],
  "titles": ["<t1>", "<t2>", "<t3>"],
  "description": "<caption>",
  "tags": ["<tag>"],
  "algorithmUsed": "${params.algorithmPlatformId}",
  "algorithmUpdatedAt": "${params.algorithmUpdatedAt || 'unknown'}"
}`
}

function clampScore(n: unknown, fallback = 50): number {
  const x = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(x)) return fallback
  return Math.max(0, Math.min(100, Math.round(x)))
}

function scoreTitleFromScore(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Needs Improvement'
}

/**
 * Keep overall score honest vs sub-scores (blocks inflated "92" with weak hooks).
 */
export function recalibrateClipAnalysisScores(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const hook = clampScore(raw.hookStrength)
  const eng = clampScore(raw.engagementPotential)
  const vis = clampScore(raw.visualQuality)
  const aud = clampScore(raw.audioQuality)
  const modelScore = clampScore(raw.score)
  const subAvg = Math.round((hook + eng + vis + aud) / 4)

  // Prompt weights: Hook 25 + Eng 20 + Visual/Audio 15 → 60; remaining 40 ≈ platform/metadata (use subAvg)
  const visualAudio = Math.round((vis + aud) / 2)
  const weighted = Math.round(hook * 0.25 + eng * 0.2 + visualAudio * 0.15 + subAvg * 0.4)
  const blended = Math.round(weighted * 0.75 + modelScore * 0.25)
  // Cap inflation: overall cannot sit far above the weakest dimensions
  const score = Math.min(blended, subAvg + 10, Math.min(hook, eng) + 25)

  const insights = Array.isArray(raw.insights)
    ? raw.insights.map((item) => {
        if (!item || typeof item !== 'object') return item
        const o = item as Record<string, unknown>
        const label = typeof o.label === 'string' ? o.label.toLowerCase() : ''
        let synced = clampScore(o.score, subAvg)
        if (label.includes('hook')) synced = hook
        else if (label.includes('engagement')) synced = eng
        else if (label.includes('visual')) synced = vis
        else if (label.includes('audio')) synced = aud
        return { ...o, score: synced }
      })
    : raw.insights

  return {
    ...raw,
    hookStrength: hook,
    engagementPotential: eng,
    visualQuality: vis,
    audioQuality: aud,
    score,
    scoreTitle:
      typeof raw.scoreTitle === 'string' && raw.scoreTitle.trim()
        ? scoreTitleFromScore(score)
        : scoreTitleFromScore(score),
    insights,
  }
}
