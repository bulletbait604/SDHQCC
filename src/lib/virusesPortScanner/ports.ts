import type { PortProto, PortScanRow, PortStatus } from './types'

export const PORT_MIN = 1
export const PORT_MAX = 65535
export const INBOUND_PAGE_SIZE = 200

const SERVICE_NAMES: Record<number, string> = {
  1: 'tcpmux',
  7: 'echo',
  9: 'discard',
  13: 'daytime',
  17: 'qotd',
  19: 'chargen',
  20: 'ftp-data',
  21: 'ftp',
  22: 'ssh',
  23: 'telnet',
  25: 'smtp',
  37: 'time',
  42: 'nameserver',
  43: 'whois',
  49: 'tacacs',
  53: 'dns',
  67: 'dhcp',
  68: 'dhcp-client',
  69: 'tftp',
  70: 'gopher',
  79: 'finger',
  80: 'http',
  88: 'kerberos',
  102: 'iso-tsap',
  110: 'pop3',
  111: 'sunrpc',
  113: 'ident',
  119: 'nntp',
  123: 'ntp',
  135: 'epmap',
  137: 'netbios-ns',
  138: 'netbios-dgm',
  139: 'netbios-ssn',
  143: 'imap',
  161: 'snmp',
  162: 'snmptrap',
  179: 'bgp',
  194: 'irc',
  220: 'imap3',
  389: 'ldap',
  443: 'https',
  445: 'microsoft-ds',
  464: 'kpasswd',
  465: 'smtps',
  500: 'isakmp',
  512: 'exec',
  513: 'login',
  514: 'shell',
  515: 'printer',
  520: 'rip',
  548: 'afp',
  554: 'rtsp',
  587: 'submission',
  631: 'ipp',
  636: 'ldaps',
  873: 'rsync',
  989: 'ftps-data',
  990: 'ftps',
  993: 'imaps',
  995: 'pop3s',
  1080: 'socks',
  1194: 'openvpn',
  1433: 'ms-sql-s',
  1521: 'oracle',
  1723: 'pptp',
  1883: 'mqtt',
  2049: 'nfs',
  2082: 'cpanel',
  2083: 'cpanel-ssl',
  2181: 'zookeeper',
  2375: 'docker',
  2376: 'docker-tls',
  2483: 'oracle-ssl',
  3000: 'dev-http',
  3001: 'dev-http-alt',
  3128: 'squid',
  3268: 'msft-gc',
  3306: 'mysql',
  3389: 'rdp',
  3690: 'svn',
  4000: 'dev-alt',
  4369: 'epmd',
  4444: 'krb524',
  5000: 'upnp',
  5060: 'sip',
  5222: 'xmpp-client',
  5353: 'mdns',
  5357: 'wsdapi',
  5432: 'postgresql',
  5672: 'amqp',
  5900: 'vnc',
  5938: 'teamviewer',
  5985: 'winrm',
  5986: 'winrm-https',
  6379: 'redis',
  6443: 'kubernetes',
  6667: 'ircu',
  7000: 'afs3-fileserver',
  8000: 'http-alt',
  8008: 'http-alt',
  8080: 'http-proxy',
  8081: 'http-alt',
  8443: 'https-alt',
  8888: 'http-alt',
  9000: 'cslistener',
  9090: 'websm',
  9200: 'elasticsearch',
  9418: 'git',
  11211: 'memcached',
  15672: 'rabbitmq-mgmt',
  27017: 'mongodb',
  32400: 'plex',
}

export function serviceNameForPort(port: number): string {
  return SERVICE_NAMES[port] || 'unknown'
}

export function uniqueBinds(binds: string[] | undefined): string[] {
  if (!binds || binds.length === 0) return []
  return Array.from(new Set(binds)).sort()
}

export function openRow(port: number, proto: PortProto, binds: string[]): PortScanRow {
  return {
    port,
    proto,
    service: serviceNameForPort(port),
    status: 'Open',
    binds: uniqueBinds(binds),
  }
}

export function closedRow(port: number, proto: PortProto): PortScanRow {
  return {
    port,
    proto,
    service: serviceNameForPort(port),
    status: 'Closed',
    binds: [],
  }
}

export function rowsFromListenMap(listening: Map<number, string[]>, proto: PortProto): PortScanRow[] {
  const rows: PortScanRow[] = []
  listening.forEach((binds, port) => {
    rows.push(openRow(port, proto, binds))
  })
  rows.sort((a, b) => a.port - b.port)
  return rows
}

