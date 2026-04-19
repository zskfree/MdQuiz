import { create } from 'zustand'
import { gradeQuestion } from '../core/grading'
import { deleteSessionsByLibrary, loadStoredSessions, saveSession, saveSessions } from '../core/storage'
import type { QuizSession, SessionAnswer, SessionConfig, SessionMode } from '../types'
import { useLibraryStore } from './libraryStore'
import { useReviewStore } from './reviewStore'

type SessionStoreState = {
  currentSession?: QuizSession
  initialized: boolean
  feedback?: {
    questionId: string
    isCorrect: boolean
    expected: string[]
    selected: string[]
  }
  initialize: () => Promise<void>
  restoreBackup: (sessions: QuizSession[]) => Promise<void>
  startSequentialSession: (libraryId: string, questionIds: string[]) => Promise<void>
  startFilteredSession: (
    mode: Extract<SessionMode, 'filtered' | 'spaced-review'>,
    libraryId: string,
    questionIds: string[],
    config?: SessionConfig,
  ) => void
  startExamSession: (
    libraryId: string,
    questionIds: string[],
    config?: SessionConfig,
  ) => void
  toggleQuickMode: () => void
  selectOption: (questionId: string, optionKey: string) => void
  submitCurrentAnswer: () => void
  goToPreviousQuestion: () => void
  setCurrentIndex: (index: number) => void
  goToNextQuestion: () => void
  completeCurrentSession: (endedAt?: number) => void
  clearCurrentSession: () => void
  clearSessionsForLibrary: (libraryId: string) => Promise<number>
  toggleMarkedQuestion: (questionId?: string) => void
  toggleExplanation: () => void
  getCurrentQuestionId: () => string | undefined
  getCurrentAnswer: () => SessionAnswer | undefined
}

function createBlankAnswer(questionId: string): SessionAnswer {
  return {
    questionId,
    selected: [],
    submitted: false,
    revealedExplanation: false,
  }
}

function createSession(
  mode: SessionMode,
  libraryId: string,
  questionIds: string[],
  config: SessionConfig = {},
): QuizSession {
  const now = Date.now()

  return {
    id: `session-${mode}-${now}`,
    mode,
    libraryId,
    questionIds,
    currentIndex: 0,
    startedAt: now,
    status: 'active',
    answers: {},
    marks: {},
    config,
    createdAt: now,
    updatedAt: now,
  }
}

