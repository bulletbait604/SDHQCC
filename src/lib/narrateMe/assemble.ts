import { NARRATE_ME_SAMPLE_RATE } from '@/lib/narrateMe/config'
import type { VoiceSegment } from '@/lib/narrateMe/types'

function writeAscii(buf: Buffer, offset: number, text: string) {
  buf.write(text, offset, 'ascii')
}

export function pcmToWav(pcm: Buffer, sampleRate = NARRATE_ME_SAMPLE_RATE, channels = 1): Buffer {
  const header = Buffer.alloc(44)
  const dataSize = pcm.length
  writeAscii(header, 0, 'RIFF')
  header.writeUInt32LE(36 + dataSize, 4)
  writeAscii(header, 8, 'WAVE')
  writeAscii(header, 12, 'fmt ')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * 2, 28)
  header.writeUInt16LE(channels * 2, 32)
  header.writeUInt16LE(16, 34)
  writeAscii(header, 36, 'data')
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcm])
}

export function assembleAlignedPcm(params: {
  segments: Array<{ sourceStart: number; pcm: Buffer }>
  durationSeconds: number
  sampleRate?: number
}): Buffer {
  const sampleRate = params.sampleRate || NARRATE_ME_SAMPLE_RATE
  const totalSamples = Math.max(1, Math.ceil(params.durationSeconds * sampleRate))
  const out = Buffer.alloc(totalSamples * 2)

  for (const segment of params.segments) {
    const startSample = Math.max(0, Math.round(segment.sourceStart * sampleRate))
    const src = segment.pcm
    const maxBytes = Math.max(0, out.length - startSample * 2)
    if (maxBytes <= 0) continue
    src.copy(out, startSample * 2, 0, Math.min(src.length, maxBytes))
  }
  return out
}

export function voiceDurationSeconds(pcmLength: number, sampleRate = NARRATE_ME_SAMPLE_RATE): number {
  return pcmLength / 2 / sampleRate
}

export function zipStore(files: Array<{ name: string; data: Buffer | string }>): Buffer {
  const entries: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8')
    const data = typeof file.data === 'string' ? Buffer.from(file.data, 'utf8') : file.data
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(0, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    name.copy(local, 30)

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(0, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)

    const blob = Buffer.concat([local, data])
    entries.push(blob)
    centrals.push(central)
    offset += blob.length
  }

  const centralDir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDir.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...entries, centralDir, end])
}

export function capcutZipFiles(params: {
  wav: Buffer
  mp3?: Buffer | null
  srt: string
  vtt: string
  readme: string
}): Array<{ name: string; data: Buffer | string }> {
  const files: Array<{ name: string; data: Buffer | string }> = [
    { name: 'Narrate_Me/NARRATION_FULL.wav', data: params.wav },
    { name: 'Narrate_Me/CAPTIONS.srt', data: params.srt },
    { name: 'Narrate_Me/CAPTIONS.vtt', data: params.vtt },
    { name: 'Narrate_Me/README.txt', data: params.readme },
  ]
  if (params.mp3 && params.mp3.length > 0) {
    files.splice(1, 0, { name: 'Narrate_Me/NARRATION_FULL.mp3', data: params.mp3 })
  }
  return files
}

export function segmentsForAssembly(segments: VoiceSegment[]): VoiceSegment[] {
  return [...segments].filter((s) => s.audioKey).sort((a, b) => a.sourceStart - b.sourceStart)
}
