import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../../stores'

const FILTER_LABELS = {
  all: '全部',
  error: '错误',
  warning: '警告',
  info: '提示',
} as const

const SOURCE_TYPE_LABELS = {
  builtin: '内置',
  imported: '导入',
} as const

const DIAGNOSTIC_TYPE_LABELS = {
  'missing-id': '缺少题目编号',
  'missing-answer': '缺少答案',
  'duplicate-id': '题目编号重复',
  'invalid-type': '题型无效',
  'option-answer-mismatch': '选项与答案不匹配',
  'markdown-error': '题面解析错误',
  'asset-missing': '资源缺失',
} as const

function localizeDiagnosticMessage(type: keyof typeof DIAGNOSTIC_TYPE_LABELS, message: string): string {
  if (/[\u4e00-\u9fa5]/.test(message)) {
    return message
  }

  switch (type) {
    case 'missing-id':
      return '题目未提供编号，系统已自动生成回退编号。'
    case 'missing-answer':
      return '题目缺少可判分答案。'
    case 'duplicate-id':
      return '发现重复题目编号，系统已自动处理。'
    case 'invalid-type':
      return '题目类型无效。'
    case 'option-answer-mismatch':
      return '题目答案与提取到的选项不一致。'
    case 'markdown-error':
      return '题面内容存在格式问题。'
    case 'asset-missing':
      return '题目资源缺失。'
    default:
      return '存在诊断信息。'
  }
}

function localizeLibraryName(name: string, sourceType: 'builtin' | 'imported'): string {
  if (name === 'Builtin Library') {
    return '内置题库'
  }

  if (sourceType === 'imported' && (name.startsWith('Imported:') || name.startsWith('Imported Library'))) {
    return '导入题库'
  }

  return name
}

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
        <p className="eyebrow">题库</p>
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
            导入题库文件
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
                  <strong>{localizeLibraryName(library.name, library.sourceType)}</strong>
                  <span>{SOURCE_TYPE_LABELS[library.sourceType]}</span>
                </div>
                <p className="muted">
                  题量：{library.questionCount} / 可判分：{library.scorableCount}
                </p>
                <p className="muted">编号：{library.id}</p>
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

        {filteredDiagnostics.length === 0 ? (
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
