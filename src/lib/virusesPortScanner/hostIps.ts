import os from 'node:os'

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/

export function parsePublicIpText(text: string): string | null {
  const trimmed = text.trim()
  if (!IPV4.test(trimmed)) return null
  const octets = trimmed.split('.').map((part) => Number.parseInt(part, 10))
  if (octets.some((n) => n > 255)) return null
  if (octets[0] === 127 || octets[0] === 10 || octets[0] === 0) return null
  if (octets[0] === 192 && octets[1] === 168) return null
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return null
  return trimmed
}

export function localIpv4Addresses(): string[] {
  const found: string[] = []
  const nets = os.networkInterfaces()
  const names = Object.keys(nets)
  for (let i = 0; i < names.length; i += 1) {
    const addrs = nets[names[i]] || []
    for (let j = 0; j < addrs.length; j += 1) {
      const addr = addrs[j]
      const family = String(addr.family)
      if (addr.internal || (family !== 'IPv4' && family !== '4')) continue
      if (!found.includes(addr.address)) found.push(addr.address)
    }
  }
  return found
}

