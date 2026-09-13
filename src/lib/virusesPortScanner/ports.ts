import type { PortScanRow } from './types'

/** IANA well-known TCP/UDP range. */
export const WELL_KNOWN_PORT_MAX = 1023

/**
 * Common registered ports that sit above the well-known range.
 * These are the ones people actually run on a PC (dev servers, DBs, RDP, etc.).
 */
export const EXTRA_REGISTERED_PORTS = [
  1080, 1194, 1433, 1521, 1723, 1883, 2049, 2082, 2083, 2181, 2375, 2376, 2483, 3000, 3001,
  3128, 3268, 3306, 3389, 3690, 4000, 4369, 4444, 5000, 5060, 5222, 5357, 5432, 5672, 5900,
  5938, 5985, 5986, 6379, 6443, 6667, 7000, 8000, 8008, 8080, 8081, 8443, 8888, 9000, 9090,
  9200, 9418, 11211, 15672, 27017, 32400,
] as const

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

export function listKnownPorts(): number[] {
  const set = new Set<number>()
  for (let port = 1; port <= WELL_KNOWN_PORT_MAX; port += 1) {
    set.add(port)
  }
  for (const port of EXTRA_REGISTERED_PORTS) {
    if (port >= 1 && port <= 65535) set.add(port)
  }
  return Array.from(set).sort((a, b) => a - b)
}

export function classifyKnownPorts(
  knownPorts: readonly number[],
  listening: Map<number, string[]>
): PortScanRow[] {
  return knownPorts.map((port) => {
    const binds = listening.get(port)
    const uniqueBinds = binds ? Array.from(new Set(binds)).sort() : []
    return {
      port,
      service: serviceNameForPort(port),
      status: uniqueBinds.length > 0 ? 'Open' : 'Closed',
      binds: uniqueBinds,
    }
  })
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
  return 'This build is on Vercel, so the sweep is the serverless host — not your PC. Run the app locally to scan this computer.'
}
