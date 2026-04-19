import { useEffect, useMemo, useState } from 'react'
import { MarkdownRenderer } from '../../core/renderer'
import { useExamStore, useLibraryStore, useSessionStore } from '../../stores'

function shuffle<T>(items: T[]): T[] {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(totalSeconds, 0)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getExamNavState(input: { current: boolean; answered: boolean; marked: boolean }) {
  if (input.current) {
    return 'nav-chip current'
  }

  if (input.marked) {
    return 'nav-chip marked'
  }

  if (input.answered) {
    return 'nav-chip answered'
  }

  return 'nav-chip'
}

function getExamOptionClassName(selected: boolean): string {
  return selected ? 'option-button selected' : 'option-button'
}

function localizeAnswerToken(token: string): string {
  const uppercaseToken = token.toUpperCase()
  const optionKeyMap: Record<string, string> = {
    A: '甲',
    B: '乙',
    C: '丙',
    D: '丁',
    E: '戊',
    F: '己',
    G: '庚',
    H: '辛',
    I: '壬',
    J: '癸',
  }

  if (optionKeyMap[uppercaseToken]) {
    return optionKeyMap[uppercaseToken]
  }

  if (uppercaseToken === 'TRUE') {
    return '正确'
  }

  if (uppercaseToken === 'FALSE') {
    return '错误'
  }

  return token
}

function localizeAnswerList(answers: string[]): string {
  return answers.map(localizeAnswerToken).join(', ')
}

export function ExamPage() {
  const [questionLimit, setQuestionLimit] = useState(10)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(20)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [showNavCard, setShowNavCard] = useState(false)

  const loadBuiltinLibrary = useLibraryStore((state) => state.loadBuiltinLibrary)
  const activeLibrary = useLibraryStore((state) => state.getActiveLibrary())
  const getQuestionsForActiveLibrary = useLibraryStore((state) => state.getQuestionsForActiveLibrary)
  const getQuestionById = useLibraryStore((state) => state.getQuestionById)
  const currentSession = useSessionStore((state) => state.currentSession)
  const currentQuestionId = useSessionStore((state) => state.getCurrentQuestionId())
  const currentAnswer = useSessionStore((state) => state.getCurrentAnswer())
  const startExamSession = useSessionStore((state) => state.startExamSession)
  const selectOption = useSessionStore((state) => state.selectOption)
  const goToPreviousQuestion = useSessionStore((state) => state.goToPreviousQuestion)
  const goToNextQuestion = useSessionStore((state) => state.goToNextQuestion)
  const setCurrentIndex = useSessionStore((state) => state.setCurrentIndex)
  const toggleMarkedQuestion = useSessionStore((state) => state.toggleMarkedQuestion)
  const toggleQuickMode = useSessionStore((state) => state.toggleQuickMode)
  const clearCurrentSession = useSessionStore((state) => state.clearCurrentSession)
  const submitCurrentExam = useExamStore((state) => state.submitCurrentExam)
  const getResultBySessionId = useExamStore((state) => state.getResultBySessionId)

  useEffect(() => {
    void loadBuiltinLibrary()
  }, [loadBuiltinLibrary])

  const questions = getQuestionsForActiveLibrary().filter((question) => question.scorable)
  const currentQuestion =
    currentSession?.mode === 'exam' && currentQuestionId ? getQuestionById(currentQuestionId) : undefined
  const currentResult =
    currentSession?.mode === 'exam' && currentSession.status === 'completed'
      ? getResultBySessionId(currentSession.id)
      : undefined
  const quickMode = Boolean(
    currentSession?.mode === 'exam' && currentSession.status === 'active' && currentSession.config.quickMode,
  )

  useEffect(() => {
    if (quickMode) {
      document.body.classList.add('quick-mode-active')
    } else {
      document.body.classList.remove('quick-mode-active')
    }

    return () => {
      document.body.classList.remove('quick-mode-active')
    }
  }, [quickMode])

  useEffect(() => {
    if (!currentSession || currentSession.mode !== 'exam' || currentSession.status !== 'active') {
      setRemainingSeconds(null)
      return
    }

    const tick = () => {
      const timeLimitSeconds = currentSession.config.timeLimitSeconds ?? 0
      const elapsedSeconds = Math.floor((Date.now() - currentSession.startedAt) / 1000)
      const nextRemaining = Math.max(timeLimitSeconds - elapsedSeconds, 0)

      setRemainingSeconds(nextRemaining)

      if (nextRemaining <= 0) {
        void submitCurrentExam(true)
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [currentSession, submitCurrentExam])

  const answeredCount = useMemo(() => {
    if (!currentSession || currentSession.mode !== 'exam') {
      return 0
    }

    return currentSession.questionIds.filter((questionId) => {
      const selected = currentSession.answers[questionId]?.selected ?? []
      return selected.length > 0
    }).length
  }, [currentSession])

  const markedCount = useMemo(() => {
    if (!currentSession || currentSession.mode !== 'exam') {
      return 0
    }

    return currentSession.questionIds.filter((questionId) => currentSession.marks[questionId]).length
  }, [currentSession])

  const handleStartExam = () => {
    if (!activeLibrary || questions.length === 0) {
      return
    }

    const limit = Math.min(Math.max(questionLimit, 1), questions.length)
    const selectedQuestionIds = shuffle(questions).slice(0, limit).map((question) => question.id)

    startExamSession(activeLibrary.id, selectedQuestionIds, {
      questionLimit: limit,
      timeLimitSeconds: Math.max(timeLimitMinutes, 1) * 60,
      quickMode: false,
    })
  }

  const handleSubmitExam = () => {
    void submitCurrentExam(false)
  }

  const scrollToPageTop = () => {
    const appMain = document.querySelector('.app-main')

    if (appMain instanceof HTMLElement) {
      appMain.scrollTo({ top: 0, behavior: 'smooth' })
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleJumpToQuestion = (index: number) => {
    setCurrentIndex(index)

    window.requestAnimationFrame(() => {
      scrollToPageTop()
    })
  }

  const handleOptionSelect = (questionId: string, optionKey: string) => {
    if (!currentQuestion || !currentSession) {
      return
    }

    selectOption(questionId, optionKey)

    if (quickMode && currentQuestion.type !== 'multiple') {
      goToNextQuestion()
    }
  }

  useEffect(() => {
    if (!currentQuestion || !currentSession) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toUpperCase()

      if (/^[1-9]$/.test(event.key)) {
        const index = Number.parseInt(event.key, 10) - 1
        const option = currentQuestion.options[index]

        if (option) {
          event.preventDefault()
          handleOptionSelect(currentQuestion.id, option.key)
        }
        return
      }

      if (/^[A-Z]$/.test(key)) {
        const option = currentQuestion.options.find((item) => item.key.toUpperCase() === key)

        if (option) {
          event.preventDefault()
          handleOptionSelect(currentQuestion.id, option.key)
          return
        }
      }

      if (key === 'M') {
        event.preventDefault()
        toggleMarkedQuestion(currentQuestion.id)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPreviousQuestion()
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        goToNextQuestion()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentQuestion, currentSession, goToNextQuestion, goToPreviousQuestion, quickMode, toggleMarkedQuestion])

  const isExamSession = currentSession?.mode === 'exam'

  return (
    <section className={quickMode ? 'page practice-page quick-mode' : 'page practice-page'}>
      {!quickMode ? (
        <header className="page-header">
          <p className="eyebrow">考试</p>
          <h1>模拟考试</h1>
        </header>
      ) : null}

      <article className={quickMode ? 'card quick-mode-card' : 'card'}>
        {!isExamSession ? (
          <div className="practice-layout">
            <h2>固定试卷快照</h2>
            <p className="muted">
              当前题库：{activeLibrary?.name ?? '未加载'}，可用于考试的题目：{questions.length}
            </p>

            <div className="exam-config">
              <label className="field">
                <span>题量</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(questions.length, 1)}
                  value={questionLimit}
                  onChange={(event) => setQuestionLimit(Number.parseInt(event.target.value || '1', 10))}
                />
              </label>

              <label className="field">
                <span>时长（分钟）</span>
                <input
                  type="number"
                  min={1}
                  value={timeLimitMinutes}
                  onChange={(event) => setTimeLimitMinutes(Number.parseInt(event.target.value || '1', 10))}
                />
              </label>
            </div>

            <button
              className="action-button"
              onClick={handleStartExam}
              disabled={!activeLibrary || questions.length === 0}
            >
              开始考试
            </button>
          </div>
        ) : currentResult ? (
          <div className="practice-layout">
            <h2>成绩单</h2>
            <div className="grid-two">
              <div className="card inset-card">
                <h3>总览</h3>
                <p>总题数：{currentResult.totalQuestions}</p>
                <p>正确数：{currentResult.correctCount}</p>
                <p>正确率：{Math.round(currentResult.accuracy * 100)}%</p>
                <p>用时：{formatSeconds(currentResult.durationSeconds)}</p>
                <p>状态：{currentResult.timedOut ? '超时自动交卷' : '手动交卷'}</p>
              </div>

              <div className="card inset-card">
                <h3>答题情况</h3>
                <p>已作答：{answeredCount}</p>
                <p>未作答：{currentResult.totalQuestions - answeredCount}</p>
                <p>标记回看：{markedCount}</p>
                <p>题库：{activeLibrary?.name ?? currentResult.libraryId}</p>
              </div>
            </div>

            <div className="diagnostics-list">
              {currentResult.questionResults.map((item, index) => {
                const question = getQuestionById(item.questionId)

                return (
                  <article
                    key={item.questionId}
                    className={item.isCorrect ? 'diagnostic-item severity-info' : 'diagnostic-item severity-error'}
                  >
                    <div className="diagnostic-head">
                      <strong>
                        第 {index + 1} 题：{question?.title ?? item.questionId}
                      </strong>
                      <span>{item.isCorrect ? '正确' : '错误'}</span>
                    </div>
                    <p>你的答案：{localizeAnswerList(item.selected) || '未作答'}</p>
                    <p>正确答案：{question ? localizeAnswerList(question.answer) : '无'}</p>
                  </article>
                )
              })}
            </div>

            <div className="action-row">
              <button className="action-button" onClick={clearCurrentSession}>
                返回考试配置
              </button>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="practice-layout">
            <div className="practice-topbar">
              <div className={quickMode ? 'quick-mode-progress' : 'practice-progress'}>
                <span>
                  第 {currentSession.currentIndex + 1} / {currentSession.questionIds.length} 题
                </span>
                <span>已作答：{answeredCount}</span>
                <span>标记回看：{markedCount}</span>
                <span>剩余时间：{formatSeconds(remainingSeconds ?? currentSession.config.timeLimitSeconds ?? 0)}</span>
              </div>

              {quickMode ? (
                <div className="quick-mode-tools">
                  <button
                    type="button"
                    className="secondary-button quick-mode-mark-toggle"
                    onClick={() => toggleMarkedQuestion(currentQuestion.id)}
                  >
                    {currentSession.marks[currentQuestion.id] ? '取消标记' : '标记回看'}
                  </button>
                  <button type="button" className="secondary-button quick-mode-toggle" onClick={toggleQuickMode}>
                    退出快速刷题
                  </button>
                  <button type="button" className="action-button" onClick={handleSubmitExam}>
                    交卷
                  </button>
                </div>
              ) : (
                <div className="quick-mode-tools">
                  <button type="button" className="secondary-button quick-mode-toggle" onClick={toggleQuickMode}>
                    开启快速刷题
                  </button>
                  <button type="button" className="action-button" onClick={handleSubmitExam}>
                    交卷
                  </button>
                </div>
              )}
            </div>

            <h3 className={quickMode ? 'quick-mode-title' : undefined}>{currentQuestion.title}</h3>
            <div className="question-body">
              <MarkdownRenderer content={currentQuestion.body} />
            </div>

            <div className="option-list">
              {currentQuestion.options.map((option) => {
                const selected = currentAnswer?.selected.includes(option.key) ?? false

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={getExamOptionClassName(selected)}
                    onClick={() => handleOptionSelect(currentQuestion.id, option.key)}
                  >
                    <strong>{localizeAnswerToken(option.key)}</strong>
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>

            {quickMode ? (
              <div className="action-row quick-nav-actions">
                <button
                  className="secondary-button"
                  onClick={goToPreviousQuestion}
                  disabled={currentSession.currentIndex === 0}
                >
                  上一题
                </button>
                <button
                  className="secondary-button"
                  onClick={goToNextQuestion}
                  disabled={currentSession.currentIndex === currentSession.questionIds.length - 1}
                >
                  下一题
                </button>
              </div>
            ) : (
              <div className="action-row question-actions">
                <button
                  className="secondary-button"
                  onClick={goToPreviousQuestion}
                  disabled={currentSession.currentIndex === 0}
                >
                  上一题
                </button>
                <button
                  className="secondary-button"
                  onClick={goToNextQuestion}
                  disabled={currentSession.currentIndex === currentSession.questionIds.length - 1}
                >
                  下一题
                </button>
                <button className="secondary-button" onClick={() => toggleMarkedQuestion(currentQuestion.id)}>
                  {currentSession.marks[currentQuestion.id] ? '取消标记' : '标记回看'}
                </button>
              </div>
            )}

            {!quickMode ? (
              <div className="nav-panel nav-panel-bottom">
                <button
                  type="button"
                  className="secondary-button nav-toggle"
                  onClick={() => setShowNavCard((value) => !value)}
                >
                  {showNavCard
                    ? '收起答题卡'
                    : `展开答题卡 ${currentSession.currentIndex + 1}/${currentSession.questionIds.length}`}
                </button>

                {showNavCard ? (
                  <div className="navigation-grid">
                    {currentSession.questionIds.map((questionId, index) => {
                      const answered = (currentSession.answers[questionId]?.selected?.length ?? 0) > 0
                      const marked = currentSession.marks[questionId] ?? false

                      return (
                        <button
                          key={questionId}
                          type="button"
                          className={getExamNavState({
                            current: currentSession.currentIndex === index,
                            answered,
                            marked,
                          })}
                          onClick={() => handleJumpToQuestion(index)}
                        >
                          {index + 1}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted">考试题目不可用。</p>
        )}
      </article>
    </section>
  )
}
