export type PortStatus = 'Open' | 'Closed'

export type PortScanRow = {
  port: number
  service: string
  status: PortStatus
  binds: string[]
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
  total: number
  openCount: number
  closedCount: number
  ports: PortScanRow[]
  note?: string
}
