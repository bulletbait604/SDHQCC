/** Parse a fetch Response as JSON; HTML error pages become a readable Error. */
export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    if (res.status === 413 || /request entity too large/i.test(text)) {
      throw new Error('Upload too large for the server. Try a shorter clip or a smaller image.')
    }
    if (res.status === 504 || res.status === 502 || res.status === 503) {
      throw new Error('The service timed out. Try again.')
    }
    throw new Error('The service failed before returning a result. Please try again.')
  }
}
