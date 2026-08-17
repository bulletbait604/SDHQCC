import { GoogleGenAI, Modality } from '@google/genai'
import {
  aspectRatioLabel,
  type AssetSizeSpec,
  type PanelsBannersOutputMode,
  type PlatformSizeDefaults,
} from '@/lib/panelsBanners/platforms'

const TEXT_MODEL =
  process.env.PANELS_BANNERS_TEXT_MODEL?.trim() || 'gemini-2.5-flash'
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
}

export type GeneratedAsset = {
  kind: 'banner' | 'panel'
  label: string
  width: number
  height: number
  mimeType: string
  /** data URL for immediate UI preview/download */
  dataUrl: string
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

function extractJsonObject(raw: string): unknown {
  const clean = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Research response was not JSON')
  }
  return JSON.parse(clean.slice(start, end + 1))
}

function clampSize(n: unknown, fallback: number, min = 64, max = 4096): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.round(v)))
}

export async function researchPlatformAssetSizes(params: {
  platform: PlatformSizeDefaults
  outputMode: PanelsBannersOutputMode
}): Promise<ResearchedSizes> {
  const apiKey = process.env.GEMINI_API?.trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const genAI = new GoogleGenAI({ apiKey })
  const { platform, outputMode } = params

  const prompt = `You are a streaming-platform brand designer and docs researcher.

Platform: ${platform.name} (id: ${platform.id})
User wants: ${outputMode === 'both' ? 'offline/profile BANNER and info PANELS' : outputMode}

Our current defaults (verify / refine — do not invent impossible sizes):
- Banner default: ${platform.banner.width}x${platform.banner.height} (${platform.banner.label}) — ${platform.banner.notes || ''}
- Panel default: ${platform.panel.width}x${platform.panel.height} (${platform.panel.label}) — ${platform.panel.notes || ''}

Return ONLY JSON:
{
  "bannerWidth": number,
  "bannerHeight": number,
  "bannerLabel": string,
  "bannerNotes": string,
  "panelWidth": number,
  "panelHeight": number,
  "panelLabel": string,
  "panelNotes": string,
  "panelCount": number,
  "researchNotes": "2-4 sentences on official or commonly accepted sizes for offline/profile banners and panels on this platform",
  "sourcesNote": "what you based this on (official docs / common creator practice)"
}

Rules:
- Prefer official published pixel sizes when known.
- Twitch offline banners are typically 1920x1080; Twitch panels ~320px wide.
- YouTube channel art is typically 2560x1440 with a smaller safe zone.
- panelCount should be 3 unless the platform clearly uses a different set.
- If unsure, keep our defaults and say so in researchNotes.`

  const response = await genAI.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })

  const text = response.text?.trim() || ''
  let parsed: Record<string, unknown> = {}
  try {
    parsed = extractJsonObject(text) as Record<string, unknown>
  } catch {
    parsed = {}
  }

  return {
    platformId: platform.id,
    platformName: platform.name,
    banner: {
      width: clampSize(parsed.bannerWidth, platform.banner.width),
      height: clampSize(parsed.bannerHeight, platform.banner.height),
      label:
        typeof parsed.bannerLabel === 'string' && parsed.bannerLabel.trim()
          ? parsed.bannerLabel.trim()
          : platform.banner.label,
      notes:
        typeof parsed.bannerNotes === 'string' && parsed.bannerNotes.trim()
          ? parsed.bannerNotes.trim()
          : platform.banner.notes,
    },
    panel: {
      width: clampSize(parsed.panelWidth, platform.panel.width),
      height: clampSize(parsed.panelHeight, platform.panel.height),
      label:
        typeof parsed.panelLabel === 'string' && parsed.panelLabel.trim()
          ? parsed.panelLabel.trim()
          : platform.panel.label,
      notes:
        typeof parsed.panelNotes === 'string' && parsed.panelNotes.trim()
          ? parsed.panelNotes.trim()
          : platform.panel.notes,
    },
    panelCount: Math.max(
      1,
      Math.min(5, clampSize(parsed.panelCount, platform.panelCount, 1, 5))
    ),
    researchNotes:
      typeof parsed.researchNotes === 'string' && parsed.researchNotes.trim()
        ? parsed.researchNotes.trim()
        : `Using verified defaults for ${platform.name} ${outputMode} assets.`,
    sourcesNote:
      typeof parsed.sourcesNote === 'string' && parsed.sourcesNote.trim()
        ? parsed.sourcesNote.trim()
        : 'Merged Gemini research with Creator Corner platform defaults.',
    model: TEXT_MODEL,
  }
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
  const roleLine =
    params.kind === 'panel' && params.panelTitle
      ? `PANEL TITLE (must appear clearly on the artwork): "${params.panelTitle}"
This is panel ${(params.panelIndex ?? 0) + 1} of ${params.panelTotal ?? 1} in a matching set.
Design the panel specifically for that title's purpose (e.g. PC Specs → hardware vibe; Donations → tip/support; Commands → chat commands; Blerps → soundboard; Throne → wishlist/gifts; Socials → icons/handles; Merch → shop; About Me → intro).`
      : ''

  return `Create a ${params.platformName} streamer ${params.kind} artwork.

TARGET SIZE (exact intent): ${params.size.width}x${params.size.height}px (${ratio})
Asset label: ${params.size.label}
${params.size.notes ? `Platform notes: ${params.size.notes}` : ''}
${roleLine}

Creator brief:
"""${params.userPrompt.trim() || 'Build a cohesive stream brand kit from the reference images.'}"""

${params.style.artDirection}

Reference images (up to 3) are attached — extract colors, subjects, motifs, and vibe. Do NOT copy logos or trademarks from references; reinterpret as original brand art.

Hard rules:
- Compose for ${params.size.width}x${params.size.height} (${ratio}). Fill the frame; no letterboxing.
- Leave safe margins so UI chrome will not crop critical faces/text.
- Text must be sparse, readable, and spelled correctly. Prefer 3–8 words max on banners; panels should feature the panel title prominently.
- No watermarks, no fake UI browser chrome, no Twitch/Kick logos unless the user explicitly asked for platform-neutral shapes.
- Output a single finished ${params.kind} image only.`
}

