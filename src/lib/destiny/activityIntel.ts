/** Destinypedia-style activity blurbs for featured rotation UI. */

import type { Difficulty, FeaturedActivity } from '@/lib/destiny/types'

const LORE: Record<string, { summary: string; tips: string[] }> = {
  "King's Fall": {
    summary: 'Classic six-player raid aboard the Dreadnaught. Iconic Oryx encounter with tight add-clear and plate mechanics.',
    tips: ['Bring strong add-clear for Warpriest', 'Oryx requires coordinated plate runners'],
  },
  'Vault of Glass': {
    summary: "Time-travel raid on Venus. The template for Destiny raiding — Oracles, Gorgons, and Atheon's judgment.",
    tips: ['Oracle callouts win Templar', 'Gorgon maze rewards patience over speed'],
  },
  'Garden of Salvation': {
    summary: 'Pyramid-scale raid in the Black Garden. Relay tethering and synchronized DPS checks define the run.',
    tips: ['Assign tether roles early', 'Sanctified Mind benefits from burst supers'],
  },
  'Last Wish': {
    summary: "Riven's lair in the Dreaming City. Longest raid in the game with chess-level encounter variety.",
    tips: ['Shuro Chi is a DPS race', 'Keep one player on Taken cleansing for Kalli'],
  },
  "Crota's End": {
    summary: 'Moon raid reprised from Destiny 1. Sword mechanics and bridge runs with fast pacing.',
    tips: ['Sword bearer timing is everything', 'Oversoul snipers need quick callouts'],
  },
  'Root of Nightmares': {
    summary: 'Neomuna pyramid raid. Light-dark conversion puzzles and escalating final-room pressure.',
    tips: ['Nezarec final phase rewards orb discipline', 'Macro add control on Zo\'aurc'],
  },
  "Vow of the Disciple": {
    summary: 'Throne World raid against Rhulk. Relic puzzles and a brutal final DPS window.',
    tips: ['Learn Rhulk kill timing for flawless', 'Acquisition relic routing is the skill check'],
  },
  'Deep Stone Crypt': {
    summary: 'Cosmodrome frozen crypt. Operator scans, capstan spawns, and a space-walk finale.',
    tips: ['Atraks-1 benefits from tight phase damage', 'Taniks damage stacks from coordination'],
  },
  "Salvation's Edge": {
    summary: 'Latest endgame raid. High mechanical density with contest-mode legacy mechanics.',
    tips: ['Treat each encounter as a puzzle first', 'Save heavy for boss DPS windows'],
  },
  'Grasp of Avarice': {
    summary: 'Loot cave dungeon. Gjallarhorn quest origin — star map navigation and wealth of riches.',
    tips: ['Ogre keys gate progress', 'Final chest room is a DPS check'],
  },
  'Shattered Throne': {
    summary: 'First dungeon — weekly ascendant challenge roots. Short but punishing solo flawless route.',
    tips: ['Wish-ender or strong bows help', 'Soloable in ~20 minutes with practice'],
  },
  'Spire of the Watcher': {
    summary: 'Seraph bunker dungeon. Horizontal platforming and scorch cannon puzzles.',
    tips: ['Assign two players to beacon duty', 'Persys adds hit hard — play cover'],
  },
  'Duality': {
    summary: 'Nightmare realm dungeon with bell swaps between timelines. Caiatl co-op finale.',
    tips: ['Bell timing separates clean runs', 'Standard bearers need fast callouts'],
  },
  'Ghosts of the Deep': {
    summary: 'Deep-sea Titan dungeon. Pressure plates, ghost rituals, and claustrophobic arenas.',
    tips: ['Add clear before mechanic steps', 'Final room is a race against rising water'],
  },
  'Pit of Heresy': {
    summary: 'Moon heresy dungeon. Crucible ball mechanics and a stomping boss finale.',
    tips: ['Wizard plates rotate — call early', 'Boss damage window after bell slam'],
  },
  'Prophecy': {
    summary: 'Nine-inspired dungeon with elemental themed arenas. Ball and Kell echo mechanics.',
    tips: ['Match subclass to encounter element when possible', 'Final Kell phase needs orb discipline'],
  },
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  normal: 'Normal',
  master: 'Master',
}

export function activityIntel(activity: FeaturedActivity) {
  const entry = LORE[activity.name]
  return {
    name: activity.name,
    difficulty: DIFFICULTY_LABEL[activity.difficulty] ?? activity.difficulty,
    summary:
      entry?.summary ??
      `${activity.name} is on rotation this week. Check fireteam requirements and power level before launching.`,
    tips: entry?.tips ?? ['Sync verified clears in Top Nest after completion', 'See Leaderboards for fastest teams'],
    resetsIn: activity.resetsIn,
  }
}
