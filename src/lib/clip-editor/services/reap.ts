/**
 * Reap Video Automation API client.
 * Docs: https://docs.reap.video/api-reference/1_introduction
 * Base: https://public.reap.video/api/v1/automation/
 */
import { resolveReapApiKey } from '@/lib/clipEditorServerKeys'
import { normalizeHttpMediaUrl } from '@/lib/normalizeMediaUrl'
import type { ClipEditorPlatform, ClipLayoutTemplate } from '@/lib/clip-editor/types'

const REAP_BASE = 'https://public.reap.video/api/v1/automation'

export type ReapGenre = 'talking' | 'screenshare' | 'gaming'
export type ReapOrientation = 'landscape' | 'portrait' | 'square'
export type ReapProjectType = 'clipping' | 'captions' | 'reframe' | 'dubbing' | 'transcription'
export type ReapProjectStatus =
  | 'queued'
  | 'prepped'
  | 'draft'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'invalid'
  | 'expired'
  | 'failed'
  | 'error'

export type ReapUploadUrlResponse = {
  uploadUrl: string
  id: string
  fileName?: string
  fileType?: string
  status?: string
}

export type ReapProject = {
  id: string
  title?: string
  status?: ReapProjectStatus | string
  projectType?: ReapProjectType | string
  billedDuration?: number
  thumbnail?: string
}

export type ReapClip = {
  id: string
  projectId?: string
  clipUrl?: string | null
  clipWithCaptionsUrl?: string | null
  startTime?: number
  endTime?: number
  duration?: number
  topic?: string | null
  title?: string | null
  caption?: string | null
  viralityScore?: number | null
  exportOrientation?: ReapOrientation
  enableCaptions?: boolean
  enableEmojis?: boolean
  enableHighlights?: boolean
}

export type ReapClipsResponse = {
  clips?: ReapClip[]
  totalClips?: number
  currentPage?: number
  totalPages?: number
}

export type ReapViralEditOptions = {
  platform: ClipEditorPlatform
  layoutTemplate: ClipLayoutTemplate
  landscapeMode: 'crop' | 'letterbox'
  genre?: ReapGenre
  captionsPreset?: string
  enableEmojis?: boolean
  enableHighlights?: boolean
  prompt?: string
  language?: string
  durationSeconds?: number
  fileName?: string
  mimeType?: string
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function requireApiKey(): string {
  const key = resolveReapApiKey()
  if (!key) throw new Error('REAP_API is not configured on this server')
  return key
}

async function reapJson<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> }
): Promise<T> {
  const apiKey = requireApiKey()
  const url = new URL(`${REAP_BASE}${path}`)
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const { query: _q, ...rest } = init || {}
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      ...authHeaders(apiKey),
      ...(rest.headers || {}),
    },
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as T & { detail?: string | unknown }
  if (!res.ok) {
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : data.detail != null
          ? JSON.stringify(data.detail)
          : `Reap API error (${res.status})`
    throw new Error(detail)
  }
  return data
}

export function isReapConfigured(): boolean {
  return Boolean(resolveReapApiKey())
}

/** Map Clip Editor layout → Reap genre for AI framing. */
export function layoutToReapGenre(layout: ClipLayoutTemplate, explicit?: ReapGenre): ReapGenre {
  if (explicit) return explicit
  switch (layout) {
    case 'stackedFacecam':
    case 'pictureInPicture':
    case 'splitScreen':
      return 'screenshare'
    case 'focusCrop':
    case 'fullFrame':
    case 'auto':
    default:
      return 'talking'
  }
}

export function platformToReapOrientation(
  platform: ClipEditorPlatform,
  landscapeMode: 'crop' | 'letterbox'
): ReapOrientation {
  if (landscapeMode === 'letterbox') return 'landscape'
  if (platform === 'youtube') return 'portrait'
  return 'portrait'
}

export function buildViralClipPrompt(params: {
  platform: ClipEditorPlatform
  layoutTemplate: ClipLayoutTemplate
  prompt?: string
}): string {
  const custom = params.prompt?.trim()
  if (custom) return custom.slice(0, 1000)

  const platformHint =
    params.platform === 'tiktok'
      ? 'TikTok — punchy hook in first 1s, high energy'
      : params.platform === 'reels'
        ? 'Instagram Reels — clean hook, scroll-stopping pacing'
        : 'YouTube Shorts — clear payoff, retain to the end'

  const layoutHint =
    params.layoutTemplate === 'stackedFacecam'
      ? 'Prefer facecam + gameplay stacked framing.'
      : params.layoutTemplate === 'pictureInPicture'
        ? 'Prefer gameplay with facecam PiP.'
        : params.layoutTemplate === 'splitScreen'
          ? 'Prefer split framing when two subjects matter.'
          : params.layoutTemplate === 'focusCrop'
            ? 'Tight face/action tracking crop.'
            : 'Pick the most engaging moments automatically.'

  return (
    `Create viral short-form clips for ${platformHint}. ${layoutHint} ` +
    `Keep clips under 60 seconds. Cut dead air, emphasize hooks, reactions, and quotable lines. ` +
    `Trailer-style pacing with punchy cuts.`
  ).slice(0, 1000)
}

