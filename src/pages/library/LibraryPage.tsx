import { useMemo, useState } from 'react'
import {
  createLibraryBackupFilename,
  createLibraryBackupPayload,
} from '../../core/import-export'
import { useLibraryStore } from '../../stores'

const FILTER_LABELS = {
  all: '全部',
  error: '错误',
  warning: '警告',
  info: '提示',
} as const

const SOURCE_TYPE_LABELS = {
  builtin: '默认',
  imported: '导入',
} as const

const DIAGNOSTIC_TYPE_LABELS = {
  'missing-id': '缺少题目编号',
  'missing-answer': '缺少答案',
  'duplicate-id': '题目编号重复',
  'invalid-type': '题型无效',
  'option-answer-mismatch': '选项与答案不匹配',
  'markdown-error': 'Markdown 解析错误',
  'asset-missing': '资源缺失',
} as const

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

function localizeDiagnosticMessage(type: keyof typeof DIAGNOSTIC_TYPE_LABELS, message: string): string {
  if (/[\u4e00-\u9fa5]/.test(message)) {
    return message
  }

  switch (type) {
    case 'missing-id':
      return '题目未提供编号，系统已自动生成。'
    case 'missing-answer':
      return '题目缺少可判分答案。'
    case 'duplicate-id':
      return '检测到重复题目编号，系统已自动处理。'
    case 'invalid-type':
      return '题目类型无效。'
    case 'option-answer-mismatch':
      return '题目答案与提取到的选项不匹配。'
    case 'markdown-error':
      return '题目内容存在格式问题。'
    case 'asset-missing':
      return '题目资源缺失。'
    default:
      return '存在诊断信息。'
  }
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

export function LibraryPage() {
  const allLibraries = useLibraryStore((state) => state.getAllLibraries())
  const activeLibraryId = useLibraryStore((state) => state.activeLibraryId)
  const isLoading = useLibraryStore((state) => state.isLoading)
  const storeError = useLibraryStore((state) => state.error)
  const setActiveLibrary = useLibraryStore((state) => state.setActiveLibrary)
  const importFiles = useLibraryStore((state) => state.importFiles)
  const deleteLibrary = useLibraryStore((state) => state.deleteLibrary)
  const getQuestionsForLibrary = useLibraryStore((state) => state.getQuestionsForLibrary)
  const getDiagnosticsForLibrary = useLibraryStore((state) => state.getDiagnosticsForLibrary)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  const activeLibrary = allLibraries.find((library) => library.id === activeLibraryId)
  const diagnostics = activeLibraryId ? getDiagnosticsForLibrary(activeLibraryId) : []

  const filteredDiagnostics = useMemo(() => {
    if (filter === 'all') {
      return diagnostics
    }

    return diagnostics.filter((item) => item.severity === filter)
  }, [diagnostics, filter])

  const handleImport: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const fileList = event.target.files

    if (!fileList || fileList.length === 0) {
      return
    }

    setError(undefined)
    setMessage(undefined)
    void importFiles(Array.from(fileList))
    event.target.value = ''
  }

  const handleDownloadLibrary = (libraryId: string) => {
    const library = allLibraries.find((item) => item.id === libraryId)

    if (!library) {
      return
    }

    setError(undefined)
    setMessage(undefined)

    const payload = createLibraryBackupPayload({
      library,
      questions: getQuestionsForLibrary(library.id),
      diagnostics: getDiagnosticsForLibrary(library.id),
    })

    downloadJson(
      createLibraryBackupFilename(library.name, payload.exportedAt),
      JSON.stringify(payload, null, 2),
    )
    setMessage(`已导出题库“${library.name}”。`)
  }

  const handleDeleteLibrary = async (libraryId: string) => {
    const library = allLibraries.find((item) => item.id === libraryId)

    if (!library) {
      return
    }

    const confirmed = window.confirm(`确认删除题库“${library.name}”吗？题目、诊断和做题记录都会一起删除。`)

    if (!confirmed) {
      return
    }

    setError(undefined)
    setMessage(undefined)

    try {
      await deleteLibrary(library.id)
      setMessage(`已删除题库“${library.name}”。`)
    } catch (deleteError) {
      setError(resolveVisibleError(deleteError, '删除题库失败。'))
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">题库</p>
        <h1>题库管理</h1>
      </header>

      <article className="card">
        <h2>当前状态</h2>
        <p className="muted">
          {isLoading
            ? '正在同步默认题库...'
            : `共 ${allLibraries.length} 个题库${activeLibrary ? `，当前：${activeLibrary.name}` : ''}`}
        </p>

        <div className="action-row">
          <label className="action-button file-button">
            导入题库文件
            <input type="file" accept=".md,text/markdown" multiple onChange={handleImport} hidden />
          </label>
        </div>

        {message ? <p className="muted">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {storeError ? <p className="error-text">{storeError}</p> : null}
      </article>

      <article className="card">
        <h2>题库列表</h2>

        {allLibraries.length === 0 ? (
          <p className="muted">当前还没有可用题库。</p>
        ) : (
          <div className="diagnostics-list">
            {allLibraries.map((library) => {
              const libraryDiagnostics = getDiagnosticsForLibrary(library.id)
              const canDelete = library.sourceType !== 'builtin'

              return (
                <article key={library.id} className="diagnostic-item severity-info">
                  <div className="diagnostic-head">
                    <strong>{library.name}</strong>
                    <span>{SOURCE_TYPE_LABELS[library.sourceType]}</span>
                  </div>
                  <p className="muted">
                    题量：{library.questionCount} / 可判分：{library.scorableCount}
                  </p>
                  <p className="muted">诊断：{libraryDiagnostics.length}</p>
                  <p className="muted">更新时间：{formatDateTime(library.updatedAt)}</p>
                  <p className="muted">编号：{library.id}</p>
                  <div className="action-row">
                    <button
                      type="button"
                      className={activeLibraryId === library.id ? 'secondary-button selected-filter' : 'secondary-button'}
                      onClick={() => setActiveLibrary(library.id)}
                    >
                      {activeLibraryId === library.id ? '当前题库' : '切换为当前题库'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleDownloadLibrary(library.id)}
                    >
                      下载题库
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleDeleteLibrary(library.id)}
                      disabled={!canDelete}
                      title={canDelete ? undefined : '默认题库不支持删除'}
                    >
                      删除题库
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </article>

      <article className="card">
        <h2>题库诊断</h2>
        <p className="muted">
          {activeLibrary ? `当前题库：${activeLibrary.name}，诊断 ${diagnostics.length} 条` : '请先选择一个题库。'}
        </p>

        <div className="filter-row" role="group" aria-label="诊断筛选">
          {(['all', 'error', 'warning', 'info'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'secondary-button selected-filter' : 'secondary-button'}
              onClick={() => setFilter(item)}
            >
              {FILTER_LABELS[item]}
            </button>
          ))}
        </div>

        {!activeLibrary ? (
          <p className="muted">当前没有选中的题库。</p>
        ) : filteredDiagnostics.length === 0 ? (
          <p className="muted">当前筛选条件下没有诊断项。</p>
        ) : (
          <div className="diagnostics-list">
            {filteredDiagnostics.map((item) => (
              <article key={item.id} className={`diagnostic-item severity-${item.severity}`}>
                <div className="diagnostic-head">
                  <strong>{DIAGNOSTIC_TYPE_LABELS[item.type]}</strong>
                  <span>{FILTER_LABELS[item.severity]}</span>
                </div>
                <p>{localizeDiagnosticMessage(item.type, item.message)}</p>
                <p className="muted">题目：{item.questionId ?? '无'}</p>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
