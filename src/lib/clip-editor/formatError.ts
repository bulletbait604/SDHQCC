/** Pull a useful message from API/SDK errors (Gemini often throws only "Bad Request"). */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const e = error as Error & {
      status?: number
      statusText?: string
      code?: string | number
      cause?: unknown
      errorDetails?: unknown
      response?: { status?: number; statusText?: string; data?: unknown }
    }

    const parts: string[] = []
    if (e.message && e.message !== 'Bad Request') {
      parts.push(e.message)
    } else if (e.message) {
      parts.push(e.message)
    }

    const httpStatus = e.status ?? e.response?.status
    if (httpStatus) parts.push(`HTTP ${httpStatus}`)
    if (e.statusText && e.statusText !== e.message) parts.push(e.statusText)
    if (e.code !== undefined && e.code !== '') parts.push(`code ${String(e.code)}`)

    if (e.errorDetails) {
      try {
        parts.push(JSON.stringify(e.errorDetails).slice(0, 400))
      } catch {
        /* ignore */
      }
    }

    if (e.response?.data) {
      try {
        parts.push(JSON.stringify(e.response.data).slice(0, 400))
      } catch {
        /* ignore */
      }
    }

    if (e.cause) {
      const causeMsg = formatUnknownError(e.cause)
      if (causeMsg && !parts.includes(causeMsg)) parts.push(causeMsg)
    }

    const merged = parts.filter(Boolean).join(' — ')
    return merged || e.message || 'Unknown error'
  }

  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error).slice(0, 400)
  } catch {
    return 'Unknown error'
  }
}
