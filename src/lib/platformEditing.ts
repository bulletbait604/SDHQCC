export type TargetPlatform = 'tiktok' | 'youtube' | 'reels'

export interface SafeZoneOffsets {
  captionX: number
  captionY: number
  facecamX: number
  facecamY: number
  clearBottomPct: number
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

export function platformSafeZoneOffsets(platform: TargetPlatform): SafeZoneOffsets {
  if (platform === 'youtube') {
    return {
      captionX: 0,
      captionY: -0.18,
      facecamX: 0,
      facecamY: -0.12,
      clearBottomPct: 20,
    }
  }
  if (platform === 'reels') {
    return {
      captionX: 0,
      captionY: -0.14,
      facecamX: 0,
      facecamY: -0.1,
      clearBottomPct: 16,
    }
  }
  return {
    captionX: -0.16,
    captionY: -0.1,
    facecamX: -0.12,
    facecamY: -0.06,
    clearBottomPct: 18,
  }
}
