export type QuestionType = 'single' | 'multiple' | 'boolean'
export type SourceType = 'builtin' | 'imported'
export type DiagnosticSeverity = 'info' | 'warning' | 'error'
export type MemoryLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type QuestionOption = {
  key: string
  label: string
}

export type AssetStatus = 'ok' | 'missing' | 'local-only'

export type AssetReference = {
  id: string
  questionId: string
  originalPath: string
  resolvedUrl?: string
  status: AssetStatus
}

export type Question = {
  id: string
  libraryId: string
  sourcePath?: string
  title: string
  type: QuestionType
  body: string
  options: QuestionOption[]
  answer: string[]
  explanation: string
  tags: string[]
  difficulty: number
  scorable: boolean
  assets: AssetReference[]
  diagnostics: string[]
  createdAt: number
  updatedAt: number
}

export type LibraryManifest = {
  id: string
  name: string
  version?: string
  sourceType: SourceType
  questionIds: string[]
  createdAt: number
  updatedAt: number
  questionCount: number
  scorableCount: number
  meta?: Record<string, unknown>
}

export type DiagnosticIssueType =
  | 'missing-id'
  | 'missing-answer'
  | 'duplicate-id'
  | 'invalid-type'
  | 'option-answer-mismatch'
  | 'markdown-error'
  | 'asset-missing'

export type DiagnosticIssue = {
  id: string
  libraryId: string
  questionId?: string
  type: DiagnosticIssueType
  severity: DiagnosticSeverity
  message: string
  createdAt: number
}

export type MemoryRecord = {
  questionId: string
  libraryId: string
  level: MemoryLevel
  lastReviewedAt?: number
  nextReviewAt?: number
  streakCorrect: number
  streakWrong: number
  totalCorrect: number
  totalWrong: number
  lastResult?: 'correct' | 'wrong'
  updatedAt: number
}

export type ImportSourceType = 'folder' | 'files' | 'json-backup'

export type ImportRecord = {
  id: string
  libraryId: string
  sourceType: ImportSourceType
  fileCount: number
  importedAt: number
  success: boolean
  summary?: string
}
