/**
 * Client-side checks for Shotstack Edit API schema mistakes before submit.
 * @see https://shotstack.io/docs/api
 */

export function validateShotstackTimeline(timeline: Record<string, unknown>): string[] {
  const errors: string[] = []
  const tracks = timeline.tracks
  if (!Array.isArray(tracks)) return errors

  tracks.forEach((track, trackIndex) => {
    if (!track || typeof track !== 'object') return
    const clips = (track as { clips?: unknown }).clips
    if (!Array.isArray(clips)) return

    clips.forEach((clip, clipIndex) => {
      if (!clip || typeof clip !== 'object') return
      const c = clip as Record<string, unknown>
      const path = `timeline.tracks[${trackIndex}].clips[${clipIndex}]`

      if ('crop' in c) {
        errors.push(`Unknown property "crop" at ${path} — use ${path}.asset.crop for video`)
      }

      const asset = c.asset
      if (!asset || typeof asset !== 'object') return
      const a = asset as Record<string, unknown>
      const assetPath = `${path}.asset`

      if (a.type === 'rich-caption') {
        if ('wrap' in a) {
          errors.push(
            `Unknown property "wrap" at ${assetPath} — set ${assetPath}.background.wrap for rich-caption`
          )
        }
        if ('alignment' in a) {
          errors.push(
            `Unknown property "alignment" at ${assetPath} — rich-caption uses "align" not "alignment"`
          )
        }
      }

    })
  })

  return errors
}

export function assertValidShotstackTimeline(timeline: Record<string, unknown>): void {
  const errors = validateShotstackTimeline(timeline)
  if (errors.length > 0) {
    throw new Error(`Shotstack timeline validation: ${errors.slice(0, 5).join('; ')}`)
  }
}
