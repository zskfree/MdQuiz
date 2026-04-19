import type { MemoryLevel, MemoryRecord } from '../../types'
import { getNextLevel, LEVEL_INTERVAL_DAYS } from './level-rules'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function createMemoryRecordKey(libraryId: string, questionId: string): string {
  return `${libraryId}::${questionId}`
}

export function addDays(baseTimestamp: number, days: number): number {
  return baseTimestamp + days * DAY_IN_MS
}

export function getNextReviewAt(level: MemoryLevel, reviewedAt: number): number {
  return addDays(reviewedAt, LEVEL_INTERVAL_DAYS[level])
}

type UpdateMemoryRecordInput = {
  current?: MemoryRecord
  questionId: string
  libraryId: string
  isCorrect: boolean
  reviewedAt?: number
}

export function updateMemoryRecord(input: UpdateMemoryRecordInput): MemoryRecord {
  const reviewedAt = input.reviewedAt ?? Date.now()
  const previous = input.current
  const currentLevel = previous?.level ?? 1
  const nextLevel = getNextLevel(currentLevel, input.isCorrect)

  return {
    questionId: input.questionId,
    libraryId: input.libraryId,
    level: nextLevel,
    lastReviewedAt: reviewedAt,
    nextReviewAt: getNextReviewAt(nextLevel, reviewedAt),
    streakCorrect: input.isCorrect ? (previous?.streakCorrect ?? 0) + 1 : 0,
    streakWrong: input.isCorrect ? 0 : (previous?.streakWrong ?? 0) + 1,
    totalCorrect: (previous?.totalCorrect ?? 0) + (input.isCorrect ? 1 : 0),
    totalWrong: (previous?.totalWrong ?? 0) + (input.isCorrect ? 0 : 1),
    lastResult: input.isCorrect ? 'correct' : 'wrong',
    updatedAt: reviewedAt,
  }
}
