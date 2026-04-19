import { useEffect } from 'react'
import { useExamStore, useLibraryStore, useReviewStore, useSessionStore } from '../stores'

export function AppBootstrap() {
  const initializeExam = useExamStore((state) => state.initialize)
  const initializeLibraries = useLibraryStore((state) => state.initialize)
  const initializeReview = useReviewStore((state) => state.initialize)
  const initializeSession = useSessionStore((state) => state.initialize)

  useEffect(() => {
    void initializeExam()
    void initializeLibraries()
    void initializeReview()
    void initializeSession()
  }, [initializeExam, initializeLibraries, initializeReview, initializeSession])

  return null
}