async function generateMockup(params: {
  genAI: GoogleGenAI
  research: ResearchedSizes
  outputMode: PanelsBannersOutputMode
  userPrompt: string
  references: ReferenceImage[]
  style: MockupStyle
  panelTitles: string[]
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
    assets.push({
      kind: 'banner',
      label: `${params.style.title} — ${params.research.banner.label}`,
      width: params.research.banner.width,
      height: params.research.banner.height,
      mimeType: out.mimeType,
      dataUrl: `data:${out.mimeType};base64,${out.buffer.toString('base64')}`,
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
        return { i, panelTitle, out }
      })
    )
    for (const { i, panelTitle, out } of panelResults.sort((a, b) => a.i - b.i)) {
      imageModel = out.model
      assets.push({
        kind: 'panel',
        label: `${params.style.title} — ${panelTitle}`,
        width: params.research.panel.width,
        height: params.research.panel.height,
        mimeType: out.mimeType,
        dataUrl: `data:${out.mimeType};base64,${out.buffer.toString('base64')}`,
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

  const genAI = new GoogleGenAI({ apiKey })
  const research = await researchPlatformAssetSizes({
    platform: params.platform,
    outputMode: params.outputMode,
  })
  // Honor user-selected panel count over researched default.
  if (needPanels) {
    research.panelCount = panelTitles.length
  }

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
    })
    imageModel = used
    mockups.push(mockup)
  }

  return {
    research,
    mockups,
    outputMode: params.outputMode,
    imageModel,
    textModel: TEXT_MODEL,
  }
}
