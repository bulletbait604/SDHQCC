import { GoogleGenAI, Modality } from '@google/genai'
import { randomUUID } from 'crypto'
import { putBufferToR2 } from '@/lib/r2'
import {
  aspectRatioLabel,
  type AssetSizeSpec,
  type PanelsBannersOutputMode,
  type PlatformSizeDefaults,
} from '@/lib/panelsBanners/platforms'

const IMAGE_MODEL =
  process.env.PANELS_BANNERS_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'

const IMAGE_MODEL_FALLBACKS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
]

export type ReferenceImage = {
  base64: string
  mimeType: string
}

export type ResearchedSizes = {
  platformId: string
  platformName: string
  banner: AssetSizeSpec
  panel: AssetSizeSpec
  panelCount: number
  researchNotes: string
  sourcesNote: string
  model: string
  profileBanner?: AssetSizeSpec
  panelStyle: 'header' | 'feature'
}

/** Return saved platform sizes — no live LLM lookup. */
export function resolvePlatformAssetSizes(params: {
  platform: PlatformSizeDefaults
  outputMode: PanelsBannersOutputMode
  panelTitleCount?: number
}): ResearchedSizes {
  const { platform, outputMode, panelTitleCount } = params
  const panelCount =
    typeof panelTitleCount === 'number' && panelTitleCount > 0
      ? panelTitleCount
      : platform.panelCount

  const bannerSrc = platform.banner.source ? ` Banner: ${platform.banner.source}.` : ''
  const panelSrc = platform.panel.source ? ` Panel: ${platform.panel.source}.` : ''
  const profileNote = platform.profileBanner
    ? ` Also note profile header ${platform.profileBanner.width}×${platform.profileBanner.height} (${platform.profileBanner.label}) is a separate upload — this tool’s banner output is the offline/player asset.`
    : ''

  return {
    platformId: platform.id,
    platformName: platform.name,
    banner: { ...platform.banner },
    panel: { ...platform.panel },
    panelCount,
    profileBanner: platform.profileBanner ? { ...platform.profileBanner } : undefined,
    panelStyle: platform.panelStyle,
    researchNotes: `Using saved ${platform.name} sizes for ${outputMode}: banner ${platform.banner.width}×${platform.banner.height}, panel ${platform.panel.width}×${platform.panel.height}.${profileNote}`,
    sourcesNote: `${bannerSrc}${panelSrc}`.trim() || 'Saved Creator Corner platform size table.',
    model: 'hardcoded-size-table',
  }
}

export type GeneratedAsset = {
  kind: 'banner' | 'panel'
  label: string
  width: number
  height: number
  mimeType: string
  /** R2 object key — load via /api/image?key=… */
  key: string
  panelIndex?: number
  /** User-selected panel title (panels only) */
  panelTitle?: string
}

export type MockupResult = {
  id: 'mockup-a' | 'mockup-b'
  title: string
  styleBrief: string
  assets: GeneratedAsset[]
}

export type PanelsBannersResult = {
  research: ResearchedSizes
  mockups: MockupResult[]
  outputMode: PanelsBannersOutputMode
  imageModel: string
  textModel: string
}

type MockupStyle = {
  id: 'mockup-a' | 'mockup-b'
  title: string
  styleBrief: string
  artDirection: string
}

const MOCKUP_STYLES: MockupStyle[] = [
  {
    id: 'mockup-a',
    title: 'Mockup A — Neon Esports',
    styleBrief: 'High-energy neon esports branding with bold shapes and max contrast.',
    artDirection: `STYLE LOCK — Mockup A (Neon Esports):
- Aggressive esports / competitive stream brand.
- Neon cyan, magenta, electric lime accents on deep charcoal/black.
- Hard geometric frames, speed lines, angular panels, glossy highlights.
- Bold Impact-style display type only where text is needed; keep copy SHORT.
- High contrast, saturated, scroll-stopping — NOT soft, NOT pastel, NOT photo-realistic lifestyle.`,
  },
  {
    id: 'mockup-b',
    title: 'Mockup B — Cinematic Brand',
    styleBrief: 'Soft cinematic brand kit with elegant type and atmospheric depth.',
    artDirection: `STYLE LOCK — Mockup B (Cinematic Brand):
- Premium cinematic / lifestyle creator brand.
- Muted filmic grades, soft rim light, shallow depth cues, elegant serif or clean modern type.
- Generous negative space, subtle gradients, tasteful grain — NOT neon, NOT cluttered esports HUD.
- Calm confidence; magazine / Netflix-key-art energy rather than tournament overlay energy.
- Very different from neon esports: if A is loud, B must feel quiet and expensive.`,
  },
]

function stripDataUrlPrefix(raw: string): string {
  return raw.replace(/^data:[^;]+;base64,/, '').trim()
}

function isModelNotFoundError(error: unknown): boolean {
  const s = String(error || '').toLowerCase()
  return (
    s.includes('not found') ||
    s.includes('not supported') ||
    s.includes('"code":404') ||
    s.includes('is not supported for generatecontent')
  )
}

