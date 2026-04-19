import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../../stores'

export function LibraryPage() {
  const allLibraries = useLibraryStore((state) => state.getAllLibraries())
  const libraries = useLibraryStore((state) => state.libraries)
  const activeLibraryId = useLibraryStore((state) => state.activeLibraryId)
  const isLoading = useLibraryStore((state) => state.isLoading)
  const error = useLibraryStore((state) => state.error)
  const getDiagnosticsForActiveLibrary = useLibraryStore((state) => state.getDiagnosticsForActiveLibrary)
  const loadBuiltinLibrary = useLibraryStore((state) => state.loadBuiltinLibrary)
  const setActiveLibrary = useLibraryStore((state) => state.setActiveLibrary)
  const importFiles = useLibraryStore((state) => state.importFiles)
  const diagnostics = getDiagnosticsForActiveLibrary()
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  useEffect(() => {
    void loadBuiltinLibrary()
  }, [loadBuiltinLibrary])

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

    void importFiles(Array.from(fileList))
    event.target.value = ''
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Libraries</p>
        <h1>题库</h1>
      </header>

      <article className="card">
        <h2>当前状态</h2>
        <p className="muted">
          {isLoading
            ? '正在加载内置题库...'
            : error
              ? `加载失败：${error}`
              : `已加载 ${Object.keys(libraries).length} 个题库，当前激活：${activeLibraryId ?? '无'}，诊断项：${diagnostics.length}`}
        </p>

        <div className="action-row">
          <label className="action-button file-button">
            导入 Markdown 题库
            <input type="file" accept=".md,text/markdown" multiple onChange={handleImport} hidden />
          </label>
        </div>
      </article>

      <article className="card">
        <h2>题库列表</h2>

        {allLibraries.length === 0 ? (
          <p className="muted">当前还没有可用题库。</p>
        ) : (
          <div className="diagnostics-list">
            {allLibraries.map((library) => (
              <article key={library.id} className="diagnostic-item severity-info">
                <div className="diagnostic-head">
                  <strong>{library.name}</strong>
                  <span>{library.sourceType}</span>
                </div>
                <p className="muted">
                  题量：{library.questionCount} / 可判分：{library.scorableCount}
                </p>
                <p className="muted">ID：{library.id}</p>
                <div className="action-row">
                  <button
                    type="button"
                    className={activeLibraryId === library.id ? 'secondary-button selected-filter' : 'secondary-button'}
                    onClick={() => setActiveLibrary(library.id)}
                  >
                    {activeLibraryId === library.id ? '当前题库' : '切换为当前题库'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>

      <article className="card">
        <h2>题库健康诊断</h2>
        <p className="muted">当前题库诊断数：{diagnostics.length}</p>

        <div className="filter-row" role="group" aria-label="Diagnostic filters">
          {(['all', 'error', 'warning', 'info'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'secondary-button selected-filter' : 'secondary-button'}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {filteredDiagnostics.length === 0 ? (
          <p className="muted">当前筛选条件下没有诊断项。</p>
        ) : (
          <div className="diagnostics-list">
            {filteredDiagnostics.map((item) => (
              <article key={item.id} className={`diagnostic-item severity-${item.severity}`}>
                <div className="diagnostic-head">
                  <strong>{item.type}</strong>
                  <span>{item.severity}</span>
                </div>
                <p>{item.message}</p>
                <p className="muted">题目：{item.questionId ?? 'N/A'}</p>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
