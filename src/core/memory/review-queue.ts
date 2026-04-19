import type { MemoryLevel, MemoryRecord } from '../../types'

export function isDueForReview(record: Pick<MemoryRecord, 'nextReviewAt'>, now = Date.now()): boolean {
  if (record.nextReviewAt == null) {
    return true
  }

  return record.nextReviewAt <= now
}

export function sortReviewQueue<T extends Pick<MemoryRecord, 'nextReviewAt' | 'updatedAt'>>(
  records: T[],
): T[] {
  return [...records].sort((left, right) => {
    const leftDue = left.nextReviewAt ?? 0
    const rightDue = right.nextReviewAt ?? 0

    if (leftDue !== rightDue) {
      return leftDue - rightDue
    }

    return right.updatedAt - left.updatedAt
  })
}

export function getDueReviewQueue<T extends MemoryRecord>(
  records: T[],
  now = Date.now(),
): T[] {
  return sortReviewQueue(records.filter((record) => isDueForReview(record, now)))
}

export function getLevelDistribution(records: Array<Pick<MemoryRecord, 'level'>>): Record<MemoryLevel, number> {
  const distribution: Record<MemoryLevel, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
  }

  for (const record of records) {
    distribution[record.level] += 1
  }

  return distribution
}
