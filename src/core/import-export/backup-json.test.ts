import { describe, expect, it } from 'vitest'
import { createBackupFilename, createBackupPayload, parseBackupPayload } from './backup-json'

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
})
