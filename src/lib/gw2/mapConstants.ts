/** Leaflet maxZoom used so 1 continent unit = 1 pixel (GW2 wiki / API:Maps). */
export const GW2_UNPROJECT_ZOOM = 7

export const TYRIA_CONTINENT_ID = 1
export const TYRIA_FLOOR_ID = 1
export const TYRIA_TILE_URL = 'https://tiles.guildwars2.com/1/1/{z}/{x}/{y}.jpg'

export function defaultTyriaView(dims: readonly [number, number]): { center: [number, number]; zoom: number } {
  return { center: [dims[0] / 2, dims[1] / 4], zoom: 2 }
}
