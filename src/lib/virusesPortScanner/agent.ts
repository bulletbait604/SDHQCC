import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  agentAllowedCorsOrigin,
  LOCAL_AGENT_NOTE,
  LOCAL_AGENT_PORT,
  LOCAL_AGENT_UI_URL,
} from './localScan'
import { scanAllLocalPorts } from './scan'

const uiHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'agentUi.html'), 'utf8')

function port(): number {
  const raw = Number.parseInt(process.env.VIRUSES_AGENT_PORT || '', 10)
  if (Number.isInteger(raw) && raw > 0 && raw < 65536) return raw
  return LOCAL_AGENT_PORT
}

function setCors(res: ServerResponse, origin: string | null): void {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function sendJson(res: ServerResponse, status: number, body: unknown, origin: string | null): void {
  setCors(res, origin)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function sendHtml(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(uiHtml)
}

function pathnameOf(req: IncomingMessage): string {
  try {
    return new URL(req.url || '/', 'http://127.0.0.1').pathname
  } catch {
    return '/'
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const cors = agentAllowedCorsOrigin(typeof req.headers.origin === 'string' ? req.headers.origin : null)
  if (cors === false) {
    sendJson(
      res,
      403,
      {
        error: 'origin-not-allowed',
        userMessage: 'This local server only answers this PC and the Creator Corner site.',
      },
      null
    )
    return
  }
  const origin = cors

  if (req.method === 'OPTIONS') {
    setCors(res, origin)
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method-not-allowed' }, origin)
    return
  }

  const path = pathnameOf(req)
  if (path === '/' || path === '/index.html') {
    sendHtml(res)
    return
  }

  if (path === '/health') {
    sendJson(res, 200, { ok: true, bind: '127.0.0.1', port: port(), ui: LOCAL_AGENT_UI_URL }, origin)
    return
  }

  if (path !== '/scan') {
    sendJson(res, 404, { error: 'not-found' }, origin)
    return
  }

  try {
    const result = await scanAllLocalPorts()
    sendJson(res, 200, { ...result, note: LOCAL_AGENT_NOTE }, origin)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Port scan failed'
    sendJson(res, 503, { error: message, userMessage: message }, origin)
  }
}

const listenPort = port()
const server = createServer((req, res) => {
  void handle(req, res)
})

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`Viruses Port Scanner local server: ${LOCAL_AGENT_UI_URL}`)
  console.log('Keep this window open. This process only reads this PC.')
})

function shutdown(): void {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
