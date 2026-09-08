import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { access, mkdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { getR2ObjectStream, putBufferToR2 } from '@/lib/r2'

const INSTALL_HINT =
  'FFmpeg is not installed. On Windows, run: winget install Gyan.FFmpeg — then restart the terminal and `npm run dev`.'

let ffmpegOk: boolean | null = null

export function ffmpegBinary(): string {
  const explicit = process.env.FFMPEG_PATH?.trim()
  if (explicit) return explicit
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

export async function localFfmpegAvailable(): Promise<boolean> {
  if (ffmpegOk !== null) return ffmpegOk
  ffmpegOk = await new Promise((resolve) => {
    const child = spawn(ffmpegBinary(), ['-version'], { windowsHide: true })
    const done = (ok: boolean) => {
      ffmpegOk = ok
      resolve(ok)
    }
    const timer = setTimeout(() => {
      child.kill()
      done(false)
    }, 4000)
    child.on('error', () => {
      clearTimeout(timer)
      done(false)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      done(code === 0)
    })
  })
  return ffmpegOk
}

function jobTempDir(jobId: string): string {
  const safe = jobId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
  return join(tmpdir(), `narrate-me-${safe}`)
}

export async function cleanupLocalFfmpegJob(jobId: string): Promise<void> {
  await rm(jobTempDir(jobId), { recursive: true, force: true }).catch(() => undefined)
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary(), args, { windowsHide: true })
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Local FFmpeg timed out. Retry — completed work is kept.'))
    }, timeoutMs)
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-1200)
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      if (/ENOENT/i.test(err.message)) reject(new Error(INSTALL_HINT))
      else reject(err)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `FFmpeg exited ${code}`))
    })
  })
}

export async function extractClipWithLocalFfmpeg(params: {
  jobId: string
  sourceKey: string
  startTime: number
  endTime: number
  outputKey: string
}): Promise<void> {
  if (!(await localFfmpegAvailable())) throw new Error(INSTALL_HINT)

  const start = Math.max(0, params.startTime)
  const duration = Math.max(0.5, params.endTime - start)
  const dir = jobTempDir(params.jobId)
  await mkdir(dir, { recursive: true })
  const sourcePath = join(dir, 'source.bin')
  const outPath = join(dir, `clip-${Math.floor(start)}.mp4`)

  try {
    try {
      await access(sourcePath)
    } catch {
      const stream = await getR2ObjectStream(params.sourceKey)
      if (!stream) throw new Error('Could not load the uploaded video for local FFmpeg')
      await pipeline(Readable.from(stream.body), createWriteStream(sourcePath))
    }

    const copyArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      start.toFixed(3),
      '-i',
      sourcePath,
      '-t',
      duration.toFixed(3),
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-c',
      'copy',
      '-avoid_negative_ts',
      'make_zero',
      outPath,
    ]
    const encodeArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      start.toFixed(3),
      '-i',
      sourcePath,
      '-t',
      duration.toFixed(3),
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '28',
      '-c:a',
      'aac',
      '-ac',
      '1',
      '-b:a',
      '96k',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outPath,
    ]

    try {
      await runFfmpeg(copyArgs, 180_000)
    } catch {
      await runFfmpeg(encodeArgs, 240_000)
    }

    const clip = await readFile(outPath)
    if (clip.length < 1000) throw new Error('Local FFmpeg produced an empty clip')
    const ok = await putBufferToR2(params.outputKey, clip, 'video/mp4')
    if (!ok) throw new Error('Could not store the local FFmpeg clip')
  } finally {
    await rm(outPath, { force: true }).catch(() => undefined)
  }
}
