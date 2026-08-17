import { GoogleGenAI, Modality } from '@google/genai'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
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

/** Gemini Flash Image supported aspect ratios. */
const GEMINI_ASPECT_RATIOS = [
  '1:1',
  '3:2',
  '2:3',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const

type GeminiAspectRatio = (typeof GEMINI_ASPECT_RATIOS)[number]

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
  /** Locked hex palette — every asset in this mockup must use these colors. */
  paletteLock: string
}

const MOCKUP_STYLES: MockupStyle[] = [
  {
    id: 'mockup-a',
    title: 'Mockup A — Neon Esports',
    styleBrief: 'High-energy neon esports branding with bold shapes and max contrast.',
    paletteLock:
      'LOCKED PALETTE (use these exact colors for EVERY asset in this mockup set): background #0B0F14, accent A #00F0FF, accent B #FF2BD6, accent C #B8FF3D, text #FFFFFF, shadow #000000.',
    artDirection: `STYLE LOCK — Mockup A (Neon Esports):
- Aggressive esports / competitive stream brand.
- Neon cyan, magenta, electric lime accents on deep charcoal/black.
- Hard geometric frames, speed lines, angular panels, glossy highlights.
- Bold Impact-style display type only where text is needed; keep copy SHORT.
- High contrast, saturated, scroll-stopping — NOT soft, NOT pastel, NOT photo-realistic lifestyle.
- All panels in this set must share ONE identical background treatment and layout — only the title text changes.`,
  },
  {
    id: 'mockup-b',
    title: 'Mockup B — Cinematic Brand',
    styleBrief: 'Soft cinematic brand kit with elegant type and atmospheric depth.',
    paletteLock:
      'LOCKED PALETTE (use these exact colors for EVERY asset in this mockup set): background #1A1512, accent A #C4A574, accent B #E8DCC8, accent C #5C6B73, text #F5F0E8, shadow #0A0806.',
    artDirection: `STYLE LOCK — Mockup B (Cinematic Brand):
- Premium cinematic / lifestyle creator brand.
- Muted filmic grades, soft rim light, shallow depth cues, elegant serif or clean modern type.
- Generous negative space, subtle gradients, tasteful grain — NOT neon, NOT cluttered esports HUD.
- Calm confidence; magazine / Netflix-key-art energy rather than tournament overlay energy.
- Very different from neon esports: if A is loud, B must feel quiet and expensive.
- All panels in this set must share ONE identical background treatment and layout — only the title text changes.`,
  },
]

function stripDataUrlPrefix(raw: string): string {
  return raw.replace(/^data:[^;]+;base64,/, '').trim()
}

function nearestGeminiAspectRatio(width: number, height: number): GeminiAspectRatio {
  const target = width / Math.max(1, height)
  let best: GeminiAspectRatio = '16:9'
  let bestDiff = Number.POSITIVE_INFINITY
  for (const label of GEMINI_ASPECT_RATIOS) {
    const [a, b] = label.split(':').map(Number)
    const r = a / b
    const diff = Math.abs(r - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = label
    }
  }
  return best
}

/** Force exact pixel dimensions (cover + center crop). Always PNG for crisp text. */
async function resizeToExactSize(
  buffer: Buffer,
  width: number,
  height: number
): Promise<{ buffer: Buffer; mimeType: string }> {
  const out = await sharp(buffer)
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 8 })
    .toBuffer()
  return { buffer: out, mimeType: 'image/png' }
}