function isResumableSequentialSession(session: QuizSession, libraryId: string): boolean {
  return (
    session.mode === 'sequential' &&
    session.libraryId === libraryId &&
    (session.status === 'active' || session.status === 'paused')
  )
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  currentSession: undefined,
  initialized: false,
  feedback: undefined,

  initialize: async () => {
    if (get().initialized) {
      return
    }

    const sessions = await loadStoredSessions()
    const activeSession = sessions
      .filter((session) => session.status === 'active' || session.status === 'paused')
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]

    set({
      currentSession: activeSession,
      initialized: true,
    })
  },

  restoreBackup: async (sessions) => {
    await saveSessions(sessions)

    const activeSession = sessions
      .filter((session) => session.status === 'active' || session.status === 'paused')
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]

    set({
      currentSession: activeSession ?? get().currentSession,
    })
  },

  startSequentialSession: async (libraryId, questionIds) => {
    const currentSession = get().currentSession

    if (currentSession && isResumableSequentialSession(currentSession, libraryId)) {
      set({
        currentSession,
        feedback: undefined,
      })
      return
    }

    const storedSessions = await loadStoredSessions()
    const resumableSession = storedSessions
      .filter((session) => isResumableSequentialSession(session, libraryId))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]

    if (resumableSession) {
      set({
        currentSession: resumableSession,
        feedback: undefined,
      })
      return
    }

    const session = createSession('sequential', libraryId, questionIds)

    set({
      currentSession: session,
      feedback: undefined,
    })
    void saveSession(session)
  },

  startFilteredSession: (mode, libraryId, questionIds, config = {}) => {
    const session = createSession(mode, libraryId, questionIds, config)

    set({
      currentSession: session,
      feedback: undefined,
    })
    void saveSession(session)
  },

  startExamSession: (libraryId, questionIds, config = {}) => {
    const session = createSession('exam', libraryId, questionIds, config)

    set({
      currentSession: session,
      feedback: undefined,
    })
    void saveSession(session)
  },

  toggleQuickMode: () => {
    const session = get().currentSession

    if (!session) {
      return
    }

    const nextSession: QuizSession = {
      ...session,
      config: {
        ...session.config,
        quickMode: !session.config.quickMode,
      },
      updatedAt: Date.now(),
    }

    set({
      currentSession: nextSession,
      feedback: undefined,
    })
    void saveSession(nextSession)
  },

  selectOption: (questionId, optionKey) => {
    const session = get().currentSession

    if (!session) {
      return
    }

    const question = useLibraryStore.getState().getQuestionById(questionId)

    if (!question) {
      return
    }

    const previous = session.answers[questionId] ?? createBlankAnswer(questionId)

    if (previous.submitted) {
      return
    }

    const nextSelected =
      question.type === 'multiple'
        ? previous.selected.includes(optionKey)
          ? previous.selected.filter((item) => item !== optionKey)
          : [...previous.selected, optionKey]
        : [optionKey]

    const nextSession: QuizSession = {
      ...session,
      answers: {
        ...session.answers,
        [questionId]: {
          ...previous,
          selected: nextSelected,
        },
      },
      updatedAt: Date.now(),
    }

    set({
      currentSession: nextSession,
    })
    void saveSession(nextSession)
  },

  submitCurrentAnswer: () => {
    const session = get().currentSession

    if (!session) {
      return
    }

    const questionId = session.questionIds[session.currentIndex]
    const question = questionId ? useLibraryStore.getState().getQuestionById(questionId) : undefined

    if (!question) {
      return
    }

    const answer = session.answers[questionId] ?? createBlankAnswer(questionId)

    if (answer.submitted || answer.selected.length === 0) {
      return
    }

    if (session.mode === 'exam') {
      return
    }

    const grade = gradeQuestion(question, answer.selected)
    const answeredAt = Date.now()

    if (question.scorable) {
      useReviewStore.getState().applyReviewResult({
        questionId: question.id,
        libraryId: question.libraryId,
        isCorrect: grade.isCorrect,
        reviewedAt: answeredAt,
      })
    }

    const nextSession: QuizSession = {
      ...session,
      answers: {
        ...session.answers,
        [questionId]: {
          ...answer,
          submitted: true,
          isCorrect: grade.isCorrect,
          answeredAt,
          revealedExplanation: !session.config.quickMode,
        },
      },
      updatedAt: answeredAt,
    }

    set({
      currentSession: nextSession,
      feedback: {
        questionId,
        isCorrect: grade.isCorrect,
        expected: grade.normalizedExpected,
        selected: grade.normalizedSelected,
      },
    })
    void saveSession(nextSession)
  },

  goToPreviousQuestion: () => {
    const session = get().currentSession

    if (!session) {
      return
    }

    const nextSession: QuizSession = {
      ...session,
      currentIndex: Math.max(session.currentIndex - 1, 0),
      updatedAt: Date.now(),
    }

    set({
      currentSession: nextSession,
      feedback: undefined,
    })
    void saveSession(nextSession)
  },

  setCurrentIndex: (index) => {
    const session = get().currentSession

    if (!session) {
      return
    }

    const nextSession: QuizSession = {
      ...session,
      currentIndex: Math.min(Math.max(index, 0), Math.max(session.questionIds.length - 1, 0)),
      updatedAt: Date.now(),
    }

    set({
      currentSession: nextSession,
      feedback: undefined,
    })
    void saveSession(nextSession)
  },

  goToNextQuestion: () => {
    const session = get().currentSession

    if (!session) {
      return
    }

    const nextIndex = Math.min(session.currentIndex + 1, session.questionIds.length - 1)
    const isCompleted = nextIndex === session.currentIndex

    const nextSession: QuizSession = {
      ...session,
      currentIndex: nextIndex,
      status: isCompleted ? 'completed' : session.status,
      endedAt: isCompleted ? Date.now() : session.endedAt,
      updatedAt: Date.now(),
    }

    set({
      currentSession: nextSession,
      feedback: undefined,
    })
    void saveSession(nextSession)
  },

  completeCurrentSession: (endedAt = Date.now()) => {
    const session = get().currentSession

    if (!session) {
      return
    }

    const nextSession: QuizSession = {
      ...session,
      status: 'completed',
      endedAt,
      updatedAt: endedAt,
    }

    set({
      currentSession: nextSession,
      feedback: undefined,
    })
    void saveSession(nextSession)
  },

  clearCurrentSession: () => {
    set({
      currentSession: undefined,
      feedback: undefined,
    })
  },

  clearSessionsForLibrary: async (libraryId) => {
    const deletedCount = await deleteSessionsByLibrary(libraryId)

    set((state) => ({
      currentSession: state.currentSession?.libraryId === libraryId ? undefined : state.currentSession,
      feedback: state.currentSession?.libraryId === libraryId ? undefined : state.feedback,
    }))

    return deletedCount
  },

  toggleMarkedQuestion: (questionId) => {
    const session = get().currentSession
    const currentQuestionId = questionId ?? get().getCurrentQuestionId()

    if (!session || !currentQuestionId) {
      return
    }

    const nextSession: QuizSession = {
      ...session,
      marks: {
        ...session.marks,
        [currentQuestionId]: !session.marks[currentQuestionId],
      },
      updatedAt: Date.now(),
    }

    set({
      currentSession: nextSession,
    })
    void saveSession(nextSession)
  },

  toggleExplanation: () => {
    const session = get().currentSession
    const questionId = get().getCurrentQuestionId()

    if (!session || !questionId) {
      return
    }

    const answer = session.answers[questionId]

    if (!answer?.submitted) {
      return
    }

    const nextSession: QuizSession = {
      ...session,
      answers: {
        ...session.answers,
        [questionId]: {
          ...answer,
          revealedExplanation: !answer.revealedExplanation,
        },
      },
      updatedAt: Date.now(),
    }

    set({
      currentSession: nextSession,
    })
    void saveSession(nextSession)
  },

  getCurrentQuestionId: () => {
    const session = get().currentSession
    return session?.questionIds[session.currentIndex]
  },

  getCurrentAnswer: () => {
    const questionId = get().getCurrentQuestionId()
    const session = get().currentSession

    if (!questionId || !session) {
      return undefined
    }

    return session.answers[questionId] ?? createBlankAnswer(questionId)
  },
}))
