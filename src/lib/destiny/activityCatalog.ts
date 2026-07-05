/**
 * Bungie DestinyActivityDefinition hashes for raids & dungeons.
 * Manifest index: https://www.bungie.net/Platform/Destiny2/Manifest/
 */

import type { CatalogEntry } from '@/lib/destiny/itemsCatalog'

/** Activity name → manifest hash (DestinyActivityDefinition). */
export const ACTIVITY_CATALOG: Record<string, CatalogEntry> = {
  'garden of salvation': { hash: 2659723068, entity: 'DestinyActivityDefinition' },
  "king's fall": { hash: 1374392663, entity: 'DestinyActivityDefinition' },
  'root of nightmares': { hash: 2381413764, entity: 'DestinyActivityDefinition' },
  'deep stone crypt': { hash: 910380154, entity: 'DestinyActivityDefinition' },
  'vault of glass': { hash: 3881495763, entity: 'DestinyActivityDefinition' },
  'vow of the disciple': { hash: 1441982566, entity: 'DestinyActivityDefinition' },
  'last wish': { hash: 2122313384, entity: 'DestinyActivityDefinition' },
  "crota's end": { hash: 107319834, entity: 'DestinyActivityDefinition' },
  "salvation's edge": { hash: 4169645674, entity: 'DestinyActivityDefinition' },
  'crown of sorrow': { hash: 333743995, entity: 'DestinyActivityDefinition' },
  'spire of the watcher': { hash: 2924076770, entity: 'DestinyActivityDefinition' },
  'pit of heresy': { hash: 1375089622, entity: 'DestinyActivityDefinition' },
  'ghosts of the deep': { hash: 3138280882, entity: 'DestinyActivityDefinition' },
  duality: { hash: 2823159265, entity: 'DestinyActivityDefinition' },
  'shattered throne': { hash: 2032534090, entity: 'DestinyActivityDefinition' },
  "warlord's ruin": { hash: 1290915544, entity: 'DestinyActivityDefinition' },
  'grasp of avarice': { hash: 1064261507, entity: 'DestinyActivityDefinition' },
  prophecy: { hash: 2546884575, entity: 'DestinyActivityDefinition' },
  "vesper's host": { hash: 3926382689, entity: 'DestinyActivityDefinition' },
}

export function activityCatalogLookup(name: string): CatalogEntry | undefined {
  return ACTIVITY_CATALOG[name.trim().toLowerCase()]
}

export function allCatalogActivityNames(): string[] {
  return Object.keys(ACTIVITY_CATALOG)
}
