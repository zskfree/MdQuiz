import { describe, expect, it } from 'vitest'
import {
  createBackupFilename,
  createBackupPayload,
  createLibraryBackupFilename,
  createLibraryBackupPayload,
  parseBackupPayload,
} from './backup-json'

describe('backup json helpers', () => {
  it('creates and parses backup payloads', () => {
    const payload = createBackupPayload({
      activeLibraryId: 'lib-1',
      libraries: [],
      questions: [],
      diagnostics: [],
      memoryRecords: [],
      sessions: [],
      examResults: [],
    })

    const parsed = parseBackupPayload(JSON.stringify(payload))

    expect(parsed.app).toBe('mdquiz')
    expect(parsed.version).toBe(1)
    expect(parsed.meta.activeLibraryId).toBe('lib-1')
  })

  it('rejects invalid backup payloads', () => {
    expect(() => parseBackupPayload(JSON.stringify({ app: 'other' }))).toThrow()
  })

  it('creates stable backup filenames', () => {
    const filename = createBackupFilename(Date.UTC(2026, 0, 2, 3, 4, 5))
    expect(filename).toContain('mdquiz-backup-')
    expect(filename.endsWith('.json')).toBe(true)
  })

  it('creates single-library backup payloads without practice records', () => {
    const payload = createLibraryBackupPayload({
      library: {
        id: 'builtin-default',
        name: '中级电力交易员笔试题库',
        sourceType: 'builtin',
        questionIds: ['q1'],
        createdAt: 1,
        updatedAt: 1,
        questionCount: 1,
        scorableCount: 1,
      },
      questions: [],
      diagnostics: [],
    })

    expect(payload.meta.activeLibraryId).toBe('builtin-default')
    expect(payload.data.libraries).toHaveLength(1)
    expect(payload.data.memoryRecords).toEqual([])
    expect(payload.data.sessions).toEqual([])
    expect(payload.data.examResults).toEqual([])
  })

  it('creates library backup filenames from the library name', () => {
    const filename = createLibraryBackupFilename('中级/电力:交易员题库', Date.UTC(2026, 0, 2, 3, 4, 5))
    expect(filename).toContain('mdquiz-library-')
    expect(filename).not.toContain('/')
    expect(filename).not.toContain(':')
    expect(filename.endsWith('.json')).toBe(true)
  })
})
