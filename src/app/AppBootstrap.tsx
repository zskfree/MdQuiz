import { useEffect } from 'react'
import {
  useCloudSyncStore,
  useExamStore,
  useLibraryStore,
  useReviewStore,
  useSessionStore,
} from '../stores'

export function AppBootstrap() {
  const initializeExam = useExamStore((state) => state.initialize)
  const initializeLibraries = useLibraryStore((state) => state.initialize)
  const initializeReview = useReviewStore((state) => state.initialize)
  const initializeSession = useSessionStore((state) => state.initialize)
  const initializeCloudSync = useCloudSyncStore((state) => state.initialize)
  const cloudUserId = useCloudSyncStore((state) => state.user?.uid)
  const autoSyncEnabled = useCloudSyncStore((state) => state.autoSyncEnabled)
  const autoSyncIntervalMinutes = useCloudSyncStore((state) => state.autoSyncIntervalMinutes)
  const uploadNow = useCloudSyncStore((state) => state.uploadNow)

  useEffect(() => {
    void initializeExam()
    void initializeLibraries()
    void initializeReview()
    void initializeSession()
    initializeCloudSync()
  }, [initializeExam, initializeLibraries, initializeReview, initializeSession, initializeCloudSync])

  useEffect(() => {
    if (!autoSyncEnabled || !cloudUserId) {
      return
    }

    const triggerAutoSync = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      void uploadNow()
    }

    const autoSyncIntervalMs = Math.max(1, autoSyncIntervalMinutes) * 60 * 1000

    triggerAutoSync()

    const timer = window.setInterval(triggerAutoSync, autoSyncIntervalMs)
    window.addEventListener('online', triggerAutoSync)
    document.addEventListener('visibilitychange', triggerAutoSync)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', triggerAutoSync)
      document.removeEventListener('visibilitychange', triggerAutoSync)
    }
  }, [autoSyncEnabled, autoSyncIntervalMinutes, cloudUserId, uploadNow])

  return null
}
