import { describe, expect, it } from 'vitest'
import { getDueReviewQueue, getLevelDistribution } from './review-queue'
import { createMemoryRecordKey, updateMemoryRecord } from './schedule'

describe('memory scheduling', () => {
  it('upgrades level and schedules next review on correct answer', () => {
    const record = updateMemoryRecord({
      questionId: 'q1',
      libraryId: 'lib-1',
      isCorrect: true,
      reviewedAt: 1_700_000_000_000,
    })

    expect(record.level).toBe(2)
    expect(record.streakCorrect).toBe(1)
    expect(record.totalCorrect).toBe(1)
    expect(record.nextReviewAt).toBe(1_700_000_000_000 + 24 * 60 * 60 * 1000)
  })

  it('drops two levels on wrong answer and returns due queue', () => {
    const upgraded = updateMemoryRecord({
      questionId: 'q1',
      libraryId: 'lib-1',
      isCorrect: true,
      reviewedAt: 1_700_000_000_000,
    })

    const dropped = updateMemoryRecord({
      current: { ...upgraded, level: 5, nextReviewAt: 1_700_000_000_000 },
      questionId: 'q1',
      libraryId: 'lib-1',
      isCorrect: false,
      reviewedAt: 1_700_000_100_000,
    })

    expect(dropped.level).toBe(3)
    expect(dropped.streakWrong).toBe(1)
    expect(dropped.totalWrong).toBe(1)

    const notDueYet = getDueReviewQueue(
      [
        dropped,
        {
          ...dropped,
          questionId: 'q2',
          nextReviewAt: 1_800_000_000_000,
          updatedAt: 1_800_000_000_000,
        },
      ],
      1_700_000_200_000,
    )

    expect(notDueYet.map((item) => item.questionId)).toEqual([])

    const dueLater = getDueReviewQueue(
      [dropped],
      dropped.nextReviewAt ?? 1_700_000_200_000,
    )

    expect(dueLater.map((item) => item.questionId)).toEqual(['q1'])
  })

  it('builds level distribution', () => {
    const distribution = getLevelDistribution([
      { level: 1 },
      { level: 1 },
      { level: 4 },
      { level: 7 },
    ])

    expect(distribution[1]).toBe(2)
    expect(distribution[4]).toBe(1)
    expect(distribution[7]).toBe(1)
  })

  it('creates isolated memory record keys for different libraries', () => {
    expect(createMemoryRecordKey('lib-a', 'q1')).toBe('lib-a::q1')
    expect(createMemoryRecordKey('lib-a', 'q1')).not.toBe(createMemoryRecordKey('lib-b', 'q1'))
  })
})
