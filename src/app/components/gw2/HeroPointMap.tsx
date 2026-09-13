'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { defaultTyriaView, GW2_UNPROJECT_ZOOM, TYRIA_TILE_URL } from '@/lib/gw2/mapConstants'
import { completedSet } from '@/lib/gw2/progress'
import { resourceTitle } from '@/lib/gw2/mapResources'
import { GW2_RESOURCE_LABELS, type Gw2ContinentInfo, type Gw2ResourceKind, type HeroPoint } from '@/lib/gw2/types'

const KIND_COLORS: Record<Gw2ResourceKind, string> = {
  hero_point: '#fbbf24',
  mastery: '#c084fc',
  vista: '#67e8f9',
  waypoint: '#60a5fa',
  heart: '#fb7185',
}

export interface HeroPointMapProps {
  continent: Gw2ContinentInfo
  points: HeroPoint[]
  completedIds: string[]
  darkMode: boolean
  onSelect: (point: HeroPoint, completed: boolean) => void
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;'
    if (ch === '<') return '&lt;'
    if (ch === '>') return '&gt;'
    if (ch === '"') return '&quot;'
    return '&#39;'
  })
}

export default function HeroPointMap({ continent, points, completedIds, darkMode: _darkMode, onSelect }: HeroPointMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const [mapReady, setMapReady] = useState(0)
  onSelectRef.current = onSelect

  useEffect(() => {
    const el = hostRef.current
    if (!el) return undefined
    let cancelled = false
    let map: LeafletMap | undefined

    void import('leaflet').then((mod) => {
      if (cancelled || !hostRef.current) return
      const L = (mod as { default?: typeof import('leaflet') }).default ?? (mod as typeof import('leaflet'))
      const view = defaultTyriaView(continent.dims)
      map = L.map(hostRef.current, {
        minZoom: Math.max(1, continent.minZoom || 1),
        maxZoom: 7,
        crs: L.CRS.Simple,
        zoomControl: true,
        preferCanvas: true,
      })
      const unproject = (coord: [number, number]) => map!.unproject(coord, GW2_UNPROJECT_ZOOM)
      const bounds = L.latLngBounds(unproject([0, 0]), unproject(continent.dims))
      map.setMaxBounds(bounds)
      L.tileLayer(TYRIA_TILE_URL, {
        minZoom: 1,
        maxZoom: 7,
        noWrap: true,
        bounds,
        attribution: 'Map tiles © ArenaNet / Guild Wars 2',
      }).addTo(map)
      map.setView(unproject(view.center), view.zoom)
      mapRef.current = map
      layerRef.current = L.layerGroup().addTo(map)
      setTimeout(() => map?.invalidateSize(), 80)
      setMapReady((n) => n + 1)
    })

    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
      layerRef.current = null
      setMapReady(0)
    }
  }, [continent.dims[0], continent.dims[1], continent.minZoom])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    void import('leaflet').then((mod) => {
      const L = (mod as { default?: typeof import('leaflet') }).default ?? (mod as typeof import('leaflet'))
      const done = completedSet(completedIds)
      layer.clearLayers()
      const unproject = (coord: [number, number]) => map.unproject(coord, GW2_UNPROJECT_ZOOM)
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i]
        const completed = point.trackable && done.has(point.id)
        const title = resourceTitle(point)
        const color = completed ? '#22c55e' : KIND_COLORS[point.kind]
        const marker = L.circleMarker(unproject([point.x, point.y]), {
          radius: 6,
          color: completed ? '#052e16' : '#111827',
          weight: 1,
          fillColor: color,
          fillOpacity: 0.95,
        })
        const status = !point.trackable ? 'Location (API does not report completion)' : completed ? 'Completed' : 'Not Completed'
        marker.bindPopup(
          `<div class="gw2-hp-popup">
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(GW2_RESOURCE_LABELS[point.kind])} · ${escapeHtml(point.mapName)}</p>
            <p>${escapeHtml(point.regionName)} · ${escapeHtml(point.expansion)}</p>
            <p>Status: <b class="${completed ? 'open' : 'todo'}">${status}</b></p>
            <p class="mono">${escapeHtml(point.id)}</p>
          </div>`
        )
        marker.on('click', () => onSelectRef.current(point, completed))
        marker.addTo(layer)
      }
    })
  }, [points, completedIds, mapReady])

  return <div ref={hostRef} className="gw2-hp-map h-[min(70vh,720px)] min-h-[420px] w-full rounded-2xl overflow-hidden" />
}
