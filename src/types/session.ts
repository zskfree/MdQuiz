import type { QuestionType } from './domain'

export type SessionMode =
  | 'sequential'
  | 'random'
  | 'exam'
  | 'filtered'
  | 'spaced-review'

export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned'

export type SessionAnswer = {
  questionId: string
  selected: string[]
  submitted: boolean
  isCorrect?: boolean
  answeredAt?: number
  revealedExplanation: boolean
}

export type SessionConfig = {
  timeLimitSeconds?: number
  questionLimit?: number
  tagFilter?: string[]
  typeFilter?: QuestionType[]
  difficultyFilter?: number[]
  onlyWrong?: boolean
  onlyDue?: boolean
  quickMode?: boolean
}

export type QuizSession = {
  id: string
  mode: SessionMode
  libraryId: string
  questionIds: string[]
  currentIndex: number
  startedAt: number
  endedAt?: number
  status: SessionStatus
  answers: Record<string, SessionAnswer>
  marks: Record<string, boolean>
  config: SessionConfig
  createdAt: number
  updatedAt: number
}

export type ExamQuestionResult = {
  questionId: string
  selected: string[]
  isCorrect: boolean
}

export type ExamResult = {
  id: string
  sessionId: string
  libraryId: string
  startedAt: number
  submittedAt: number
  durationSeconds: number
  totalQuestions: number
  correctCount: number
  accuracy: number
  timedOut: boolean
  questionResults: ExamQuestionResult[]
}
