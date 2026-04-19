import { useState } from 'react'
import { createBackupFilename, createBackupPayload, parseBackupPayload } from '../../core/import-export'
import {
  useCloudSyncStore,
  useExamStore,
  useLibraryStore,
  useReviewStore,
  useSessionStore,
} from '../../stores'

const AUTO_SYNC_INTERVAL_OPTIONS = [1, 3, 5, 10, 15, 30]

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

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  const clearMemoryRecordsForLibrary = useReviewStore((state) => state.clearRecordsForLibrary)
  const restoreMemory = useReviewStore((state) => state.restoreBackup)
  const currentSession = useSessionStore((state) => state.currentSession)
  const clearSessionsForLibrary = useSessionStore((state) => state.clearSessionsForLibrary)
  const restoreSessions = useSessionStore((state) => state.restoreBackup)
  const examResults = useExamStore((state) => state.results)
  const clearExamResultsForLibrary = useExamStore((state) => state.clearResultsForLibrary)
  const restoreExamResults = useExamStore((state) => state.restoreBackup)
  const cloudInitialized = useCloudSyncStore((state) => state.initialized)
  const cloudUser = useCloudSyncStore((state) => state.user)
  const isCloudSyncing = useCloudSyncStore((state) => state.isSyncing)
  const autoSyncEnabled = useCloudSyncStore((state) => state.autoSyncEnabled)
  const autoSyncIntervalMinutes = useCloudSyncStore((state) => state.autoSyncIntervalMinutes)
  const cloudLastSyncedAt = useCloudSyncStore((state) => state.lastSyncedAt)
  const cloudLastCloudUpdatedAt = useCloudSyncStore((state) => state.lastCloudUpdatedAt)
  const cloudLastError = useCloudSyncStore((state) => state.lastError)
  const setAutoSyncEnabled = useCloudSyncStore((state) => state.setAutoSyncEnabled)
  const setAutoSyncIntervalMinutes = useCloudSyncStore((state) => state.setAutoSyncIntervalMinutes)
  const signInWithGoogle = useCloudSyncStore((state) => state.signInWithGoogle)
  const signOutFromCloud = useCloudSyncStore((state) => state.signOut)
  const uploadNow = useCloudSyncStore((state) => state.uploadNow)
  const downloadNow = useCloudSyncStore((state) => state.downloadNow)

  const activeLibraryMemoryCount = activeLibrary
    ? Object.values(memoryRecords).filter((record) => record.libraryId === activeLibrary.id).length
    : 0
  const activeLibraryExamCount = activeLibrary
    ? Object.values(examResults).filter((result) => result.libraryId === activeLibrary.id).length
    : 0
  const hasActiveSession = currentSession?.libraryId === activeLibrary?.id
  const cloudAccountName = cloudUser?.displayName ?? cloudUser?.email ?? cloudUser?.uid

  const handleGoogleSignIn = async () => {
    setError(undefined)
    setMessage(undefined)

    try {
      await signInWithGoogle()
      setMessage('Google 登录成功，可开始云端同步。')
    } catch (signInError) {
      setError(resolveVisibleError(signInError, 'Google 登录失败。'))
    }
  }

  const handleGoogleSignOut = async () => {
    setError(undefined)
    setMessage(undefined)

    try {
      await signOutFromCloud()
      setMessage('已退出 Google 账号。')
    } catch (signOutError) {
      setError(resolveVisibleError(signOutError, '退出登录失败。'))
    }
  }

  const handleUploadNow = async () => {
    setError(undefined)
    setMessage(undefined)

    try {
      await uploadNow()
      setMessage('本地数据已上传到云端。')
    } catch (uploadError) {
      setError(resolveVisibleError(uploadError, '上传同步失败。'))
    }
  }

  const handleDownloadNow = async () => {
    if (!cloudUser) {
      setError('请先登录 Google 账号。')
      setMessage(undefined)
      return
    }

    const confirmed = window.confirm('下载同步会将云端备份合并到当前本地数据，是否继续？')

    if (!confirmed) {
      return
    }

    setError(undefined)
    setMessage(undefined)

    try {
      await downloadNow()
      setMessage('云端备份已下载并合并到本地。')
    } catch (downloadError) {
      setError(resolveVisibleError(downloadError, '下载同步失败。'))
    }
  }

  const handleToggleAutoSync = () => {
    const nextEnabled = !autoSyncEnabled
    setAutoSyncEnabled(nextEnabled)
    setError(undefined)
    setMessage(nextEnabled ? '已开启自动同步。' : '已关闭自动同步。')
  }

  const handleAutoSyncIntervalChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const nextMinutes = Number.parseInt(event.target.value, 10)

    if (!Number.isFinite(nextMinutes)) {
      return
    }

    setAutoSyncIntervalMinutes(nextMinutes)
    setError(undefined)
    setMessage(`自动同步间隔已更新为 ${nextMinutes} 分钟。`)
  }

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

  const handleClearPracticeRecords = async () => {
    if (!activeLibrary) {
      setError('请先选择一个题库。')
      setMessage(undefined)
      return
    }

    const confirmed = window.confirm(`确认清除题库“${activeLibrary.name}”的做题记录吗？题库内容本身不会删除。`)

    if (!confirmed) {
      return
    }

    setError(undefined)
    setMessage(undefined)

    try {
      const [deletedMemoryRecords, deletedSessions, deletedExamResults] = await Promise.all([
        clearMemoryRecordsForLibrary(activeLibrary.id),
        clearSessionsForLibrary(activeLibrary.id),
        clearExamResultsForLibrary(activeLibrary.id),
      ])

      setMessage(
        `已清除当前题库的 ${deletedMemoryRecords} 条学习记录、${deletedSessions} 条会话记录和 ${deletedExamResults} 条考试记录。`,
      )
    } catch (clearError) {
      setError(resolveVisibleError(clearError, '清除做题记录失败。'))
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">设置</p>
        <h1>设置</h1>
      </header>

      <article className="card">
        <h2>云端同步（Google）</h2>
        <p className="muted">
          {cloudInitialized
            ? cloudUser
              ? '已连接 Google 账号，可执行手动同步，并可开启自动同步。'
              : '未登录 Google 账号，仅支持本地数据。'
            : '正在初始化云端同步模块...'}
        </p>

        <div className="action-row cloud-sync-actions">
          {cloudUser ? (
            <button type="button" className="action-button" onClick={() => void handleGoogleSignOut()}>
              退出 Google
            </button>
          ) : (
            <button type="button" className="action-button" onClick={() => void handleGoogleSignIn()}>
              Google 登录
            </button>
          )}

          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleUploadNow()}
            disabled={!cloudUser || isCloudSyncing}
          >
            {isCloudSyncing ? '同步中...' : '上传到云端'}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDownloadNow()}
            disabled={!cloudUser || isCloudSyncing}
          >
            从云端恢复
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handleToggleAutoSync}
            disabled={!cloudUser}
          >
            {autoSyncEnabled ? '关闭自动同步' : '开启自动同步'}
          </button>

          <label className="cloud-sync-interval-control">
            <span>同步间隔</span>
            <select
              aria-label="自动同步间隔"
              value={String(autoSyncIntervalMinutes)}
              onChange={handleAutoSyncIntervalChange}
              disabled={!cloudUser}
            >
              {AUTO_SYNC_INTERVAL_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} 分钟
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="muted">登录账号：{cloudUser ? cloudAccountName : '未登录'}</p>
        <p className="muted">
          自动同步：{autoSyncEnabled ? `已开启（前台在线状态每 ${autoSyncIntervalMinutes} 分钟同步）` : '未开启'}
        </p>
        <p className="muted">最近同步时间：{cloudLastSyncedAt ? formatDateTime(cloudLastSyncedAt) : '暂无'}</p>
        <p className="muted">
          云端最近更新时间：{cloudLastCloudUpdatedAt ? formatDateTime(cloudLastCloudUpdatedAt) : '暂无'}
        </p>
        {cloudLastError ? <p className="error-text">{cloudLastError}</p> : null}
      </article>

      <article className="card">
        <h2>数据备份</h2>
        <p className="muted">
          导出内容包括题库、题目、诊断、学习记录、当前会话与考试结果。导入采用合并恢复策略。
        </p>

        <div className="action-row backup-actions">
          <button type="button" className="action-button" onClick={handleExport}>
            导出备份文件
          </button>

          <label className="secondary-button file-button">
            导入备份文件
            <input type="file" accept="application/json,.json" hidden onChange={handleImport} />
          </label>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleClearPracticeRecords()}
            disabled={!activeLibrary}
          >
            清除当前题库做题记录
          </button>
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
        <p className="muted">当前题库学习记录：{activeLibraryMemoryCount}</p>
        <p className="muted">当前题库考试记录：{activeLibraryExamCount}</p>
        <p className="muted">当前题库活动会话：{hasActiveSession ? '1' : '0'}</p>
      </article>
    </section>
  )
}
