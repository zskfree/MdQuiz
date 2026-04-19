import type { DiagnosticIssue, LibraryManifest, Question } from '../../../types'
import { STORE_NAMES } from '../../../types'
import { deleteValue, deleteValuesByIndex, getAllValues, putValue, putValues } from './common'

export async function loadStoredLibraries(): Promise<LibraryManifest[]> {
  return getAllValues<LibraryManifest>(STORE_NAMES.libraries)
}

export async function loadStoredQuestions(): Promise<Question[]> {
  return getAllValues<Question>(STORE_NAMES.questions)
}

export async function loadStoredDiagnostics(): Promise<DiagnosticIssue[]> {
  return getAllValues<DiagnosticIssue>(STORE_NAMES.diagnostics)
}

export async function saveLibraryBundle(
  manifest: LibraryManifest,
  questions: Question[],
  diagnostics: DiagnosticIssue[],
): Promise<void> {
  await putValue(STORE_NAMES.libraries, manifest)
  await putValues(STORE_NAMES.questions, questions)
  await putValues(STORE_NAMES.diagnostics, diagnostics)
}

export async function saveLibraryBackup(
  libraries: LibraryManifest[],
  questions: Question[],
  diagnostics: DiagnosticIssue[],
): Promise<void> {
  await putValues(STORE_NAMES.libraries, libraries)
  await putValues(STORE_NAMES.questions, questions)
  await putValues(STORE_NAMES.diagnostics, diagnostics)
}

export async function deleteLibraryBundle(libraryId: string): Promise<void> {
  await deleteValue(STORE_NAMES.libraries, libraryId)
  await deleteValuesByIndex(STORE_NAMES.questions, 'libraryId', libraryId)
  await deleteValuesByIndex(STORE_NAMES.diagnostics, 'libraryId', libraryId)
  await deleteValuesByIndex(STORE_NAMES.imports, 'libraryId', libraryId)
}
