import type { ExamResult } from '../../../types'
import { STORE_NAMES } from '../../../types'
import { deleteValuesByIndex, getAllValues, putValue, putValues } from './common'

export async function loadStoredExamResults(): Promise<ExamResult[]> {
  return getAllValues<ExamResult>(STORE_NAMES.examResults)
}

export async function saveExamResult(result: ExamResult): Promise<void> {
  await putValue(STORE_NAMES.examResults, result)
}

export async function saveExamResults(results: ExamResult[]): Promise<void> {
  await putValues(STORE_NAMES.examResults, results)
}

export async function deleteExamResultsByLibrary(libraryId: string): Promise<number> {
  return deleteValuesByIndex(STORE_NAMES.examResults, 'libraryId', libraryId)
}
