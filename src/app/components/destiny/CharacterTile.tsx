'use client'

import type { CharacterSummary, DestinyCharacterClass } from '@/lib/destiny/types'
import { DIM_CLASS_COLORS } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

function classLabel(characterClass: DestinyCharacterClass) {
  return characterClass.charAt(0).toUpperCase() + characterClass.slice(1)
}

export interface CharacterTileProps {
  character: CharacterSummary
  /** Highlight as the active / highest-power character (DIM orange corner). */
  isCurrent?: boolean
  /** Optional subtitle under class name (title, subclass, etc.). */
  subtitle?: string
  className?: string
  compact?: boolean
}

/** DIM-style horizontal character tile — emblem banner, class, power. */
export default function CharacterTile({
  character,
  isCurrent = false,
  subtitle,
  className,
  compact = false,
}: CharacterTileProps) {
  const bgUrl = character.emblemBackgroundUrl ?? character.emblemUrl
  const classFallback = DIM_CLASS_COLORS[character.characterClass]

  return (
    <div
      className={cn(
        'dim-character-tile',
        compact && 'dim-character-tile-compact',
        isCurrent && 'dim-character-tile-current',
        className
      )}
      style={
        bgUrl
          ? ({ '--dim-emblem-url': `url("${bgUrl}")` } as React.CSSProperties)
          : ({ '--dim-class-color': classFallback } as React.CSSProperties)
      }
      title={`${classLabel(character.characterClass)} · ${character.powerLevel}`}
    >
      {character.classRef?.iconUrl ? (
        <img src={character.classRef.iconUrl} alt="" className="dim-character-tile-icon" />
      ) : null}

      <span className="dim-character-tile-class">{classLabel(character.characterClass)}</span>

      <span className="dim-character-tile-power">{character.powerLevel}</span>

      {subtitle ? (
        <span className="dim-character-tile-subtitle">{subtitle}</span>
      ) : character.title ? (
        <span className="dim-character-tile-subtitle dim-character-tile-title">{character.title}</span>
      ) : null}
    </div>
  )
}

/** Row of character tiles matching DIM inventory header layout. */
export function CharacterTileRow({
  characters,
  activeCharacterId,
  subtitleFor,
  compact,
  className,
}: {
  characters: CharacterSummary[]
  activeCharacterId?: string
  subtitleFor?: (character: CharacterSummary) => string | undefined
  compact?: boolean
  className?: string
}) {
  if (!characters.length) return null

  return (
    <div className={cn('dim-character-row', className)}>
      {characters.map((character) => (
        <CharacterTile
          key={character.characterId}
          character={character}
          isCurrent={character.characterId === activeCharacterId}
          subtitle={subtitleFor?.(character)}
          compact={compact}
        />
      ))}
    </div>
  )
}
