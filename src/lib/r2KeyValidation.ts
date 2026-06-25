/** Reject R2 object keys with traversal or unexpected characters. */
export function isSafeR2ObjectKey(key: string): boolean {
  if (!key || key.length > 512) return false
  if (key.includes('..') || key.includes('\\') || key.includes('\0')) return false
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key)) return false
  return key.startsWith('thumbnails/') || key.startsWith('uploads/')
}