async function generateOneImage(params: {
  genAI: GoogleGenAI
  promptText: string
  references: ReferenceImage[]
}): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
  const models = [IMAGE_MODEL, ...IMAGE_MODEL_FALLBACKS].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  )

  const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = []
  for (const ref of params.references.slice(0, 3)) {
    parts.push({
      inlineData: {
        data: stripDataUrlPrefix(ref.base64),
        mimeType: ref.mimeType || 'image/jpeg',
      },
    })
  }
  parts.push({ text: params.promptText })

  let lastError: unknown
  for (const model of models) {
    for (const modalities of [[Modality.IMAGE], [Modality.TEXT, Modality.IMAGE]] as const) {
      try {
        const response = await params.genAI.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: { responseModalities: [...modalities] },
        })
        const outParts = response.candidates?.[0]?.content?.parts ?? []
        const imagePart = outParts.find(
          (p) =>
            p &&
            typeof p === 'object' &&
            'inlineData' in p &&
            (p as { inlineData?: { mimeType?: string } }).inlineData?.mimeType?.startsWith(
              'image/'
            )
        ) as { inlineData?: { data?: string; mimeType?: string } } | undefined

        if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
          throw new Error('Gemini returned no image')
        }
        return {
          buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
          mimeType: imagePart.inlineData.mimeType,
          model,
        }
      } catch (error) {
        lastError = error
        if (!isModelNotFoundError(error) && modalities[0] === Modality.IMAGE) {
          // try next modality combo / model
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Image generation failed')
}

const PANEL_FALLBACK_TITLES = ['About Me', 'Socials', 'Commands']

function buildAssetPrompt(params: {
  platformName: string
  kind: 'banner' | 'panel'
  size: AssetSizeSpec
  userPrompt: string
  style: MockupStyle
  panelTitle?: string
  panelIndex?: number
  panelTotal?: number
}): string {
  const ratio = aspectRatioLabel(params.size.width, params.size.height)

  if (params.kind === 'panel') {
    const title = params.panelTitle || 'Panel'
    const isNarrowHeader = params.size.width <= 400
    return `Create a ${params.platformName} streamer PANEL HEADER image — a short title bar only (NOT a tall info card).

TARGET SIZE (exact): ${params.size.width}x${params.size.height}px (${ratio}).
This is header ${(params.panelIndex ?? 0) + 1} of ${params.panelTotal ?? 1} in a matching set.

PANEL TITLE (must be the hero text, spelled exactly): "${title}"

FORMAT:
- ${isNarrowHeader ? 'Narrow channel panel HEADER (Twitch/Kick style): exactly full panel width, only ~1/5 the height of a tall info panel.' : 'Wide feature HEADER strip for this platform.'}
- Designed or boldly colored background (shapes, arcs, gradients, patterns OK).
- Huge, thick, high-contrast title filling most of the strip — readable at small size.
- Optional tiny left icon/mark from brand colors — NOT platform logos (no Kick/Twitch marks).
- NO body copy, NO bullet lists, NO schedule grids, NO social icon walls, NO tall cards.
- NO fake UI chrome.
- Think: section title bar like a stream "About Me" / "Socials" header graphic.

Creator brief (colors / vibe only — title stays "${title}"):
"""${params.userPrompt.trim() || 'Use the reference images for brand colors and motifs.'}"""

${params.style.artDirection}

Reference images attached — pull palette, motifs, energy. Do not copy trademarks from references.

Hard rules:
- Fill ${params.size.width}x${params.size.height} (${ratio}) edge-to-edge; no letterboxing.
- Keep it short and wide relative to height — never invent a tall portrait panel.
- Title must be huge, readable, correctly spelled: "${title}".
- Output a single finished panel-header image only.`
  }

  return `Create a ${params.platformName} streamer OFFLINE BANNER artwork.

TARGET SIZE (exact intent): ${params.size.width}x${params.size.height}px (${ratio})
Asset label: ${params.size.label}
${params.size.notes ? `Platform notes: ${params.size.notes}` : ''}

This is the full offline screen / channel offline banner viewers see when the stream is not live — compose for ${params.size.width}×${params.size.height}, not a thin profile header strip.

Creator brief:
"""${params.userPrompt.trim() || 'Build a cohesive stream brand kit from the reference images.'}"""

${params.style.artDirection}

Reference images (up to 3) are attached — extract colors, subjects, motifs, and vibe. Do NOT copy logos or trademarks from references; reinterpret as original brand art.

Hard rules:
- Compose for ${params.size.width}x${params.size.height} (${ratio}). Fill the frame; no letterboxing.
- Leave safe margins so UI chrome will not crop critical faces/text.
- Text must be sparse, readable, and spelled correctly. Prefer 3–8 words max.
- No watermarks, no fake UI browser chrome, no Twitch/Kick logos unless the user explicitly asked for platform-neutral shapes.
- Output a single finished offline banner image only.`
}

async function storeGeneratedAsset(params: {
  sessionId: string
  buffer: Buffer
  mimeType: string
  kind: 'banner' | 'panel'
  styleId: string
  panelIndex?: number
}): Promise<string> {
  const ext = params.mimeType.includes('png')
    ? 'png'
    : params.mimeType.includes('webp')
      ? 'webp'
      : 'jpg'
  const suffix =
    params.kind === 'panel' && params.panelIndex != null
      ? `panel-${params.panelIndex + 1}`
      : params.kind
  const key = `thumbnails/panels-banners/${params.sessionId}/${params.styleId}-${suffix}-${randomUUID().slice(0, 8)}.${ext}`
  const ok = await putBufferToR2(key, params.buffer, params.mimeType)
  if (!ok) throw new Error('Failed to store generated asset in R2')
  return key
}

async function generateMockup(params: {
  genAI: GoogleGenAI
  research: ResearchedSizes
  outputMode: PanelsBannersOutputMode
  userPrompt: string
  references: ReferenceImage[]
  style: MockupStyle
  panelTitles: string[]
  sessionId: string
}): Promise<{ mockup: MockupResult; imageModel: string }> {
  const assets: GeneratedAsset[] = []
  let imageModel = IMAGE_MODEL
  const needBanner = params.outputMode === 'banner' || params.outputMode === 'both'
  const needPanels = params.outputMode === 'panels' || params.outputMode === 'both'

  if (needBanner) {
    const out = await generateOneImage({
      genAI: params.genAI,
      references: params.references,
      promptText: buildAssetPrompt({
        platformName: params.research.platformName,
        kind: 'banner',
        size: params.research.banner,
        userPrompt: params.userPrompt,
        style: params.style,
      }),
    })
    imageModel = out.model
    const key = await storeGeneratedAsset({
      sessionId: params.sessionId,
      buffer: out.buffer,
      mimeType: out.mimeType,
      kind: 'banner',
      styleId: params.style.id,
    })
    assets.push({
      kind: 'banner',
      label: `${params.style.title} — ${params.research.banner.label}`,
      width: params.research.banner.width,
      height: params.research.banner.height,
      mimeType: out.mimeType,
      key,
    })
  }

  if (needPanels) {
    const titles =
      params.panelTitles.length > 0 ? params.panelTitles : PANEL_FALLBACK_TITLES.slice(0, 3)
    const panelResults = await Promise.all(
      titles.map(async (panelTitle, i) => {
        const out = await generateOneImage({
          genAI: params.genAI,
          references: params.references,
          promptText: buildAssetPrompt({
            platformName: params.research.platformName,
            kind: 'panel',
            size: params.research.panel,
            userPrompt: params.userPrompt,
            style: params.style,
            panelTitle,
            panelIndex: i,
            panelTotal: titles.length,
          }),
        })
        const key = await storeGeneratedAsset({
          sessionId: params.sessionId,
          buffer: out.buffer,
          mimeType: out.mimeType,
          kind: 'panel',
          styleId: params.style.id,
          panelIndex: i,
        })
        return { i, panelTitle, out, key }
      })
    )
    for (const { i, panelTitle, out, key } of panelResults.sort((a, b) => a.i - b.i)) {
      imageModel = out.model
      assets.push({
        kind: 'panel',
        label: `${params.style.title} — ${panelTitle}`,
        width: params.research.panel.width,
        height: params.research.panel.height,
        mimeType: out.mimeType,
        key,
        panelIndex: i,
        panelTitle,
      })
    }
  }

  return {
    imageModel,
    mockup: {
      id: params.style.id,
      title: params.style.title,
      styleBrief: params.style.styleBrief,
      assets,
    },
  }
}

export async function runPanelsBannersPipeline(params: {
  platform: PlatformSizeDefaults
  outputMode: PanelsBannersOutputMode
  userPrompt: string
  references: ReferenceImage[]
  panelTitles?: string[]
  sessionId?: string
}): Promise<PanelsBannersResult> {
  const apiKey = process.env.GEMINI_API?.trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')
  if (!params.references.length) {
    throw new Error('Upload at least one reference image')
  }

  const needPanels = params.outputMode === 'panels' || params.outputMode === 'both'
  const panelTitles = params.panelTitles?.length
    ? params.panelTitles
    : needPanels
      ? PANEL_FALLBACK_TITLES.slice(0, 3)
      : []
  if (needPanels && panelTitles.length === 0) {
    throw new Error('Select at least one panel title')
  }

  const sessionId = params.sessionId || randomUUID()
  const genAI = new GoogleGenAI({ apiKey })
  const research = resolvePlatformAssetSizes({
    platform: params.platform,
    outputMode: params.outputMode,
    panelTitleCount: needPanels ? panelTitles.length : undefined,
  })

  // Run mockups sequentially to reduce Gemini rate-limit / timeout risk.
  const mockups: MockupResult[] = []
  let imageModel = IMAGE_MODEL
  for (const style of MOCKUP_STYLES) {
    const { mockup, imageModel: used } = await generateMockup({
      genAI,
      research,
      outputMode: params.outputMode,
      userPrompt: params.userPrompt,
      references: params.references,
      style,
      panelTitles,
      sessionId,
    })
    imageModel = used
    mockups.push(mockup)
  }

  return {
    research,
    mockups,
    outputMode: params.outputMode,
    imageModel,
    textModel: research.model,
  }
}
