import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bindMapFromOpenRows,
  buildInboundPage,
  INBOUND_PAGE_SIZE,
  isLoopbackHost,
  openRow,
  PORT_MAX,
  PORT_MIN,
  resolveScanHost,
  serviceNameForPort,
  vercelScanNote,
} from './ports'
import {
  classifyConnectionDirection,
  parseLocalAddress,
  parseProcNetTcp,
  parseUnixNetstat,
  parseWindowsNetstat,
  parseWindowsNetstatSnapshot,
} from './listenTable'

test('TCP range covers every port on the machine', () => {
  assert.equal(PORT_MIN, 1)
  assert.equal(PORT_MAX, 65535)
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

test('buildInboundPage lists every TCP port and pages Closed rows', () => {
  const tcpBinds = new Map<number, string[]>([
    [80, ['0.0.0.0']],
    [3000, ['127.0.0.1', '127.0.0.1']],
  ])
  const udpBinds = new Map<number, string[]>()
  const all = buildInboundPage({
    tcpBinds,
    udpBinds,
    filter: 'all',
    proto: 'tcp',
    query: '',
    page: 1,
    pageSize: 200,
  })
  assert.equal(all.matched, PORT_MAX)
  assert.equal(all.pages, Math.ceil(PORT_MAX / 200))
  assert.equal(all.rows[0]?.port, 1)
  assert.equal(all.rows[0]?.status, 'Closed')
  const open = buildInboundPage({
    tcpBinds,
    udpBinds,
    filter: 'Open',
    proto: 'tcp',
    query: '',
    page: 1,
  })
  assert.equal(open.matched, 2)
  assert.deepEqual(
    open.rows.map((row) => row.port),
    [80, 3000]
  )
  const closed = buildInboundPage({
    tcpBinds,
    udpBinds,
    filter: 'Closed',
    proto: 'tcp',
    query: '',
    page: 1,
    pageSize: 5,
  })
  assert.equal(closed.matched, PORT_MAX - 2)
  assert.equal(closed.rows.length, 5)
  assert.equal(
    closed.rows.some((row) => row.port === 80),
    false
  )
})

test('bindMapFromOpenRows round-trips scan payload', () => {
  const rows = [openRow(443, 'tcp', ['0.0.0.0']), openRow(53, 'udp', ['127.0.0.1'])]
  const tcp = bindMapFromOpenRows(rows, 'tcp')
  const udp = bindMapFromOpenRows(rows, 'udp')
  assert.deepEqual(tcp.get(443), ['0.0.0.0'])
  assert.equal(tcp.has(53), false)
  assert.deepEqual(udp.get(53), ['127.0.0.1'])
})

test('parseWindowsNetstatSnapshot reads listeners, UDP, and traffic', () => {
  const stdout = [
    'Active Connections',
    '',
    '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       888',
    '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234',
    '  TCP    [::]:445               [::]:0                 LISTENING       4',
    '  TCP    127.0.0.1:3000         127.0.0.1:54321        ESTABLISHED     1234',
    '  TCP    192.168.1.65:49732     20.42.73.24:443        ESTABLISHED     99',
    '  UDP    0.0.0.0:53             *:*                                    456',
  ].join('\r\n')

  const snapshot = parseWindowsNetstatSnapshot(stdout)
  assert.deepEqual(snapshot.listeningTcp.get(135), ['0.0.0.0'])
  assert.deepEqual(snapshot.listeningTcp.get(3000), ['127.0.0.1'])
  assert.deepEqual(snapshot.listeningTcp.get(445), ['::'])
  assert.deepEqual(snapshot.listeningUdp.get(53), ['0.0.0.0'])
  assert.equal(snapshot.connections.length, 2)

  const inbound = classifyConnectionDirection(snapshot.connections[0], snapshot.listeningTcp)
  const outbound = classifyConnectionDirection(snapshot.connections[1], snapshot.listeningTcp)
  assert.equal(inbound.direction, 'inbound')
  assert.equal(outbound.direction, 'outbound')
  assert.equal(outbound.remotePort, 443)
  assert.equal(outbound.pid, 99)

  const map = parseWindowsNetstat(stdout)
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

test('inbound page size stays practical for the UI', () => {
  assert.equal(INBOUND_PAGE_SIZE, 200)
})
