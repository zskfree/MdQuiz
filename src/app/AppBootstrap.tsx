import { useEffect } from 'react'
import {
  useCloudSyncStore,
  useExamStore,
  useLibraryStore,
  useReviewStore,
  useSessionStore,
} from '../stores'

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000

export function AppBootstrap() {
  const initializeExam = useExamStore((state) => state.initialize)
  const initializeLibraries = useLibraryStore((state) => state.initialize)
  const initializeReview = useReviewStore((state) => state.initialize)
  const initializeSession = useSessionStore((state) => state.initialize)
  const initializeCloudSync = useCloudSyncStore((state) => state.initialize)
  const cloudUserId = useCloudSyncStore((state) => state.user?.uid)
  const autoSyncEnabled = useCloudSyncStore((state) => state.autoSyncEnabled)
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

    triggerAutoSync()

    const timer = window.setInterval(triggerAutoSync, AUTO_SYNC_INTERVAL_MS)
    window.addEventListener('online', triggerAutoSync)
    document.addEventListener('visibilitychange', triggerAutoSync)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', triggerAutoSync)
      document.removeEventListener('visibilitychange', triggerAutoSync)
    }
  }, [autoSyncEnabled, cloudUserId, uploadNow])

  return null
}
