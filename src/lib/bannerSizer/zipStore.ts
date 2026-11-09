export interface ZipEntry {
  name: string
  data: Uint8Array
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (~crc) >>> 0
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
}

function safeName(name: string): string {
  const cleaned = name.replace(/\\/g, '/').replace(/[^\x20-\x7E]/g, '_').replace(/^\/+/, '')
  return cleaned.slice(0, 180) || 'banner.jpg'
}

/** ZIP archive using the store method. JPEG and PNG are already compressed. */
export function zipStore(entries: ZipEntry[], now = new Date()): Uint8Array {
  const stamp = dosDateTime(now)
  const locals: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = safeName(entry.name)
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(entry.data)
    const local = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(local.buffer)
    u32(localView, 0, 0x04034b50)
    u16(localView, 4, 20)
    u16(localView, 6, 0)
    u16(localView, 8, 0)
    u16(localView, 10, stamp.time)
    u16(localView, 12, stamp.date)
    u32(localView, 14, crc)
    u32(localView, 18, entry.data.length)
    u32(localView, 22, entry.data.length)
    u16(localView, 26, nameBytes.length)
    u16(localView, 28, 0)
    local.set(nameBytes, 30)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    u32(centralView, 0, 0x02014b50)
    u16(centralView, 4, 20)
    u16(centralView, 6, 20)
    u16(centralView, 8, 0)
    u16(centralView, 10, 0)
    u16(centralView, 12, stamp.time)
    u16(centralView, 14, stamp.date)
    u32(centralView, 16, crc)
    u32(centralView, 20, entry.data.length)
    u32(centralView, 24, entry.data.length)
    u16(centralView, 28, nameBytes.length)
    u16(centralView, 30, 0)
    u16(centralView, 32, 0)
    u16(centralView, 34, 0)
    u16(centralView, 36, 0)
    u32(centralView, 38, 0)
    u32(centralView, 42, offset)
    centralHeader.set(nameBytes, 46)

    locals.push(local, entry.data)
    central.push(centralHeader)
    offset += local.length + entry.data.length
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  u32(endView, 0, 0x06054b50)
  u16(endView, 4, 0)
  u16(endView, 6, 0)
  u16(endView, 8, entries.length)
  u16(endView, 10, entries.length)
  u32(endView, 12, centralSize)
  u32(endView, 16, offset)
  u16(endView, 20, 0)

  const total = offset + centralSize + end.length
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of locals) {
    out.set(part, cursor)
    cursor += part.length
  }
  for (const part of central) {
    out.set(part, cursor)
    cursor += part.length
  }
  out.set(end, cursor)
  return out
}
