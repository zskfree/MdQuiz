import type {
  DiagnosticIssue,
  ImportRecord,
  LibraryManifest,
  MemoryRecord,
  Question,
} from './domain'
import type { ExamResult, QuizSession } from './session'

export const DB_NAME = 'mdquiz-db'
export const DB_VERSION = 2

export const STORE_NAMES = {
  libraries: 'libraries',
  questions: 'questions',
  diagnostics: 'diagnostics',
  sessions: 'sessions',
  memoryRecords: 'memoryRecords',
  examResults: 'examResults',
  imports: 'imports',
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]

export type MdQuizDBSchema = {
  libraries: LibraryManifest
  questions: Question
  diagnostics: DiagnosticIssue
  sessions: QuizSession
  memoryRecords: MemoryRecord
  examResults: ExamResult
  imports: ImportRecord
}

export type PreferencesState = {
  theme: 'light' | 'dark' | 'system'
  optionKeyMode: 'letters' | 'numbers' | 'both'
  showKeyboardHints: boolean
  lastOpenedLibraryId?: string
}

export type UiState = {
  reviewBoardCollapsed?: boolean
  diagnosticsFilter?: string
}
