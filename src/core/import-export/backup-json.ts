import type {
  DiagnosticIssue,
  ExamResult,
  LibraryManifest,
  MemoryRecord,
  Question,
  QuizSession,
} from '../../types'

export type BackupPayload = {
  app: 'mdquiz'
  version: 1
  exportedAt: number
  meta: {
    activeLibraryId?: string
  }
  data: {
    libraries: LibraryManifest[]
    questions: Question[]
    diagnostics: DiagnosticIssue[]
    memoryRecords: MemoryRecord[]
    sessions: QuizSession[]
    examResults: ExamResult[]
  }
}

type CreateBackupPayloadInput = {
  activeLibraryId?: string
  libraries: LibraryManifest[]
  questions: Question[]
  diagnostics: DiagnosticIssue[]
  memoryRecords: MemoryRecord[]
  sessions: QuizSession[]
  examResults: ExamResult[]
}

type CreateLibraryBackupPayloadInput = {
  activeLibraryId?: string
  library: LibraryManifest
  questions: Question[]
  diagnostics: DiagnosticIssue[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createBackupPayload(input: CreateBackupPayloadInput): BackupPayload {
  return {
    app: 'mdquiz',
    version: 1,
    exportedAt: Date.now(),
    meta: {
      activeLibraryId: input.activeLibraryId,
    },
    data: {
      libraries: input.libraries,
      questions: input.questions,
      diagnostics: input.diagnostics,
      memoryRecords: input.memoryRecords,
      sessions: input.sessions,
      examResults: input.examResults,
    },
  }
}

function sanitizeFilenameSegment(value: string): string {
  const normalized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
  const collapsed = normalized.replace(/\s+/g, ' ').replace(/-+/g, '-').trim()
  return collapsed.length > 0 ? collapsed : 'library'
}

export function createLibraryBackupPayload(input: CreateLibraryBackupPayloadInput): BackupPayload {
  return createBackupPayload({
    activeLibraryId: input.activeLibraryId ?? input.library.id,
    libraries: [input.library],
    questions: input.questions,
    diagnostics: input.diagnostics,
    memoryRecords: [],
    sessions: [],
    examResults: [],
  })
}

export function parseBackupPayload(raw: string): BackupPayload {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('备份文件内容格式有误，请检查后重试。')
  }

  if (!isObject(parsed) || parsed.app !== 'mdquiz' || parsed.version !== 1 || !isObject(parsed.data)) {
    throw new Error('备份文件格式无效。')
  }

  const data = parsed.data

  if (
    !Array.isArray(data.libraries) ||
    !Array.isArray(data.questions) ||
    !Array.isArray(data.diagnostics) ||
    !Array.isArray(data.memoryRecords) ||
    !Array.isArray(data.sessions) ||
    !Array.isArray(data.examResults)
  ) {
    throw new Error('备份文件缺少必要的数据数组。')
  }

  return parsed as BackupPayload
}

export function createBackupFilename(timestamp = Date.now()): string {
  const iso = new Date(timestamp).toISOString().replace(/[:.]/g, '-')
  return `mdquiz-backup-${iso}.json`
}

export function createLibraryBackupFilename(libraryName: string, timestamp = Date.now()): string {
  const iso = new Date(timestamp).toISOString().replace(/[:.]/g, '-')
  return `mdquiz-library-${sanitizeFilenameSegment(libraryName)}-${iso}.json`
}
