import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

const MODEL_ID = 'fal-ai/imageutils/rembg'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

type FalImage = {
  url?: string
  content_type?: string
  file_name?: string
  file_size?: number
  width?: number
  height?: number
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || ''
  return Math.floor((base64.length * 3) / 4)
}

function readFalImage(result: unknown): FalImage | null {
  const root = result as { data?: unknown; image?: unknown } | null
  const data = root?.data as { image?: FalImage } | undefined
  const direct = root?.image as FalImage | undefined
  const image = data?.image || direct
  return image?.url ? image : null
}

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request)

    const falKey = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim()
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY or FAL_API_KEY is not configured' },
        { status: 503 }
      )
    }

    const body = (await request.json()) as {
      imageDataUrl?: string
      keepPrompt?: string
      cropToSubject?: boolean
    }

    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : ''
    if (!imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'imageDataUrl is required' }, { status: 400 })
    }
    if (estimateDataUrlBytes(imageDataUrl) > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image is too large. Use an image under 10MB.' }, { status: 400 })
    }

    fal.config({ credentials: falKey })
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        image_url: imageDataUrl,
        crop_to_bbox: Boolean(body.cropToSubject),
        sync_mode: false,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          for (const log of update.logs ?? []) {
            console.log('[BackgroundRemover][Fal]', log.message)
          }
        }
      },
    })

    const image = readFalImage(result)
    if (!image?.url) {
      return NextResponse.json({ error: 'Fal background remover returned no image URL.' }, { status: 502 })
    }

    const promptWasProvided =
      typeof body.keepPrompt === 'string' && body.keepPrompt.trim().length > 0
    return NextResponse.json({
      imageUrl: image.url,
      mimeType: image.content_type || 'image/png',
      fileName: image.file_name || 'background-removed.png',
      width: image.width || null,
      height: image.height || null,
      model: MODEL_ID,
      promptNote: promptWasProvided
        ? 'fal-ai/imageutils/rembg auto-detects the foreground subject; the keep-object prompt is saved in the request but is not a supported model input.'
        : null,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[background-remover]', error)
    const message = error instanceof Error ? error.message : 'Background removal failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
