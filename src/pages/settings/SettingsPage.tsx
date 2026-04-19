import { useState } from 'react'
import { createBackupFilename, createBackupPayload, parseBackupPayload } from '../../core/import-export'
import { useExamStore, useLibraryStore, useReviewStore, useSessionStore } from '../../stores'

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function resolveVisibleError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message
  }

  return fallbackMessage
}

export function SettingsPage() {
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const libraries = useLibraryStore((state) => state.getAllLibraries())
  const activeLibrary = useLibraryStore((state) => state.getActiveLibrary())
  const questions = useLibraryStore((state) => state.questions)
  const diagnostics = useLibraryStore((state) => state.diagnostics)
  const restoreLibraries = useLibraryStore((state) => state.restoreBackup)
  const memoryRecords = useReviewStore((state) => state.memoryRecords)
  const restoreMemory = useReviewStore((state) => state.restoreBackup)
  const currentSession = useSessionStore((state) => state.currentSession)
  const restoreSessions = useSessionStore((state) => state.restoreBackup)
  const examResults = useExamStore((state) => state.results)
  const restoreExamResults = useExamStore((state) => state.restoreBackup)

  const handleExport = () => {
    setError(undefined)
    setMessage(undefined)

    const payload = createBackupPayload({
      activeLibraryId: activeLibrary?.id,
      libraries,
      questions: Object.values(questions),
      diagnostics: Object.values(diagnostics).flat(),
      memoryRecords: Object.values(memoryRecords),
      sessions: currentSession ? [currentSession] : [],
      examResults: Object.values(examResults),
    })

    downloadJson(createBackupFilename(payload.exportedAt), JSON.stringify(payload, null, 2))
    setMessage(`已导出 ${payload.data.libraries.length} 个题库与 ${payload.data.memoryRecords.length} 条学习记录。`)
  }

  const handleImport: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    setError(undefined)
    setMessage(undefined)

    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const payload = parseBackupPayload(raw)

      await restoreLibraries({
        libraries: payload.data.libraries,
        questions: payload.data.questions,
        diagnostics: payload.data.diagnostics,
        activeLibraryId: payload.meta.activeLibraryId,
      })
      await restoreMemory(payload.data.memoryRecords)
      await restoreSessions(payload.data.sessions)
      await restoreExamResults(payload.data.examResults)

      setMessage(
        `已导入 ${payload.data.libraries.length} 个题库、${payload.data.memoryRecords.length} 条学习记录和 ${payload.data.examResults.length} 条考试记录。`,
      )
    } catch (importError) {
      setError(resolveVisibleError(importError, '备份导入失败。'))
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">设置</p>
        <h1>设置</h1>
      </header>

      <article className="card">
        <h2>数据备份</h2>
        <p className="muted">
          导出内容包括题库、题目、诊断、学习记录、当前会话与考试结果。导入采用合并恢复策略。
        </p>

        <div className="action-row">
          <button type="button" className="action-button" onClick={handleExport}>
            导出备份文件
          </button>

          <label className="secondary-button file-button">
            导入备份文件
            <input type="file" accept="application/json,.json" hidden onChange={handleImport} />
          </label>
        </div>

        {message ? <p className="muted">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>

      <article className="card">
        <h2>当前快照</h2>
        <p className="muted">当前题库：{activeLibrary?.name ?? '无'}</p>
        <p className="muted">题库数量：{libraries.length}</p>
        <p className="muted">学习记录：{Object.keys(memoryRecords).length}</p>
        <p className="muted">考试记录：{Object.keys(examResults).length}</p>
      </article>
    </section>
  )
}
