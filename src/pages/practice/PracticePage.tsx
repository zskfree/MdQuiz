import { useEffect, useMemo, useState } from 'react'
import { MarkdownRenderer } from '../../core/renderer'
import { useLibraryStore, useReviewStore, useSessionStore } from '../../stores'

function getPracticeNavState(input: {
  selectedCount: number
  submitted: boolean
  marked: boolean
  current: boolean
}) {
  if (input.current) {
    return 'nav-chip current'
  }

  if (input.marked) {
    return 'nav-chip marked'
  }

  if (input.submitted) {
    return 'nav-chip answered'
  }

  if (input.selectedCount > 0) {
    return 'nav-chip pending'
  }

  return 'nav-chip'
}

function getOptionClassName(input: {
  selected: boolean
  submitted: boolean
  isExpected: boolean
}): string {
  const classNames = ['option-button']

  if (!input.submitted && input.selected) {
    classNames.push('selected')
  }

  if (input.submitted && input.isExpected) {
    classNames.push('correct')
  }

  if (input.submitted && input.selected && !input.isExpected) {
    classNames.push('incorrect')
  }

  return classNames.join(' ')
}

function localizeAnswerToken(token: string): string {
  const uppercaseToken = token.toUpperCase()

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

export function PracticePage() {
  const [showNavCard, setShowNavCard] = useState(false)
  const loadBuiltinLibrary = useLibraryStore((state) => state.loadBuiltinLibrary)
  const activeLibraryId = useLibraryStore((state) => state.activeLibraryId)
  const currentQuestionId = useSessionStore((state) => state.getCurrentQuestionId())
  const currentAnswer = useSessionStore((state) => state.getCurrentAnswer())
  const currentSession = useSessionStore((state) => state.currentSession)
  const feedback = useSessionStore((state) => state.feedback)
  const startSequentialSession = useSessionStore((state) => state.startSequentialSession)
  const startFilteredSession = useSessionStore((state) => state.startFilteredSession)
  const selectOption = useSessionStore((state) => state.selectOption)
  const submitCurrentAnswer = useSessionStore((state) => state.submitCurrentAnswer)
  const goToPreviousQuestion = useSessionStore((state) => state.goToPreviousQuestion)
  const setCurrentIndex = useSessionStore((state) => state.setCurrentIndex)
  const goToNextQuestion = useSessionStore((state) => state.goToNextQuestion)
  const toggleMarkedQuestion = useSessionStore((state) => state.toggleMarkedQuestion)
  const toggleExplanation = useSessionStore((state) => state.toggleExplanation)
  const toggleQuickMode = useSessionStore((state) => state.toggleQuickMode)
  const getQuestionById = useLibraryStore((state) => state.getQuestionById)
  const getQuestionsForActiveLibrary = useLibraryStore((state) => state.getQuestionsForActiveLibrary)
  const getMemoryRecord = useReviewStore((state) => state.getMemoryRecord)
  const getDueQuestionIds = useReviewStore((state) => state.getDueQuestionIds)
  const getWrongQuestionIds = useReviewStore((state) => state.getWrongQuestionIds)

  useEffect(() => {
    void loadBuiltinLibrary()
  }, [loadBuiltinLibrary])

  const questions = getQuestionsForActiveLibrary()
  const currentQuestion = currentQuestionId ? getQuestionById(currentQuestionId) : undefined
  const memoryRecord = currentQuestion ? getMemoryRecord(currentQuestion.libraryId, currentQuestion.id) : undefined
  const dueQuestionIds = activeLibraryId ? getDueQuestionIds(activeLibraryId) : []
  const wrongQuestionIds = activeLibraryId ? getWrongQuestionIds(activeLibraryId) : []
  const quickMode = Boolean(currentSession?.config.quickMode)
  const resolvedAnswer = currentAnswer ?? {
    questionId: currentQuestion?.id ?? '',
    selected: [],
    submitted: false,
    revealedExplanation: false,
  }

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

  const expectedAnswers = useMemo(() => {
    if (feedback && feedback.questionId === currentQuestion?.id) {
      return new Set(feedback.expected)
    }

    return new Set(currentQuestion?.answer ?? [])
  }, [currentQuestion?.answer, currentQuestion?.id, feedback])

  const handleOptionSelect = (questionId: string, optionKey: string) => {
    if (!currentQuestion || resolvedAnswer.submitted) {
      return
    }

    selectOption(questionId, optionKey)

    if (quickMode && currentQuestion.type !== 'multiple') {
      submitCurrentAnswer()
    }
  }

  useEffect(() => {
    if (!quickMode || !feedback || !currentQuestion || feedback.questionId !== currentQuestion.id) {
      return
    }

    if (!feedback.isCorrect) {
      return
    }

    const timer = window.setTimeout(() => {
      goToNextQuestion()
    }, 320)

    return () => window.clearTimeout(timer)
  }, [currentQuestion, feedback, goToNextQuestion, quickMode])

  useEffect(() => {
    if (!currentQuestion || !currentAnswer || !currentSession) {
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

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (currentAnswer.submitted) {
          goToNextQuestion()
        }
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (currentAnswer.submitted) {
          goToNextQuestion()
        } else {
          submitCurrentAnswer()
        }
        return
      }

      if (event.code === 'Space' && !quickMode) {
        event.preventDefault()
        toggleExplanation()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    currentAnswer,
    currentQuestion,
    currentSession,
    goToNextQuestion,
    goToPreviousQuestion,
    quickMode,
    submitCurrentAnswer,
    toggleExplanation,
    toggleMarkedQuestion,
  ])

  const handleStartSequential = async () => {
    if (!activeLibraryId || questions.length === 0) {
      return
    }

    await startSequentialSession(activeLibraryId, questions.map((question) => question.id))
  }

  const handleStartDueReview = () => {
    if (!activeLibraryId || dueQuestionIds.length === 0) {
      return
    }

    startFilteredSession('spaced-review', activeLibraryId, dueQuestionIds, {
      onlyDue: true,
    })
  }

  const handleStartWrongPractice = () => {
    if (!activeLibraryId || wrongQuestionIds.length === 0) {
      return
    }

    startFilteredSession('filtered', activeLibraryId, wrongQuestionIds, {
      onlyWrong: true,
    })
  }

  const handleNextAction = () => {
    if (quickMode && !resolvedAnswer.submitted) {
      if (resolvedAnswer.selected.length === 0) {
        return
      }

      submitCurrentAnswer()
      return
    }

    goToNextQuestion()
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

  if (!currentSession || !currentQuestion) {
    return (
      <section className="page">
        <header className="page-header">
          <p className="eyebrow">练题会话</p>
          <h1>练习</h1>
        </header>

        <article className="card">
          <h2>开始练习</h2>
          <p className="muted">当前题量：{questions.length}</p>

          <div className="action-row">
            <button
              className="action-button"
              onClick={() => void handleStartSequential()}
              disabled={!activeLibraryId || questions.length === 0}
            >
              顺序练题
            </button>
            <button
              className="secondary-button"
              onClick={handleStartDueReview}
              disabled={!activeLibraryId || dueQuestionIds.length === 0}
            >
              今日复习
            </button>
            <button
              className="secondary-button"
              onClick={handleStartWrongPractice}
              disabled={!activeLibraryId || wrongQuestionIds.length === 0}
            >
              错题练习
            </button>
          </div>
        </article>
      </section>
    )
  }

  return (
    <section className={quickMode ? 'page practice-page quick-mode' : 'page practice-page'}>
      {!quickMode ? (
        <header className="page-header">
          <p className="eyebrow">练题会话</p>
          <h1>练习</h1>
        </header>
      ) : null}

      <article className={quickMode ? 'card quick-mode-card' : 'card'}>
        <div className="practice-layout">
          <div className="practice-topbar">
            <div className={quickMode ? 'quick-mode-progress' : 'practice-progress'}>
              <span>
                第 {currentSession.currentIndex + 1} / {currentSession.questionIds.length} 题
              </span>
              {!quickMode && memoryRecord ? (
                <span className="muted">记忆等级：第 {memoryRecord.level} 级</span>
              ) : null}
            </div>

            {quickMode ? (
              <div className="quick-mode-tools">
                <button type="button" className="secondary-button quick-mode-toggle" onClick={toggleQuickMode}>
                  退出快速练题
                </button>
              </div>
            ) : (
              <button type="button" className="secondary-button quick-mode-toggle" onClick={toggleQuickMode}>
                进入快速练题
              </button>
            )}
          </div>

          <h3 className={quickMode ? 'quick-mode-title' : undefined}>{currentQuestion.title}</h3>

          {currentQuestion.body ? (
            <div className="question-body">
              <MarkdownRenderer content={currentQuestion.body} />
            </div>
          ) : null}

          <div className="option-list">
            {currentQuestion.options.map((option) => {
              const selected = resolvedAnswer.selected.includes(option.key)
              const isExpected = expectedAnswers.has(option.key)
              const showOptionKey = currentQuestion.type !== 'boolean'

              return (
                <button
                  key={option.key}
                  type="button"
                  className={getOptionClassName({
                    selected,
                    submitted: resolvedAnswer.submitted,
                    isExpected,
                  })}
                  onClick={() => handleOptionSelect(currentQuestion.id, option.key)}
                  disabled={resolvedAnswer.submitted && quickMode}
                >
                  {showOptionKey ? <strong>{localizeAnswerToken(option.key)}</strong> : null}
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
                onClick={handleNextAction}
                disabled={resolvedAnswer.selected.length === 0}
              >
                下一题
              </button>
              <button
                className="secondary-button"
                onClick={() => toggleMarkedQuestion(currentQuestion.id)}
              >
                {currentSession.marks[currentQuestion.id] ? '取消标记' : '标记回看'}
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
                disabled={!resolvedAnswer.submitted}
              >
                下一题
              </button>
              <button
                className="secondary-button"
                onClick={() => toggleMarkedQuestion(currentQuestion.id)}
              >
                {currentSession.marks[currentQuestion.id] ? '取消标记' : '标记回看'}
              </button>
              <button
                className="action-button"
                onClick={submitCurrentAnswer}
                disabled={resolvedAnswer.selected.length === 0 || resolvedAnswer.submitted}
              >
                提交答案
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
                    const answer = currentSession.answers[questionId]
                    const selectedCount = answer?.selected.length ?? 0
                    const submitted = answer?.submitted ?? false
                    const marked = currentSession.marks[questionId] ?? false

                    return (
                      <button
                        key={questionId}
                        type="button"
                        className={getPracticeNavState({
                          selectedCount,
                          submitted,
                          marked,
                          current: currentSession.currentIndex === index,
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

          {!quickMode && feedback && feedback.questionId === currentQuestion.id ? (
            <div className={feedback.isCorrect ? 'feedback success' : 'feedback error'}>
              <p>{feedback.isCorrect ? '回答正确' : '回答错误'}</p>
              <p>你的答案：{localizeAnswerList(feedback.selected) || '未选择'}</p>
              <p>正确答案：{localizeAnswerList(feedback.expected) || '无'}</p>
              {resolvedAnswer.revealedExplanation && currentQuestion.explanation ? (
                <div>
                  <p>解析：</p>
                  <MarkdownRenderer content={currentQuestion.explanation} />
                </div>
              ) : null}
              <p className="muted">
                快捷键：可用字母键或数字键选择选项，回车提交或下一题，空格展开解析，左右方向键切题，按 M 标记回看。
              </p>
            </div>
          ) : null}

          {currentSession.status === 'completed' ? (
            <div className="feedback success">
              <p>本轮练习已完成。</p>
              <p className="muted">可以返回首页开始下一轮，或切换到其他练题模式。</p>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  )
}
