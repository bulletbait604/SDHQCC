import snapshot from './data/tyriaResources.json'
import type { Gw2ContinentInfo, HeroPoint } from './types'

type SnapshotJson = {
  continent: Gw2ContinentInfo
  points: HeroPoint[]
}

export const BUNDLED_TYRIA_SNAPSHOT = snapshot as SnapshotJson
