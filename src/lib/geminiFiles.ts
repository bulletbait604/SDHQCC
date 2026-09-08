/**
 * Server-side Gemini Files API (same flow as client resumable upload, uses GEMINI_API).
 * Gemini generateContent fileUri only accepts Files API / YouTube / GCS URIs — not R2 signed URLs.
 */

const FILES_UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files'
/** Documented Files API per-file cap. */
export const GEMINI_FILES_MAX_BYTES = 2 * 1024 * 1024 * 1024
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024

type GeminiFileRef = { uri: string; name: string }

async function startGeminiResumableUpload(params: {
  apiKey: string
  sizeBytes: number
  mimeType: string
  displayName: string
}): Promise<string> {
  const start = await fetch(FILES_UPLOAD, {
    method: 'POST',
    headers: {
      'x-goog-api-key': params.apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(params.sizeBytes),
      'X-Goog-Upload-Header-Content-Type': params.mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: params.displayName } }),
  })

  if (!start.ok) {
    const t = await start.text()
    throw new Error(`Gemini upload start failed: ${start.status} ${t.slice(0, 500)}`)
  }

  const uploadUrl = start.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) {
    throw new Error('Gemini upload: missing X-Goog-Upload-URL')
  }
  return uploadUrl
}

function parseGeminiFileResponse(data: { file?: { uri?: string; name?: string } }): GeminiFileRef {
  const uri = data.file?.uri
  const name = data.file?.name
  if (!uri || !name) {
    throw new Error('Gemini upload: missing file.uri or file.name in response')
  }
  return { uri, name }
}

export async function uploadBufferToGeminiFilesApi(params: {
  apiKey: string
  buffer: Buffer
  mimeType: string
  displayName: string
}): Promise<GeminiFileRef> {
  const { apiKey, buffer, mimeType, displayName } = params
  const uploadUrl = await startGeminiResumableUpload({
    apiKey,
    sizeBytes: buffer.length,
    mimeType,
    displayName,
  })

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

  const uploadData = (await uploadRes.json()) as { file?: { uri?: string; name?: string } }
  return parseGeminiFileResponse(uploadData)
}

export async function uploadIterableToGeminiFilesApi(params: {
  apiKey: string
  body: AsyncIterable<Uint8Array | Buffer> | Iterable<Uint8Array | Buffer>
  sizeBytes: number
  mimeType: string
  displayName: string
}): Promise<GeminiFileRef> {
  const { apiKey, mimeType, displayName } = params
  const sizeBytes = params.sizeBytes
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error('Gemini upload: missing file size')
  }
  if (sizeBytes > GEMINI_FILES_MAX_BYTES) {
    throw new Error('This video is too large for analysis (2 GB max). Export a smaller file and retry.')
  }

  const uploadUrl = await startGeminiResumableUpload({
    apiKey,
    sizeBytes,
    mimeType,
    displayName,
  })

  let offset = 0
  let pending = Buffer.alloc(0)

  const sendChunk = async (chunk: Buffer, finalize: boolean): Promise<Response> => {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': mimeType,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': finalize ? 'upload, finalize' : 'upload',
        'X-Goog-Upload-Offset': String(offset),
      },
      body: new Uint8Array(chunk),
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Gemini upload bytes failed: ${res.status} ${t.slice(0, 500)}`)
    }
    return res
  }

  for await (const piece of params.body) {
    pending = Buffer.concat([pending, Buffer.isBuffer(piece) ? piece : Buffer.from(piece)])
    while (pending.length >= UPLOAD_CHUNK_BYTES && offset + UPLOAD_CHUNK_BYTES < sizeBytes) {
      const chunk = pending.subarray(0, UPLOAD_CHUNK_BYTES)
      pending = pending.subarray(UPLOAD_CHUNK_BYTES)
      await sendChunk(chunk, false)
      offset += chunk.length
    }
  }

  const finalRes = await sendChunk(pending, true)
  const uploadData = (await finalRes.json()) as { file?: { uri?: string; name?: string } }
  return parseGeminiFileResponse(uploadData)
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
