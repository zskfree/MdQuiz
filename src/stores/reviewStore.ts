import { create } from 'zustand'
import {
  createMemoryRecordKey,
  getDueReviewQueue,
  getLevelDistribution,
  updateMemoryRecord,
} from '../core/memory'
import {
  deleteMemoryRecordsByLibrary,
  loadMemoryRecords,
  saveMemoryRecord,
  saveMemoryRecords,
} from '../core/storage'
import type { MemoryLevel, MemoryRecord } from '../types'

type ReviewStoreState = {
  memoryRecords: Record<string, MemoryRecord>
  initialized: boolean
  initialize: () => Promise<void>
  restoreBackup: (records: MemoryRecord[]) => Promise<void>
  applyReviewResult: (input: {
    questionId: string
    libraryId: string
    isCorrect: boolean
    reviewedAt?: number
  }) => MemoryRecord
  getMemoryRecord: (libraryId: string, questionId: string) => MemoryRecord | undefined
  clearRecordsForLibrary: (libraryId: string) => Promise<number>
  getDueCount: (libraryId?: string, now?: number) => number
  getDueQuestionIds: (libraryId?: string, now?: number) => string[]
  getWrongQuestionIds: (libraryId?: string) => string[]
  getLevelStats: (libraryId?: string) => Record<MemoryLevel, number>
}

export const useReviewStore = create<ReviewStoreState>((set, get) => ({
  memoryRecords: {},
  initialized: false,

  initialize: async () => {
    if (get().initialized) {
      return
    }

    const records = await loadMemoryRecords()
    set({
      initialized: true,
      memoryRecords: Object.fromEntries(
        records.map((record) => [createMemoryRecordKey(record.libraryId, record.questionId), record]),
      ),
    })
  },

  restoreBackup: async (records) => {
    await saveMemoryRecords(records)

    set((state) => ({
      memoryRecords: {
        ...state.memoryRecords,
        ...Object.fromEntries(
          records.map((record) => [createMemoryRecordKey(record.libraryId, record.questionId), record]),
        ),
      },
    }))
  },

  applyReviewResult: (input) => {
    const recordKey = createMemoryRecordKey(input.libraryId, input.questionId)
    const current = get().memoryRecords[recordKey]
    const nextRecord = updateMemoryRecord({
      current,
      questionId: input.questionId,
      libraryId: input.libraryId,
      isCorrect: input.isCorrect,
      reviewedAt: input.reviewedAt,
    })

    set((state) => ({
      memoryRecords: {
        ...state.memoryRecords,
        [recordKey]: nextRecord,
      },
    }))
    void saveMemoryRecord(nextRecord)

    return nextRecord
  },

  getMemoryRecord: (libraryId, questionId) => get().memoryRecords[createMemoryRecordKey(libraryId, questionId)],

  clearRecordsForLibrary: async (libraryId) => {
    const deletedCount = await deleteMemoryRecordsByLibrary(libraryId)

    set((state) => ({
      memoryRecords: Object.fromEntries(
        Object.entries(state.memoryRecords).filter(([, record]) => record.libraryId !== libraryId),
      ),
    }))

    return deletedCount
  },

  getDueCount: (libraryId, now = Date.now()) =>
    getDueReviewQueue(
      Object.values(get().memoryRecords).filter((record) =>
        libraryId ? record.libraryId === libraryId : true,
      ),
      now,
    ).length,

  getDueQuestionIds: (libraryId, now = Date.now()) =>
    getDueReviewQueue(
      Object.values(get().memoryRecords).filter((record) =>
        libraryId ? record.libraryId === libraryId : true,
      ),
      now,
    ).map((record) => record.questionId),

  getWrongQuestionIds: (libraryId) =>
    Object.values(get().memoryRecords)
      .filter((record) => (libraryId ? record.libraryId === libraryId : true))
      .filter((record) => record.totalWrong > 0)
      .sort((left, right) => {
        const leftReviewed = left.lastReviewedAt ?? 0
        const rightReviewed = right.lastReviewedAt ?? 0
        return rightReviewed - leftReviewed
      })
      .map((record) => record.questionId),

  getLevelStats: (libraryId) =>
    getLevelDistribution(
      Object.values(get().memoryRecords).filter((record) =>
        libraryId ? record.libraryId === libraryId : true,
      ),
    ),
}))
