import type { QuizSession } from '../../../types'
import { STORE_NAMES } from '../../../types'
import { deleteValuesByIndex, getAllValues, putValue, putValues } from './common'

export async function loadStoredSessions(): Promise<QuizSession[]> {
  return getAllValues<QuizSession>(STORE_NAMES.sessions)
}

export async function saveSession(session: QuizSession): Promise<void> {
  await putValue(STORE_NAMES.sessions, session)
}

export async function saveSessions(sessions: QuizSession[]): Promise<void> {
  await putValues(STORE_NAMES.sessions, sessions)
}

export async function deleteSessionsByLibrary(libraryId: string): Promise<number> {
  return deleteValuesByIndex(STORE_NAMES.sessions, 'libraryId', libraryId)
}
