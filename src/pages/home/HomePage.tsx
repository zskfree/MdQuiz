import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExamStore, useLibraryStore, useReviewStore, useSessionStore } from '../../stores'

export function HomePage() {
  const navigate = useNavigate()
  const activeLibrary = useLibraryStore((state) => state.getActiveLibrary())
  const getQuestionsForActiveLibrary = useLibraryStore((state) => state.getQuestionsForActiveLibrary)
  const getDueCount = useReviewStore((state) => state.getDueCount)
  const getDueQuestionIds = useReviewStore((state) => state.getDueQuestionIds)
  const getWrongQuestionIds = useReviewStore((state) => state.getWrongQuestionIds)
  const getLevelStats = useReviewStore((state) => state.getLevelStats)
  const getRecentResults = useExamStore((state) => state.getRecentResults)
  const startSequentialSession = useSessionStore((state) => state.startSequentialSession)
  const startFilteredSession = useSessionStore((state) => state.startFilteredSession)

  const allQuestionIds = getQuestionsForActiveLibrary().map((question) => question.id)
  const dueCount = getDueCount()
  const dueQuestionIds = activeLibrary ? getDueQuestionIds(activeLibrary.id) : []
  const wrongQuestionIds = activeLibrary ? getWrongQuestionIds(activeLibrary.id) : []
  const levelStats = getLevelStats()
  const examResults = getRecentResults()
  const recentExamResults = examResults.slice(0, 7)
  const trendExamResults = [...recentExamResults].reverse()
  const totalTracked = useMemo(
    () => Object.values(levelStats).reduce((sum, count) => sum + count, 0),
    [levelStats],
  )
  const averageAccuracy =
    examResults.length > 0
      ? examResults.reduce((sum, result) => sum + result.accuracy, 0) / examResults.length
      : 0
  const latestAccuracy = examResults[0]?.accuracy ?? 0
  const bestAccuracy =
    examResults.length > 0
      ? examResults.reduce((best, result) => (result.accuracy > best ? result.accuracy : best), 0)
      : 0

  const levelColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#0ea5e9', '#6366f1']

  const levelEntries = useMemo(
    () =>
      (Object.entries(levelStats) as Array<[string, number]>).map(([level, count], index) => ({
        level,
        count,
        color: levelColors[index] ?? '#9ca3af',
        ratio: totalTracked > 0 ? count / totalTracked : 0,
      })),
    [levelStats, totalTracked],
  )

  const levelGradient = useMemo(() => {
    if (totalTracked === 0) {
      return '#e5e7eb 0 100%'
    }

    let offset = 0
    return levelEntries
      .map((entry) => {
        const start = offset * 100
        offset += entry.ratio
        const end = offset * 100
        return `${entry.color} ${start}% ${end}%`
      })
      .join(', ')
  }, [levelEntries, totalTracked])

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`

  const handleStartSequential = () => {
    if (!activeLibrary || allQuestionIds.length === 0) {
      return
    }

    startSequentialSession(activeLibrary.id, allQuestionIds)
    void navigate('/practice')
  }

  const handleStartDueReview = () => {
    if (!activeLibrary || dueQuestionIds.length === 0) {
      return
    }

    startFilteredSession('spaced-review', activeLibrary.id, dueQuestionIds, {
      onlyDue: true,
    })
    void navigate('/practice')
  }

  const handleStartWrongPractice = () => {
    if (!activeLibrary || wrongQuestionIds.length === 0) {
      return
    }

    startFilteredSession('filtered', activeLibrary.id, wrongQuestionIds, {
      onlyWrong: true,
    })
    void navigate('/practice')
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">今日</p>
        <h1>复习看板</h1>
      </header>

      <div className="grid-two">
        <article className="card">
          <h2>开始练习</h2>
          <p className="muted">当前题库：{activeLibrary?.name ?? '未加载'}，总题量：{allQuestionIds.length}</p>
          <div className="action-row">
            <button
              className="action-button"
              onClick={handleStartSequential}
              disabled={!activeLibrary || allQuestionIds.length === 0}
            >
              顺序刷题
            </button>
            <button
              className="secondary-button"
              onClick={handleStartDueReview}
              disabled={!activeLibrary || dueQuestionIds.length === 0}
            >
              今日复习
            </button>
            <button
              className="secondary-button"
              onClick={handleStartWrongPractice}
              disabled={!activeLibrary || wrongQuestionIds.length === 0}
            >
              错题复习
            </button>
          </div>
        </article>

        <article className="card">
          <h2>学习概览</h2>
          <p className="stat">{dueCount}</p>
          <p className="muted">今日待复习题数</p>
          <div className="dashboard-metrics">
            <div className="metric-tile">
              <span className="metric-label">平均正确率</span>
              <strong className="metric-value">{formatPercent(averageAccuracy)}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">最近一次</span>
              <strong className="metric-value">{formatPercent(latestAccuracy)}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">最佳正确率</span>
              <strong className="metric-value">{formatPercent(bestAccuracy)}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">错题累计</span>
              <strong className="metric-value">{wrongQuestionIds.length}</strong>
            </div>
          </div>
          <p className="muted">考试记录：{examResults.length} 次</p>
          <p className="muted">已跟踪题目：{totalTracked}</p>
        </article>
      </div>

      <div className="grid-two dashboard-chart-grid">
        <article className="card">
          <h2>考试正确率趋势</h2>
          {trendExamResults.length > 0 ? (
            <>
              <div className="accuracy-bars">
                {trendExamResults.map((result) => {
                  const accuracy = Math.round(result.accuracy * 100)
                  return (
                    <div className="accuracy-bar" key={result.id}>
                      <span className="accuracy-bar-value">{accuracy}%</span>
                      <div className="accuracy-bar-track">
                        <span
                          className="accuracy-bar-fill"
                          style={{ height: `${Math.max(8, accuracy)}%` }}
                        />
                      </div>
                      <span className="accuracy-bar-label">
                        {new Date(result.submittedAt).toLocaleDateString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="muted">最近 {trendExamResults.length} 次考试（按时间顺序）</p>
            </>
          ) : (
            <p className="muted">暂无考试记录，完成一次模拟考试后即可查看趋势图。</p>
          )}
        </article>

        <article className="card">
          <h2>记忆等级分布</h2>
          <div className="level-chart-layout">
            <div className="level-donut" style={{ background: `conic-gradient(${levelGradient})` }}>
              <span>{totalTracked}</span>
              <small>已跟踪</small>
            </div>
            <div className="level-list">
              {levelEntries.map((entry) => (
                <div className="level-row" key={entry.level}>
                  <span className="level-label" style={{ color: entry.color }}>
                    第{entry.level}级
                  </span>
                  <div className="level-bar-track">
                    <span
                      className="level-bar-fill"
                      style={{ width: `${entry.ratio * 100}%`, backgroundColor: entry.color }}
                    />
                  </div>
                  <span className="level-count">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="muted">覆盖记忆等级第 1 级到第 7 级，便于观察记忆结构。</p>
        </article>
      </div>
    </section>
  )
}
