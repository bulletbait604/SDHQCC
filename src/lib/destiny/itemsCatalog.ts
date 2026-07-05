/**
 * Fallback Bungie definition hashes when manifest lookup is unavailable.
 * Hashes are DestinyInventoryItemDefinition / DestinyActivityDefinition identifiers.
 */

export type ManifestEntityType =
  | 'DestinyInventoryItemDefinition'
  | 'DestinyActivityDefinition'
  | 'DestinyActivityModeDefinition'
  | 'DestinySandboxPerkDefinition'
  | 'DestinyClassDefinition'
  | 'DestinyDamageTypeDefinition'
  | 'DestinyStatDefinition'
  | 'DestinyEquipableItemSetDefinition'
  | 'DestinyPlugSetDefinition'
  | 'DestinyPresentationNodeDefinition'

export interface CatalogEntry {
  hash: number
  entity: ManifestEntityType
}

/** Name → hash catalog (case-insensitive lookup in resolver). */
export const ITEM_CATALOG: Record<string, CatalogEntry> = {
  'ophidian aspect': { hash: 4029935431, entity: 'DestinyInventoryItemDefinition' },
  'cuirass of the falling star': { hash: 2800031299, entity: 'DestinyInventoryItemDefinition' },
  'star-eater scales': { hash: 1600972208, entity: 'DestinyInventoryItemDefinition' },
  'icefall mantle': { hash: 1181377419, entity: 'DestinyInventoryItemDefinition' },
  divinity: { hash: 1994640542, entity: 'DestinyInventoryItemDefinition' },
  'wish-keeper': { hash: 1473819635, entity: 'DestinyInventoryItemDefinition' },
  cataclysmic: { hash: 2821677368, entity: 'DestinyInventoryItemDefinition' },
  "calus's selected": { hash: 3849356735, entity: 'DestinyInventoryItemDefinition' },
  'null composure': { hash: 2973489523, entity: 'DestinyInventoryItemDefinition' },
  stormchaser: { hash: 1066720226, entity: 'DestinyInventoryItemDefinition' },
  submission: { hash: 2010806346, entity: 'DestinyInventoryItemDefinition' },
  imminence: { hash: 3220026392, entity: 'DestinyInventoryItemDefinition' },
  supremacy: { hash: 3441086843, entity: 'DestinyInventoryItemDefinition' },
  'explosive personality': { hash: 3926153599, entity: 'DestinyInventoryItemDefinition' },
  'zephyr reward': { hash: 2526139416, entity: 'DestinyInventoryItemDefinition' },
  'bleak watcher': { hash: 307219602, entity: 'DestinySandboxPerkDefinition' },
  prismatic: { hash: 748297214, entity: 'DestinyDamageTypeDefinition' },
  arc: { hash: 2303181850, entity: 'DestinyDamageTypeDefinition' },
  solar: { hash: 1847020893, entity: 'DestinyDamageTypeDefinition' },
  void: { hash: 3454344768, entity: 'DestinyDamageTypeDefinition' },
  warlock: { hash: 2271682572, entity: 'DestinyClassDefinition' },
  titan: { hash: 3655393761, entity: 'DestinyClassDefinition' },
  hunter: { hash: 671679754, entity: 'DestinyClassDefinition' },
  'emblem of the guardian': { hash: 1963515173, entity: 'DestinyInventoryItemDefinition' },
  'emblem of the brave': { hash: 423579395, entity: 'DestinyInventoryItemDefinition' },
  'garden of salvation': { hash: 2659723068, entity: 'DestinyActivityDefinition' },
  "king's fall": { hash: 1374392663, entity: 'DestinyActivityDefinition' },
  'spire of the watcher': { hash: 2924076770, entity: 'DestinyActivityDefinition' },
  'pit of heresy': { hash: 1375089622, entity: 'DestinyActivityDefinition' },
  'root of nightmares': { hash: 2381413764, entity: 'DestinyActivityDefinition' },
  'deep stone crypt': { hash: 910380154, entity: 'DestinyActivityDefinition' },
  'ghosts of the deep': { hash: 3138280882, entity: 'DestinyActivityDefinition' },
  duality: { hash: 2823159265, entity: 'DestinyActivityDefinition' },
}

export function catalogLookup(name: string): CatalogEntry | undefined {
  return ITEM_CATALOG[name.trim().toLowerCase()]
}

export const MOCK_EMBLEM_HASHES = [1963515173, 423579395, 1963515173, 423579395, 1963515173]
