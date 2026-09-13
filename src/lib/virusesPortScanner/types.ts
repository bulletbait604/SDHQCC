export type PortStatus = 'Open' | 'Closed'
export type PortProto = 'tcp' | 'udp'
export type TrafficDirection = 'inbound' | 'outbound'

export type PortScanRow = {
  port: number
  proto: PortProto
  service: string
  status: PortStatus
  binds: string[]
}

export type PortConnection = {
  proto: PortProto
  localAddress: string
  localPort: number
  remoteAddress: string
  remotePort: number | null
  state: string
  direction: TrafficDirection
  pid: number | null
}

export type PortScanMethod = 'os-listen-table' | 'tcp-connect'

export type PortScanResult = {
  host: string
  hostname: string
  platform: string
  hostedOnVercel: boolean
  scannedAt: string
  durationMs: number
  method: PortScanMethod
  portMin: number
  portMax: number
  total: number
  openCount: number
  closedCount: number
  tcpOpenCount: number
  udpOpenCount: number
  outboundCount: number
  inboundSessionCount: number
  ports: PortScanRow[]
  connections: PortConnection[]
  note?: string
}