async function generateOneImage(params: {
  genAI: GoogleGenAI
  promptText: string
  references: ReferenceImage[]
  targetWidth: number
  targetHeight: number
}): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
  const models = [IMAGE_MODEL, ...IMAGE_MODEL_FALLBACKS].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  )
  const aspectRatio = nearestGeminiAspectRatio(params.targetWidth, params.targetHeight)

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
          config: {
            responseModalities: [...modalities],
            imageConfig: { aspectRatio },
          },
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
        const raw = Buffer.from(imagePart.inlineData.data, 'base64')
        const resized = await resizeToExactSize(raw, params.targetWidth, params.targetHeight)
        return {
          buffer: resized.buffer,
          mimeType: resized.mimeType,
          model,
        }
      } catch (error) {
        lastError = error
        // Retry without imageConfig if the SDK/model rejects it.
        if (
          String(error).toLowerCase().includes('imageconfig') ||
          String(error).toLowerCase().includes('aspect')
        ) {
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
            if (!imagePart?.inlineData?.data) throw error
            const raw = Buffer.from(imagePart.inlineData.data, 'base64')
            const resized = await resizeToExactSize(raw, params.targetWidth, params.targetHeight)
            return { buffer: resized.buffer, mimeType: resized.mimeType, model }
          } catch (inner) {
            lastError = inner
          }
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
  /** When set, this is a text-swap edit of an existing panel template. */
  matchTemplate?: boolean
}): string {
  const ratio = aspectRatioLabel(params.size.width, params.size.height)
  const geminiRatio = nearestGeminiAspectRatio(params.size.width, params.size.height)

  if (params.kind === 'panel') {
    const title = params.panelTitle || 'Panel'
    const isNarrowHeader = params.size.width <= 400

    if (params.matchTemplate) {
      return `EDIT the attached TEMPLATE panel header image.

Keep EVERYTHING identical except the title text:
- Same background colors, shapes, layout, margins, font style, effects.
- Same exact canvas size feel (${params.size.width}x${params.size.height}, ${ratio}).
- ONLY change the displayed title to exactly: "${title}"

Do not redesign. Do not recolor. Do not change composition. Text swap only.
Output a single panel-header image.`
    }

    return `Create a ${params.platformName} streamer PANEL HEADER — short title bar only (NOT a tall info card).

EXACT OUTPUT SIZE REQUIRED: ${params.size.width}×${params.size.height}px (${ratio}). Requested model aspect ${geminiRatio}; fill the entire frame edge-to-edge.
This is panel header 1 of ${params.panelTotal ?? 1} — it is the MASTER TEMPLATE for the whole matching set.

PANEL TITLE (hero text, spelled exactly): "${title}"

${params.style.paletteLock}

FORMAT:
- ${isNarrowHeader ? `Twitch/Kick panel HEADER: ${params.size.width}px wide × ${params.size.height}px tall (~1/5 of a full info panel).` : `Feature HEADER strip: ${params.size.width}×${params.size.height}.`}
- One solid designed background (flat color blocks / bold shapes OK).
- Huge high-contrast title; optional tiny left mark from brand colors (NO platform logos).
- NO body copy, lists, schedules, icon walls, tall cards, or fake UI.

Creator brief (vibe only — title stays "${title}"):
"""${params.userPrompt.trim() || 'Use reference images for motifs; still obey the locked palette.'}"""

${params.style.artDirection}

Hard rules:
- Canvas must read as ${params.size.width}×${params.size.height} (${ratio}).
- Title exactly "${title}".
- Output one finished panel-header image.`
  }

  return `Create a ${params.platformName} OFFLINE BANNER.

EXACT OUTPUT SIZE REQUIRED: ${params.size.width}×${params.size.height}px (${ratio}). Requested model aspect ${geminiRatio}; fill the entire frame — no letterboxing, no thin strip.
Asset: ${params.size.label}
${params.size.notes ? `Notes: ${params.size.notes}` : ''}

${params.style.paletteLock}

This is the full offline / player / cover banner — compose for ${params.size.width}×${params.size.height}, NOT a panel header.

Creator brief:
"""${params.userPrompt.trim() || 'Build cohesive brand art from the references while obeying the locked palette.'}"""

${params.style.artDirection}

Hard rules:
- Full-bleed ${params.size.width}×${params.size.height} (${ratio}).
- Sparse readable text (3–8 words max).
- No watermarks / fake UI / platform logos unless asked.
- Output one finished offline banner.`
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
      targetWidth: params.research.banner.width,
      targetHeight: params.research.banner.height,
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

    // Master panel first — later panels are title-swap edits so size/color stay uniform.
    let masterBuffer: Buffer | null = null
    let masterMime = 'image/png'

    for (let i = 0; i < titles.length; i++) {
      const panelTitle = titles[i]
      const isMaster = i === 0
      const refs: ReferenceImage[] = isMaster
        ? params.references
        : [
            {
              base64: masterBuffer!.toString('base64'),
              mimeType: masterMime,
            },
            ...params.references.slice(0, 2),
          ]

      const out = await generateOneImage({
        genAI: params.genAI,
        references: refs,
        targetWidth: params.research.panel.width,
        targetHeight: params.research.panel.height,
        promptText: buildAssetPrompt({
          platformName: params.research.platformName,
          kind: 'panel',
          size: params.research.panel,
          userPrompt: params.userPrompt,
          style: params.style,
          panelTitle,
          panelIndex: i,
          panelTotal: titles.length,
          matchTemplate: !isMaster,
        }),
      })
      imageModel = out.model
      if (isMaster) {
        masterBuffer = out.buffer
        masterMime = out.mimeType
      }

      const key = await storeGeneratedAsset({
        sessionId: params.sessionId,
        buffer: out.buffer,
        mimeType: out.mimeType,
        kind: 'panel',
        styleId: params.style.id,
        panelIndex: i,
      })
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
