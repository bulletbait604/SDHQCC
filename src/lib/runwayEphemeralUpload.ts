import RunwayML, { toFile } from '@runwayml/sdk'

/**
 * Upload bytes to Runway's ephemeral storage (~200MB limit per provider docs)
 * and receive a URI usable as videoUri / promptVideo instead of a public HTTPS URL
 * (avoids Runway's small HTTPS video URL fetch cap).
 */
export async function runwayEphemeralVideoUriFromBuffer(
  client: RunwayML,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const safeName = filename.replace(/[/\\]/g, '_').slice(0, 200) || 'clip.mp4'
  const type =
    mimeType.startsWith('video/') || mimeType === 'application/octet-stream'
      ? mimeType === 'application/octet-stream'
        ? 'video/mp4'
        : mimeType
      : 'video/mp4'

  const file = await toFile(buffer, safeName, { type })
  const { uri } = await client.uploads.createEphemeral({ file })
  return uri
}
