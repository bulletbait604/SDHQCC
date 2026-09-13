import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePublicIpText } from './hostIps'
import {
  cloudScanBlockedReason,
  formatLocalIpDisplay,
  hostnameFromHostHeader,
  isThisPcScanHost,
} from './localScan'
import {
  formatProcessLabel,
  parseProcessInfoJson,
  parseTasklistCsv,
} from './processInfo'

test('parseProcessInfoJson maps pid to name and version', () => {
  const map = parseProcessInfoJson(
    JSON.stringify([
      { pid: 1234, name: 'node', version: '22.11.0', product: 'Node.js', description: 'Runtime', path: 'C:\\node.exe' },
    ])
  )
  assert.equal(map.get(1234)?.name, 'node')
  assert.equal(map.get(1234)?.version, '22.11.0')
  assert.equal(formatProcessLabel(map.get(1234)), 'node 22.11.0 (Runtime)')
})

test('parseTasklistCsv reads image name and pid', () => {
  const csv = [
    '"Image Name","PID","Session Name","Session#","Mem Usage"',
    '"chrome.exe","4321","Console","1","100,000 K"',
  ].join('\n')
  const map = parseTasklistCsv(csv)
  assert.equal(map.get(4321)?.name, 'chrome.exe')
})

test('parsePublicIpText accepts public IPv4 only', () => {
  assert.equal(parsePublicIpText(' 203.0.113.10 \n'), '203.0.113.10')
  assert.equal(parsePublicIpText('127.0.0.1'), null)
  assert.equal(parsePublicIpText('192.168.1.65'), null)
  assert.equal(parsePublicIpText('not-an-ip'), null)
})

test('isThisPcScanHost allows this computer and blocks cloud hosts', () => {
  assert.equal(isThisPcScanHost('localhost'), true)
  assert.equal(isThisPcScanHost('127.0.0.1'), true)
  assert.equal(isThisPcScanHost('192.168.1.65'), true)
  assert.equal(isThisPcScanHost('Gaming_PC'), true)
  assert.equal(isThisPcScanHost('sdhqcc.vercel.app'), false)
  assert.equal(isThisPcScanHost('github.com'), false)
  assert.equal(hostnameFromHostHeader('localhost:3000'), 'localhost')
  assert.equal(cloudScanBlockedReason('sdhqcc.vercel.app', false)?.includes('localhost:3000'), true)
  assert.equal(cloudScanBlockedReason('localhost:3000', true)?.includes('localhost:3000'), true)
  assert.equal(cloudScanBlockedReason('localhost:3000', false), null)
  assert.equal(formatLocalIpDisplay(['192.168.1.65', '10.0.0.2']), '192.168.1.65 · 10.0.0.2')
})
