export async function poolMap<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next
      next += 1
      out[i] = await fn(items[i])
    }
  }
  const n = Math.max(1, Math.min(size, items.length || 1))
  await Promise.all(Array.from({ length: items.length ? n : 1 }, () => worker()))
  return out
}

export async function gw2GetMany<T>(
  fetchChunk: (ids: number[]) => Promise<T[]>,
  ids: readonly number[],
  chunkSize = 200,
  concurrency = 4
): Promise<T[]> {
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize))
  }
  const parts = await poolMap(chunks, concurrency, fetchChunk)
  const out: T[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const rows = parts[i]
    if (Array.isArray(rows)) out.push(...rows)
  }
  return out
}
