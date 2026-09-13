import test from 'node:test'
import assert from 'node:assert/strict'
import { expansionFromChallengeId, heroPointTitle, nearestLandmarkName } from './skillChallenges'
import { collectMapResources, collectSkillChallenges } from './mapResources'
import { BUNDLED_TYRIA_SNAPSHOT } from './tyriaSnapshot'
import { filterAchievements } from './achievementFilter'
import { filterHeroPoints, filterMapResources, parseHeroPointIdList, parseMasteryUnlocked, unionHeroPointIds } from './progress'
import type { Gw2ResourceKind, HeroPoint } from './types'

test('expansionFromChallengeId maps known prefixes', () => {
  assert.equal(expansionFromChallengeId('0-7'), 'Core Tyria')
  assert.equal(expansionFromChallengeId('1-12'), 'Heart of Thorns')
  assert.equal(expansionFromChallengeId('2-4'), 'Path of Fire')
})

test('collectSkillChallenges reads maps and de-dupes ids', () => {
  const points = collectSkillChallenges({
    regions: {
      '4': {
        name: 'Kryta',
        maps: {
          '15': {
            id: 15,
            name: 'Queensdale',
            skill_challenges: [
              { id: '0-7', coord: [45135.5, 29863.7] },
              { id: '0-7', coord: [45135.5, 29863.7] },
            ],
            points_of_interest: {
              '1': { name: 'Temple of the Ages', type: 'landmark', coord: [45136, 29864] },
            },
          },
        },
      },
    },
  })
  assert.equal(points.length, 1)
  assert.equal(points[0].id, '0-7')
  assert.equal(points[0].kind, 'hero_point')
  assert.equal(points[0].mapName, 'Queensdale')
  assert.equal(points[0].regionName, 'Kryta')
  assert.equal(points[0].nearby, 'Temple of the Ages')
  assert.equal(heroPointTitle(points[0]), 'Temple of the Ages (Queensdale)')
})

test('collectSkillChallenges keeps challenges that have coordinates but no API id', () => {
  const points = collectSkillChallenges({
    regions: {
      '1': {
        name: 'Cantha',
        maps: {
          '1442': {
            id: 1442,
            name: 'Seitung Province',
            skill_challenges: [{ coord: [22226.2, 102476] }],
          },
        },
      },
    },
  })
  assert.equal(points.length, 1)
  assert.match(points[0].id, /^coord-1442-/)
  assert.equal(points[0].expansion, 'End of Dragons')
})

test('bundled Tyria snapshot has markers for every tracked resource kind', () => {
  const kinds = new Set(BUNDLED_TYRIA_SNAPSHOT.points.map((p) => p.kind))
  assert.ok(BUNDLED_TYRIA_SNAPSHOT.points.length > 1500)
  assert.deepEqual(BUNDLED_TYRIA_SNAPSHOT.continent.dims, [81920, 114688])
  assert.ok(kinds.has('hero_point'))
  assert.ok(kinds.has('mastery'))
  assert.ok(kinds.has('vista'))
  assert.ok(kinds.has('waypoint'))
  assert.ok(kinds.has('heart'))
})

test('collectMapResources includes vistas, waypoints, hearts, and mastery insights', () => {
  const points = collectMapResources({
    regions: {
      '4': {
        name: 'Kryta',
        maps: {
          '15': {
            id: 15,
            name: 'Queensdale',
            skill_challenges: [{ id: '0-7', coord: [100, 100] }],
            mastery_points: [{ id: 44, coord: [200, 200], region: 'Tyria' }],
            points_of_interest: {
              '8': { id: 8, name: 'Village Waypoint', type: 'waypoint', coord: [300, 300] },
              '9': { id: 9, name: 'Hill Vista', type: 'vista', coord: [400, 400] },
              '10': { id: 10, name: 'A landmark', type: 'landmark', coord: [101, 101] },
            },
            tasks: { '3': { id: 3, objective: 'Help the farmers', coord: [500, 500] } },
          },
        },
      },
    },
  })
  const kinds = points.map((p) => p.kind).sort()
  assert.deepEqual(kinds, ['heart', 'hero_point', 'mastery', 'vista', 'waypoint'])
  assert.equal(points.find((p) => p.kind === 'waypoint')?.trackable, false)
  assert.equal(points.find((p) => p.kind === 'mastery')?.id, 'mastery-44')
})

test('nearestLandmarkName ignores far POIs', () => {
  assert.equal(
    nearestLandmarkName([0, 0], { a: { name: 'Far', type: 'landmark', coord: [20000, 20000] } }),
    null
  )
})

test('parse and union heropoint ids', () => {
  assert.deepEqual(parseHeroPointIdList(['0-1', '0-1', 3, ' 0-2 ']), ['0-1', '0-2'])
  assert.deepEqual(unionHeroPointIds([['0-1'], ['0-2', '0-1']]).sort(), ['0-1', '0-2'])
  assert.deepEqual(parseMasteryUnlocked({ unlocked: [1, 1, '2'] }), ['mastery-1', 'mastery-2'])
})

const samplePoints: HeroPoint[] = [
  {
    id: '0-1',
    kind: 'hero_point',
    x: 1,
    y: 1,
    mapId: 1,
    mapName: 'Queensdale',
    regionName: 'Kryta',
    expansion: 'Core Tyria',
    nearby: null,
    name: 'Queensdale hero challenge',
    trackable: true,
  },
  {
    id: 'waypoint-8',
    kind: 'waypoint',
    x: 2,
    y: 2,
    mapId: 1,
    mapName: 'Queensdale',
    regionName: 'Kryta',
    expansion: 'Core Tyria',
    nearby: null,
    name: 'Village Waypoint',
    trackable: false,
  },
]

test('filterHeroPoints splits completed vs incomplete', () => {
  const done = new Set(['0-1'])
  assert.equal(filterHeroPoints(samplePoints, done, 'completed')[0]?.id, '0-1')
  assert.equal(filterHeroPoints(samplePoints, done, 'untracked')[0]?.id, 'waypoint-8')
  assert.equal(filterHeroPoints(samplePoints, done, 'all').length, 2)
})

test('filterMapResources searches name and kind', () => {
  const visible = filterMapResources(samplePoints, new Set(), {
    filter: 'all',
    kinds: new Set<Gw2ResourceKind>(['waypoint']),
    query: 'village',
  })
  assert.equal(visible.length, 1)
  assert.equal(visible[0].id, 'waypoint-8')
})

test('filterAchievements searches and filters by group/status', () => {
  const items = [
    {
      id: 1,
      name: 'Map Completionist',
      groupId: 10,
      groupName: 'Exploration',
      categoryId: 2,
      categoryName: 'Tyria',
      done: true,
      current: 1,
      max: 1,
    },
    {
      id: 2,
      name: 'Dungeon Pioneer',
      groupId: 11,
      groupName: 'Dungeons',
      categoryId: 3,
      categoryName: 'Ascalon',
      done: false,
      current: 0,
      max: 1,
    },
  ]
  assert.equal(filterAchievements(items, { query: 'dungeon' })[0]?.id, 2)
  assert.equal(filterAchievements(items, { status: 'completed' }).length, 1)
  assert.equal(filterAchievements(items, { groupId: 11 }).length, 1)
})