export type StatusFilter = 'all' | PortStatus
export type ProtoFilter = PortProto | 'both'

function rowMatchesQuery(row: PortScanRow, query: string): boolean {
  if (!query) return true
  if (String(row.port).includes(query)) return true
  if (row.service.toLowerCase().includes(query)) return true
  if (row.status.toLowerCase().includes(query)) return true
  if (row.proto.includes(query)) return true
  for (let i = 0; i < row.binds.length; i += 1) {
    if (row.binds[i].toLowerCase().includes(query)) return true
  }
  return false
}

function protosFor(filter: ProtoFilter): PortProto[] {
  if (filter === 'both') return ['tcp', 'udp']
  return [filter]
}

export function bindMapFromOpenRows(rows: readonly PortScanRow[], proto: PortProto): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (row.proto === proto && row.status === 'Open') map.set(row.port, row.binds)
  }
  return map
}

export function buildInboundPage(params: {
  tcpBinds: Map<number, string[]>
  udpBinds: Map<number, string[]>
  filter: StatusFilter
  proto: ProtoFilter
  query: string
  page: number
  pageSize?: number
}): { rows: PortScanRow[]; matched: number; page: number; pages: number } {
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : INBOUND_PAGE_SIZE
  const query = params.query.trim().toLowerCase()
  const protos = protosFor(params.proto)
  const bindsFor = (proto: PortProto) => (proto === 'tcp' ? params.tcpBinds : params.udpBinds)

  const collect = (page: number) => {
    const rows: PortScanRow[] = []
    let matched = 0
    const start = (page - 1) * pageSize
    const take = (row: PortScanRow) => {
      if (!rowMatchesQuery(row, query)) return
      if (matched >= start && rows.length < pageSize) rows.push(row)
      matched += 1
    }

    if (params.filter === 'Open') {
      const openRows: PortScanRow[] = []
      for (let p = 0; p < protos.length; p += 1) {
        const proto = protos[p]
        const map = bindsFor(proto)
        const ports: number[] = []
        map.forEach((_binds, port) => {
          ports.push(port)
        })
        ports.sort((a, b) => a - b)
        for (let i = 0; i < ports.length; i += 1) {
          openRows.push(openRow(ports[i], proto, map.get(ports[i]) || []))
        }
      }
      if (params.proto === 'both') {
        openRows.sort((a, b) => a.port - b.port || a.proto.localeCompare(b.proto))
      }
      for (let i = 0; i < openRows.length; i += 1) take(openRows[i])
    } else {
      for (let port = PORT_MIN; port <= PORT_MAX; port += 1) {
        for (let p = 0; p < protos.length; p += 1) {
          const proto = protos[p]
          const binds = uniqueBinds(bindsFor(proto).get(port))
          const isOpen = binds.length > 0
          if (params.filter === 'Closed' && isOpen) continue
          take(isOpen ? openRow(port, proto, binds) : closedRow(port, proto))
        }
      }
    }

    return { rows, matched }
  }

  const requested = Math.max(1, params.page)
  const first = collect(requested)
  const pages = Math.max(1, Math.ceil(first.matched / pageSize) || 1)
  const page = Math.min(requested, pages)
  if (page !== requested) {
    const clamped = collect(page)
    return { rows: clamped.rows, matched: clamped.matched, page, pages }
  }
  return { rows: first.rows, matched: first.matched, page, pages }
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!normalized) return false
  if (normalized === 'localhost' || normalized === '::1') return true
  const ipv4 = normalized.match(/^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false
  return ipv4.slice(1).every((octet) => {
    const n = Number.parseInt(octet, 10)
    return n >= 0 && n <= 255
  })
}

/** Loopback only — never scan LAN/public hosts from this app. */
export function resolveScanHost(raw?: string | null): string {
  const host = (raw ?? '').trim().toLowerCase()
  if (!host) return '127.0.0.1'
  if (!isLoopbackHost(host)) {
    throw new Error('Scan host must be loopback (127.0.0.1 / localhost).')
  }
  if (host === 'localhost' || host === '::1' || host === '[::1]') return '127.0.0.1'
  return host.replace(/^\[|\]$/g, '')
}

export function vercelScanNote(hostedOnVercel: boolean): string | undefined {
  if (!hostedOnVercel) return undefined
  return 'This build is on Vercel, so the sweep is the serverless host — not your PC. Run `npm run dev` locally to scan inbound and outbound sockets on this computer. No extra network permission is required beyond reading this machine.'
}
