import type { ProcessInfo } from './types'

export function formatProcessLabel(info: ProcessInfo | null | undefined): string {
  if (!info) return '—'
  const version = info.version || info.product
  if (version && info.description && info.description !== info.name) {
    return `${info.name} ${version} (${info.description})`
  }
  if (version) return `${info.name} ${version}`
  if (info.description && info.description !== info.name) return `${info.name} (${info.description})`
  return info.name
}

export function formatProcessList(processes: readonly ProcessInfo[]): string {
  if (!processes.length) return '—'
  return processes.map((info) => formatProcessLabel(info)).join(' · ')
}
