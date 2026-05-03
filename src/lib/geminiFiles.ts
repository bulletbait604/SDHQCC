/**
 * Server-side Gemini Files API (same flow as client resumable upload, uses GEMINI_API).
 */

const FILES_UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files'

export async function uploadBufferToGeminiFilesApi(params: {
  apiKey: string
  buffer: Buffer
  mimeType: string
  displayName: string
}): Promise<{ uri: string; name: string }> {
  const { apiKey, buffer, mimeType, displayName } = params

  const start = await fetch(FILES_UPLOAD, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  })

  if (!start.ok) {
    const t = await start.text()
    throw new Error(`Gemini upload start failed: ${start.status} ${t.slice(0, 500)}`)
  }

  const uploadUrl = start.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) {
    throw new Error('Gemini upload: missing X-Goog-Upload-URL')
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': mimeType,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
    },
    body: new Uint8Array(buffer),
  })

  if (!uploadRes.ok) {
    const t = await uploadRes.text()
    throw new Error(`Gemini upload bytes failed: ${uploadRes.status} ${t.slice(0, 500)}`)
  }

  const uploadData = (await uploadRes.json()) as {
    file?: { uri?: string; name?: string }
  }
  const uri = uploadData.file?.uri
  const name = uploadData.file?.name
  if (!uri || !name) {
    throw new Error('Gemini upload: missing file.uri or file.name in response')
  }
  return { uri, name }
}

export async function pollGeminiFileUntilActive(
  apiKey: string,
  fileUri: string,
  options?: { maxRetries?: number; retryDelayMs?: number }
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 30
  const retryDelayMs = options?.retryDelayMs ?? 2000

  const id = fileUri.split('/').pop()
  if (!id) throw new Error('Invalid fileUri for polling')

  let fileState = 'PROCESSING'
  let retryCount = 0

  while (fileState !== 'ACTIVE' && fileState !== 'FAILED' && retryCount < maxRetries) {
    await new Promise((r) => setTimeout(r, retryDelayMs))
    retryCount++

    const statusRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET' }
    )

    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as {
        state?: string
        file?: { state?: string }
      }
      fileState = statusData.state ?? statusData.file?.state ?? fileState
    }
  }

  if (fileState !== 'ACTIVE') {
    throw new Error(`Gemini file did not become ACTIVE (state: ${fileState})`)
  }
}

/** `name` is e.g. `files/abc123` from upload response */
export async function deleteGeminiUploadedFile(apiKey: string, name: string): Promise<void> {
  const id = name.includes('/') ? name.split('/').pop()! : name
  const url = `https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const t = await res.text().catch(() => '')
    console.warn('[geminiFiles] delete non-OK:', res.status, t.slice(0, 200))
  }
}
