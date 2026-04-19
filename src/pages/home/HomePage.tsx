import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore, useReviewStore, useSessionStore } from '../../stores'

export function HomePage() {
  const navigate = useNavigate()
  const activeLibrary = useLibraryStore((state) => state.getActiveLibrary())
  const getQuestionsForActiveLibrary = useLibraryStore((state) => state.getQuestionsForActiveLibrary)
  const getDueCount = useReviewStore((state) => state.getDueCount)
  const getDueQuestionIds = useReviewStore((state) => state.getDueQuestionIds)
  const getWrongQuestionIds = useReviewStore((state) => state.getWrongQuestionIds)
  const getLevelStats = useReviewStore((state) => state.getLevelStats)
  const startSequentialSession = useSessionStore((state) => state.startSequentialSession)
  const startFilteredSession = useSessionStore((state) => state.startFilteredSession)

  const allQuestionIds = getQuestionsForActiveLibrary().map((question) => question.id)
  const dueCount = getDueCount()
  const dueQuestionIds = activeLibrary ? getDueQuestionIds(activeLibrary.id) : []
  const wrongQuestionIds = activeLibrary ? getWrongQuestionIds(activeLibrary.id) : []
  const levelStats = getLevelStats()
  const totalTracked = useMemo(
    () => Object.values(levelStats).reduce((sum, count) => sum + count, 0),
    [levelStats],
  )

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
        <p className="eyebrow">Today</p>
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
          <p className="muted">
            {Object.entries(levelStats)
              .map(([level, count]) => `L${level}: ${count}`)
              .join(' / ')}
          </p>
          <p className="muted">已跟踪题目：{totalTracked}</p>
          <p className="muted">错题累计：{wrongQuestionIds.length}</p>
        </article>
      </div>
    </section>
  )
}