export async function getReapUploadUrl(filename: string): Promise<ReapUploadUrlResponse> {
  const safe = filename.toLowerCase().endsWith('.mov')
    ? filename
    : filename.toLowerCase().endsWith('.mp4')
      ? filename
      : `${filename.replace(/\.[^.]+$/, '') || 'clip'}.mp4`
  return reapJson<ReapUploadUrlResponse>('/get-upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename: safe }),
  })
}

export async function putVideoToReapUploadUrl(params: {
  uploadUrl: string
  body: ArrayBuffer | Buffer | Blob
  contentType?: string
}): Promise<void> {
  const res = await fetch(params.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': params.contentType || 'video/mp4',
    },
    body: params.body as BodyInit,
  })
  if (!res.ok) {
    throw new Error(`Reap file upload failed (${res.status})`)
  }
}

/** Download from R2/source URL and upload into Reap; returns uploadId. */
export async function uploadSourceUrlToReap(params: {
  sourceUrl: string
  fileName?: string
  mimeType?: string
}): Promise<{ uploadId: string }> {
  const res = await fetch(params.sourceUrl)
  if (!res.ok) throw new Error(`Could not download source for Reap (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength < 1000) throw new Error('Source video too small to upload to Reap')

  const fileName = params.fileName?.trim() || `clip-${Date.now()}.mp4`
  const upload = await getReapUploadUrl(fileName)
  await putVideoToReapUploadUrl({
    uploadUrl: upload.uploadUrl,
    body: buffer,
    contentType: params.mimeType || 'video/mp4',
  })
  return { uploadId: upload.id }
}

export async function createReapClips(body: {
  uploadId: string
  reframeClips?: boolean
  exportOrientation?: ReapOrientation
  exportResolution?: 720 | 1080 | 1440 | 2160
  captionsPreset?: string | null
  enableEmojis?: boolean
  enableHighlights?: boolean
  language?: string | null
  genre?: ReapGenre
  clipDurations?: number[][]
  topics?: string[]
  prompt?: string
  selectedStart?: number | null
  selectedEnd?: number | null
}): Promise<ReapProject> {
  return reapJson<ReapProject>('/create-clips', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function createReapCaptions(body: {
  uploadId?: string
  sourceUrl?: string
  captionsPreset?: string | null
  language?: string | null
  enableEmojis?: boolean
  enableHighlights?: boolean
  resolution?: 720 | 1080 | 1440 | 2160
  transcriptionScript?: 'native' | 'roman'
}): Promise<ReapProject> {
  return reapJson<ReapProject>('/create-captions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function createReapReframe(body: {
  uploadId: string
  genre?: ReapGenre
  orientation?: 'portrait' | 'square'
  disableAutoSplit?: boolean
}): Promise<ReapProject> {
  return reapJson<ReapProject>('/create-reframe', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getReapProjectStatus(projectId: string): Promise<{
  projectId: string
  projectType?: string
  source?: string
  status: string
}> {
  return reapJson('/get-project-status', {
    method: 'GET',
    query: { projectId },
  })
}

export async function getReapProjectClips(
  projectId: string,
  page = 1,
  pageSize = 20
): Promise<ReapClipsResponse> {
  return reapJson<ReapClipsResponse>('/get-project-clips', {
    method: 'GET',
    query: { projectId, page, pageSize },
  })
}

export function reapClipPlaybackUrl(clip: ReapClip | null | undefined): string | null {
  if (!clip) return null
  return normalizeHttpMediaUrl(clip.clipUrl) || normalizeHttpMediaUrl(clip.clipWithCaptionsUrl)
}

export function pickBestReapClip(clips: ReapClip[] | undefined): ReapClip | null {
  if (!clips?.length) return null
  const playable = clips.filter((c) => Boolean(reapClipPlaybackUrl(c)))
  if (!playable.length) return null
  return [...playable].sort((a, b) => (Number(b.viralityScore) || 0) - (Number(a.viralityScore) || 0))[0]
}

export function isReapTerminalStatus(status: string | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s === 'completed' || s === 'invalid' || s === 'expired' || s === 'failed' || s === 'error'
}

export function isReapSuccessStatus(status: string | undefined): boolean {
  return (status || '').toLowerCase() === 'completed'
}

/**
 * Start a viral Reap project for the uploaded clip.
 * ≥2 min → create-clips (AI cuts + reframe + captions).
 * <2 min → create-reframe (when vertical) then create-captions, or captions-only.
 */
export async function startReapViralProject(
  sourceUrl: string,
  options: ReapViralEditOptions
): Promise<{
  projectId: string
  uploadId: string
  mode: 'clipping' | 'captions' | 'reframe'
  stage: 'primary' | 'awaiting_captions'
  reframeProjectId?: string
}> {
  const genre = layoutToReapGenre(options.layoutTemplate, options.genre)
  const orientation = platformToReapOrientation(options.platform, options.landscapeMode)
  const captionsPreset = options.captionsPreset?.trim() || 'system_beasty'
  const enableEmojis = options.enableEmojis !== false
  const enableHighlights = options.enableHighlights !== false
  const duration = options.durationSeconds ?? 0

  const { uploadId } = await uploadSourceUrlToReap({
    sourceUrl,
    fileName: options.fileName,
    mimeType: options.mimeType,
  })

  // Long-form: full viral clipping pipeline (min 2 minutes per Reap docs)
  if (duration >= 120) {
    const project = await createReapClips({
      uploadId,
      reframeClips: orientation !== 'landscape',
      exportOrientation: orientation,
      exportResolution: 1080,
      captionsPreset,
      enableEmojis,
      enableHighlights,
      language: options.language || undefined,
      genre,
      clipDurations: [
        [0, 30],
        [30, 60],
        [60, 90],
      ],
      prompt: buildViralClipPrompt({
        platform: options.platform,
        layoutTemplate: options.layoutTemplate,
        prompt: options.prompt,
      }),
    })
    if (!project.id) throw new Error('Reap create-clips returned no project id')
    return { projectId: project.id, uploadId, mode: 'clipping', stage: 'primary' }
  }

  // Short clips: reframe to vertical first (API supports 3s–15m), then caption
  if (orientation !== 'landscape') {
    const reframe = await createReapReframe({
      uploadId,
      genre,
      orientation: orientation === 'square' ? 'square' : 'portrait',
      disableAutoSplit: true,
    })
    if (!reframe.id) throw new Error('Reap create-reframe returned no project id')
    return {
      projectId: reframe.id,
      uploadId,
      mode: 'reframe',
      stage: 'awaiting_captions',
      reframeProjectId: reframe.id,
    }
  }

  const captions = await createReapCaptions({
    uploadId,
    captionsPreset,
    language: options.language || undefined,
    enableEmojis,
    enableHighlights,
    resolution: 1080,
  })
  if (!captions.id) throw new Error('Reap create-captions returned no project id')
  return { projectId: captions.id, uploadId, mode: 'captions', stage: 'primary' }
}

/**
 * After a reframe project completes, start captions on the reframed output for viral polish.
 */
export async function continueReapCaptionsAfterReframe(params: {
  reframeProjectId: string
  options: Pick<
    ReapViralEditOptions,
    'captionsPreset' | 'enableEmojis' | 'enableHighlights' | 'language' | 'fileName' | 'mimeType'
  >
}): Promise<{ projectId: string; mode: 'captions'; previewUrl: string }> {
  const clipsRes = await getReapProjectClips(params.reframeProjectId)
  const best = pickBestReapClip(clipsRes.clips)
  const previewUrl = reapClipPlaybackUrl(best)
  if (!previewUrl) throw new Error('Reap reframe completed but no clip URL was returned')

  const { uploadId } = await uploadSourceUrlToReap({
    sourceUrl: previewUrl,
    fileName: `${(params.options.fileName || 'clip').replace(/\.[^.]+$/, '')}-reframed.mp4`,
    mimeType: params.options.mimeType || 'video/mp4',
  })

  const captions = await createReapCaptions({
    uploadId,
    captionsPreset: params.options.captionsPreset?.trim() || 'system_beasty',
    language: params.options.language || undefined,
    enableEmojis: params.options.enableEmojis !== false,
    enableHighlights: params.options.enableHighlights !== false,
    resolution: 1080,
  })
  if (!captions.id) throw new Error('Reap create-captions returned no project id')
  return { projectId: captions.id, mode: 'captions', previewUrl }
}

export function reapClipsToViralSegments(clips: ReapClip[]): Array<{
  start: number
  end: number
  title: string
  explanation: string
  viralityScore: number
}> {
  return clips
    .filter((c) => typeof c.startTime === 'number' && typeof c.endTime === 'number')
    .map((c) => ({
      start: Number(c.startTime),
      end: Number(c.endTime),
      title: (c.title || c.topic || 'Viral moment').slice(0, 120),
      explanation: (c.caption || 'Reap AI selected this moment for virality.').slice(0, 400),
      // Reap scores 0–10; Clip Editor UI expects ~1–100
      viralityScore: Math.max(1, Math.min(100, Math.round((Number(c.viralityScore) || 5) * 10))),
    }))
    .slice(0, 10)
}
