#!/usr/bin/env tsx
/**
 * Package the Stream Deck plugin as a double-clickable .streamDeckPlugin file.
 *
 *   npm run package:streamdeck
 *   npm run package:streamdeck:pro
 *
 * The Pro file is the one to upload to Gumroad (or any one-time download store).
 * Pro members can also download it from /api/streamdeck/download while signed in.
 */

import fs from 'fs'
import path from 'path'
import { buildStreamDeckPlugin } from '../src/lib/streamdeck/packagePlugin'

const edition = process.argv.includes('--pro') ? 'pro' : 'standard'
const built = buildStreamDeckPlugin(edition)
const outDir = path.join(process.cwd(), 'dist', 'streamdeck')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, built.filename)
fs.writeFileSync(outPath, built.bytes)
console.log(`Wrote ${outPath} (${built.bytes.length} bytes)`)
if (edition === 'pro') {
  console.log('Upload that file to Gumroad as the Stream Deck Pro one-time download.')
  console.log('Signed-in Pro, trial, and lifetime users can also download it from /api/streamdeck/download.')
}
