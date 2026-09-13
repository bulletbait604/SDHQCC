import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyKnownPorts,
  EXTRA_REGISTERED_PORTS,
  isLoopbackHost,
  listKnownPorts,
  resolveScanHost,
  serviceNameForPort,
  vercelScanNote,
  WELL_KNOWN_PORT_MAX,
} from './ports'
import { parseLocalAddress, parseProcNetTcp, parseUnixNetstat, parseWindowsNetstat } from './listenTable'

test('listKnownPorts covers well-known range plus extras without duplicates', () => {
  const ports = listKnownPorts()
  assert.equal(ports[0], 1)
  assert.ok(ports.includes(WELL_KNOWN_PORT_MAX))
  assert.ok(ports.includes(80))
  assert.ok(ports.includes(443))
  assert.ok(ports.includes(3389))
  assert.ok(ports.includes(8080))
  assert.equal(new Set(ports).size, ports.length)
  assert.equal(ports.length, WELL_KNOWN_PORT_MAX + new Set(EXTRA_REGISTERED_PORTS.filter((p) => p > WELL_KNOWN_PORT_MAX)).size)
})

test('service names resolve common listener ports', () => {
  assert.equal(serviceNameForPort(22), 'ssh')
  assert.equal(serviceNameForPort(3389), 'rdp')
  assert.equal(serviceNameForPort(27017), 'mongodb')
  assert.equal(serviceNameForPort(4), 'unknown')
})

test('resolveScanHost only allows loopback', () => {
  assert.equal(resolveScanHost(undefined), '127.0.0.1')
  assert.equal(resolveScanHost(''), '127.0.0.1')
  assert.equal(resolveScanHost('localhost'), '127.0.0.1')
  assert.equal(resolveScanHost('::1'), '127.0.0.1')
  assert.equal(resolveScanHost('127.0.0.5'), '127.0.0.5')
  assert.equal(isLoopbackHost('127.255.255.255'), true)
  assert.equal(isLoopbackHost('192.168.1.1'), false)
  assert.equal(isLoopbackHost('8.8.8.8'), false)
  assert.throws(() => resolveScanHost('8.8.8.8'), /loopback/)
  assert.throws(() => resolveScanHost('192.168.0.10'), /loopback/)
  assert.throws(() => resolveScanHost('10.0.0.2'), /loopback/)
})

test('classifyKnownPorts marks listening ports Open and the rest Closed', () => {
  const listening = new Map<number, string[]>([
    [80, ['0.0.0.0']],
    [3000, ['127.0.0.1', '127.0.0.1']],
  ])
  const rows = classifyKnownPorts([80, 443, 3000], listening)
  assert.deepEqual(rows, [
    { port: 80, service: 'http', status: 'Open', binds: ['0.0.0.0'] },
    { port: 443, service: 'https', status: 'Closed', binds: [] },
    { port: 3000, service: 'dev-http', status: 'Open', binds: ['127.0.0.1'] },
  ])
})

test('parseWindowsNetstat reads IPv4 and IPv6 LISTENING rows', () => {
  const stdout = [
    'Active Connections',
    '',
    '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       888',
    '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234',
    '  TCP    [::]:445               [::]:0                 LISTENING       4',
    '  TCP    127.0.0.1:3000         127.0.0.1:54321        ESTABLISHED     1234',
    '  UDP    0.0.0.0:53             *:*                                    456',
  ].join('\r\n')

  const map = parseWindowsNetstat(stdout)
  assert.deepEqual(map.get(135), ['0.0.0.0'])
  assert.deepEqual(map.get(3000), ['127.0.0.1'])
  assert.deepEqual(map.get(445), ['::'])
  assert.equal(map.has(53), false)
})

test('parseProcNetTcp reads LISTEN hex rows', () => {
  const content = [
    '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    '   0: 00000000:0016 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 1 1 0000000000000000 100 0 0 10 0',
    '   1: 0100007F:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 2 1 0000000000000000 100 0 0 10 0',
    '   2: 0100007F:0BB8 0100007F:C351 01 00000000:00000000 00:00000000 00000000     0        0 3 1 0000000000000000 100 0 0 10 0',
  ].join('\n')

  const map = parseProcNetTcp(content, 'ipv4')
  assert.deepEqual(map.get(22), ['0.0.0.0'])
  assert.deepEqual(map.get(3000), ['127.0.0.1'])
  assert.equal(map.has(50001), false)
})

test('parseUnixNetstat and parseLocalAddress handle common listen forms', () => {
  const stdout = [
    'tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN',
    'tcp6       0      0 :::80                   :::*                    LISTEN',
    'tcp4       0      0 127.0.0.1.631           *.*                     LISTEN',
  ].join('\n')
  const map = parseUnixNetstat(stdout)
  assert.ok(map.get(22)?.includes('0.0.0.0'))
  assert.ok(map.get(80)?.length)
  assert.ok(map.get(631)?.includes('127.0.0.1'))

  assert.deepEqual(parseLocalAddress('127.0.0.1:8080'), { address: '127.0.0.1', port: 8080 })
  assert.deepEqual(parseLocalAddress('[::1]:443'), { address: '::1', port: 443 })
  assert.equal(parseLocalAddress('not-a-port'), null)
})

test('vercelScanNote only warns on hosted builds', () => {
  assert.equal(vercelScanNote(false), undefined)
  assert.match(String(vercelScanNote(true)), /Vercel/)
})
