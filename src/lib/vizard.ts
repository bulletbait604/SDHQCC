import { resolveVizardApiKey } from '@/lib/clipEditorServerKeys'

const VIZARD_PROJECT_ROOT = 'https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project'

export type VizardCreateResponse = {
  code?: number
  projectId?: number | string
  shareLink?: string
  errMsg?: string
}

export type VizardVideo = {
  videoId?: number | string
  videoUrl?: string
  videoMsDuration?: number
  title?: string
  transcript?: string
  viralScore?: string
  viralReason?: string
  relatedTopic?: string
  clipEditorUrl?: string
}

export type VizardQueryResponse = {
  code?: number
  projectId?: number | string
  projectName?: string
  shareLink?: string
  videos?: VizardVideo[]
  errMsg?: string
}

export function clipEditorRenderBackend(): 'shotstack' | 'vizard' {
  return process.env.CLIP_EDITOR_RENDER_BACKEND?.trim().toLowerCase() === 'vizard'
    ? 'vizard'
    : 'shotstack'
}

export type VizardCaptionMode = 'vizard' | 'deepgram-shotstack'

export function vizardCaptionMode(): VizardCaptionMode {
  const raw = process.env.CLIP_EDITOR_VIZARD_CAPTION_MODE?.trim().toLowerCase()
  return raw === 'deepgram' || raw === 'deepgram-shotstack' || raw === 'shotstack'
    ? 'deepgram-shotstack'
    : 'vizard'
}

function vizardLanguage(): string {
  return process.env.CLIP_EDITOR_VIZARD_LANG?.trim() || 'auto'
}

function vizardRemoveSilenceSwitch(): 0 | 1 {
  const raw = process.env.CLIP_EDITOR_VIZARD_REMOVE_SILENCE?.trim()
  return raw === '0' || raw?.toLowerCase() === 'false' ? 0 : 1
}

function vizardStatusMessage(code: number | undefined, fallback: string): string {
  switch (code) {
    case 1000:
      return 'Vizard is still processing the clip.'
    case 4001:
      return 'Vizard rejected the API key.'
    case 4002:
      return 'Vizard project creation failed.'
    case 4003:
      return 'Vizard rate limit exceeded.'
    case 4004:
      return 'Vizard does not support this video format.'
    case 4005:
      return 'Vizard could not process this video. It may be broken, too long for editing mode, or unavailable.'
    case 4006:
      return 'Vizard rejected the request parameters.'
    case 4007:
      return 'Vizard account has insufficient remaining minutes.'
    case 4008:
      return 'Vizard could not download the video URL.'
    case 4009:
      return 'Vizard rejected the video URL as invalid.'
    case 4010:
      return 'Vizard could not detect the spoken language. Try setting a specific language later.'
    default:
      return fallback
  }
}

export function vizardUserMessage(data: { code?: number; errMsg?: string } | null | undefined): string {
  const msg = data?.errMsg?.trim()
  return msg || vizardStatusMessage(data?.code, 'Vizard could not process this clip.')
}

function sourceExtension(fileName: string | undefined, mimeType: string | undefined): string {
  const fromName = fileName?.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase()
  const normalized = fromName === 'm4v' ? 'mp4' : fromName
  if (normalized === 'mp4' || normalized === 'mov' || normalized === 'avi' || normalized === '3gp') {
    return normalized
  }
  if (mimeType === 'video/quicktime') return 'mov'
  if (mimeType === 'video/x-msvideo') return 'avi'
  if (mimeType === 'video/3gpp') return '3gp'
  return 'mp4'
}

export async function submitVizardClip(params: {
  sourceUrl: string
  platform: 'tiktok' | 'youtube' | 'reels'
  fileName?: string
  mimeType?: string
  projectName?: string
}): Promise<VizardCreateResponse> {
  const apiKey = resolveVizardApiKey()
  if (!apiKey) {
    throw new Error('VIZARDAI_API_KEY is not configured')
  }

  const captionMode = vizardCaptionMode()
  const body = {
    lang: vizardLanguage(),
    preferLength: [0],
    videoUrl: params.sourceUrl,
    videoType: 1,
    ext: sourceExtension(params.fileName, params.mimeType),
    ratioOfClip: 1,
    removeSilenceSwitch: vizardRemoveSilenceSwitch(),
    maxClipNumber: 1,
    subtitleSwitch: captionMode === 'deepgram-shotstack' ? 0 : 1,
    headlineSwitch: 1,
    emojiSwitch: params.platform === 'tiktok' ? 1 : 0,
    highlightSwitch: 1,
    autoBrollSwitch: 0,
    projectName: params.projectName || `SDHQ ${params.platform} Vizard clip`,
  }

  const res = await fetch(`${VIZARD_PROJECT_ROOT}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      VIZARDAI_API_KEY: apiKey,
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as VizardCreateResponse
  if (!res.ok || data.code !== 2000 || !data.projectId) {
    throw new Error(vizardUserMessage(data))
  }
  return data
}

export async function queryVizardProject(projectId: string): Promise<VizardQueryResponse> {
  const apiKey = resolveVizardApiKey()
  if (!apiKey) {
    throw new Error('VIZARDAI_API_KEY is not configured')
  }

  const res = await fetch(`${VIZARD_PROJECT_ROOT}/query/${encodeURIComponent(projectId)}`, {
    method: 'GET',
    headers: {
      VIZARDAI_API_KEY: apiKey,
    },
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as VizardQueryResponse
  if (!res.ok || (data.code !== 2000 && data.code !== 1000)) {
    throw new Error(vizardUserMessage(data))
  }
  return data
}

export function pickBestVizardVideo(videos: VizardVideo[] | undefined): VizardVideo | null {
  if (!videos?.length) return null
  return [...videos]
    .filter((video) => typeof video.videoUrl === 'string' && /^https?:\/\//i.test(video.videoUrl))
    .sort((a, b) => {
      const aScore = Number(a.viralScore)
      const bScore = Number(b.viralScore)
      return (Number.isFinite(bScore) ? bScore : -1) - (Number.isFinite(aScore) ? aScore : -1)
    })[0] || null
}
