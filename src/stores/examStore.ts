import { create } from 'zustand'
import { gradeQuestion } from '../core/grading'
import {
  deleteExamResultsByLibrary,
  loadStoredExamResults,
  saveExamResult,
  saveExamResults,
} from '../core/storage'
import type { ExamResult } from '../types'
import { useLibraryStore } from './libraryStore'
import { useSessionStore } from './sessionStore'

type ExamStoreState = {
  results: Record<string, ExamResult>
  initialized: boolean
  initialize: () => Promise<void>
  restoreBackup: (results: ExamResult[]) => Promise<void>
  clearResultsForLibrary: (libraryId: string) => Promise<number>
  submitCurrentExam: (timedOut?: boolean) => Promise<ExamResult | undefined>
  getResultBySessionId: (sessionId: string) => ExamResult | undefined
  getRecentResults: (libraryId?: string) => ExamResult[]
}

export const useExamStore = create<ExamStoreState>((set, get) => ({
  results: {},
  initialized: false,

  initialize: async () => {
    if (get().initialized) {
      return
    }

    const results = await loadStoredExamResults()

    set({
      initialized: true,
      results: Object.fromEntries(results.map((result) => [result.sessionId, result])),
    })
  },

  restoreBackup: async (results) => {
    await saveExamResults(results)

    set((state) => ({
      results: {
        ...state.results,
        ...Object.fromEntries(results.map((result) => [result.sessionId, result])),
      },
    }))
  },

  clearResultsForLibrary: async (libraryId) => {
    const deletedCount = await deleteExamResultsByLibrary(libraryId)

    set((state) => ({
      results: Object.fromEntries(
        Object.entries(state.results).filter(([, result]) => result.libraryId !== libraryId),
      ),
    }))

    return deletedCount
  },

  submitCurrentExam: async (timedOut = false) => {
    const sessionState = useSessionStore.getState()
    const session = sessionState.currentSession

    if (!session || session.mode !== 'exam') {
      return undefined
    }

    const existing = get().results[session.id]

    if (existing) {
      return existing
    }

    const submittedAt = Date.now()
    const questionResults = session.questionIds.map((questionId) => {
      const question = useLibraryStore.getState().getQuestionById(questionId)
      const selected = session.answers[questionId]?.selected ?? []

      if (!question || !question.scorable) {
        return {
          questionId,
          selected,
          isCorrect: false,
        }
      }

      const grade = gradeQuestion(question, selected)

      return {
        questionId,
        selected: grade.normalizedSelected,
        isCorrect: grade.isCorrect,
      }
    })

    const correctCount = questionResults.filter((item) => item.isCorrect).length
    const totalQuestions = session.questionIds.length
    const result: ExamResult = {
      id: `exam-result-${submittedAt}`,
      sessionId: session.id,
      libraryId: session.libraryId,
      startedAt: session.startedAt,
      submittedAt,
      durationSeconds: Math.max(1, Math.floor((submittedAt - session.startedAt) / 1000)),
      totalQuestions,
      correctCount,
      accuracy: totalQuestions > 0 ? correctCount / totalQuestions : 0,
      timedOut,
      questionResults,
    }

    await saveExamResult(result)
    useSessionStore.getState().completeCurrentSession(submittedAt)

    set((state) => ({
      results: {
        ...state.results,
        [session.id]: result,
      },
    }))

    return result
  },

  getResultBySessionId: (sessionId) => get().results[sessionId],

  getRecentResults: (libraryId) =>
    Object.values(get().results)
      .filter((result) => (libraryId ? result.libraryId === libraryId : true))
      .sort((left, right) => right.submittedAt - left.submittedAt),
}))
