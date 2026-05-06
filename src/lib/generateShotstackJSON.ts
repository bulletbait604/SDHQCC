import type { SafeZoneOffsets } from '@/lib/platformEditing'

export interface GenerateShotstackInput {
  title?: string
  sourceUrl: string
  captionText?: string
  facecamAssetUrl?: string
  safeZone: SafeZoneOffsets
}

export function generateShotstackJSON({
  title = 'Viral Architect Output',
  sourceUrl,
  captionText,
  facecamAssetUrl,
  safeZone,
}: GenerateShotstackInput) {
  const tracks: Array<{ clips: Array<Record<string, unknown>> }> = [{ clips: [] }]

  tracks[0].clips.push({
    asset: {
      type: 'video',
      src: sourceUrl,
    },
    start: 0,
    length: 90,
    fit: 'cover',
  })

  if (captionText) {
    tracks.push({
      clips: [
        {
          asset: {
            type: 'title',
            text: captionText,
            style: 'minimal',
            size: 'small',
          },
          start: 0,
          length: 90,
          offset: {
            x: safeZone.captionX,
            y: safeZone.captionY,
          },
        },
      ],
    })
  }

  if (facecamAssetUrl) {
    tracks.push({
      clips: [
        {
          asset: {
            type: 'video',
            src: facecamAssetUrl,
          },
          start: 0,
          length: 90,
          scale: 0.28,
          position: 'bottomRight',
          offset: {
            x: safeZone.facecamX,
            y: safeZone.facecamY,
          },
          opacity: 1,
        },
      ],
    })
  }

  return {
    timeline: {
      background: '#000000',
      tracks,
    },
    output: {
      format: 'mp4',
      resolution: 'sd',
      size: {
        width: 1080,
        height: 1920,
      },
    },
    metadata: {
      title,
      safeZoneClearBottomPct: safeZone.clearBottomPct,
    },
  }
}
