import type { MemoryLevel } from '../../types'

export const LEVEL_INTERVAL_DAYS: Record<MemoryLevel, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 4,
  5: 7,
  6: 15,
  7: 30,
}

export function clampMemoryLevel(level: number): MemoryLevel {
  if (level <= 1) {
    return 1
  }

  if (level >= 7) {
    return 7
  }

  return level as MemoryLevel
}

export function getNextLevel(currentLevel: MemoryLevel, isCorrect: boolean): MemoryLevel {
  return isCorrect ? clampMemoryLevel(currentLevel + 1) : clampMemoryLevel(currentLevel - 2)
}
