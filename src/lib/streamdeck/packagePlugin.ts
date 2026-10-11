import fs from 'fs'
import path from 'path'
import { zipStore } from '@/lib/streamdeck/zipStore'

export type StreamDeckEdition = 'standard' | 'pro'

const SKIP_FILES = new Set(['README.md', 'install-plugin.ps1', 'convert-icons.html'])

export function streamDeckPluginRoot(): string {
  return path.join(process.cwd(), 'streamdeck-plugin')
}

function listPluginFiles(dir: string, prefix: string): Array<{ rel: string; data: Buffer }> {
  const out: Array<{ rel: string; data: Buffer }> = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const abs = path.join(dir, entry.name)
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      out.push(...listPluginFiles(abs, rel))
      continue
    }
    if (SKIP_FILES.has(entry.name) || entry.name.endsWith('.svg')) continue
    out.push({ rel, data: fs.readFileSync(abs) })
  }
  return out
}

function proManifest(raw: Buffer): Buffer {
  const manifest = JSON.parse(raw.toString('utf8')) as {
    Name: string
    Version: string
    Description: string
    Actions?: Array<{ Name: string; UUID: string; Tooltip?: string }>
  }
  manifest.Name = 'com.sdhqcreator.kicklive.pro'
  manifest.Version = '1.1.0'
  manifest.Description =
    'Pro edition of KICK Live Status. Paid one-time download for Stream Dreams Creator Corner Pro members.'
  for (const action of manifest.Actions || []) {
    action.Name = 'KICK Live Status Pro'
    action.UUID = 'com.sdhqcreator.kicklive.pro.action'
    action.Tooltip = 'Shows if a KICK user is live (Pro)'
  }
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
}

function proPluginJs(raw: Buffer): Buffer {
  const text = raw.toString('utf8')
  if (!text.includes("const PLUGIN_EDITION = 'standard';")) {
    throw new Error('streamdeck-plugin/plugin.js is missing the PLUGIN_EDITION marker')
  }
  return Buffer.from(text.replace("const PLUGIN_EDITION = 'standard';", "const PLUGIN_EDITION = 'pro';"))
}

export function buildStreamDeckPlugin(edition: StreamDeckEdition): { filename: string; bytes: Buffer } {
  const root = streamDeckPluginRoot()
  const files = listPluginFiles(root, '').map((file) => {
    if (edition !== 'pro') return file
    if (file.rel === 'manifest.json') return { rel: file.rel, data: proManifest(file.data) }
    if (file.rel === 'plugin.js') return { rel: file.rel, data: proPluginJs(file.data) }
    return file
  })

  const folder =
    edition === 'pro' ? 'com.sdhqcreator.kicklive.pro.sdPlugin' : 'com.sdhqcreator.kicklive.sdPlugin'
  const bytes = zipStore(
    files.map((file) => ({
      name: `${folder}/${file.rel}`,
      data: file.data,
    }))
  )
  const filename =
    edition === 'pro' ? 'SDHQCC-Kick-Live-Pro.streamDeckPlugin' : 'SDHQCC-Kick-Live.streamDeckPlugin'
  return { filename, bytes }
}
