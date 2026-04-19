import { create } from 'zustand'
import { importMarkdownFiles } from '../core/import-export'
import {
  deleteLibraryBundle,
  loadStoredDiagnostics,
  loadStoredLibraries,
  loadStoredQuestions,
  saveLibraryBackup,
  saveLibraryBundle,
} from '../core/storage'
import type { DiagnosticIssue, LibraryManifest, Question } from '../types'

type BuiltinLibraryPayload = {
  manifests: LibraryManifest[]
  questions: Question[]
  diagnostics: DiagnosticIssue[]
}

type LibraryStoreState = {
  libraries: Record<string, LibraryManifest>
  questions: Record<string, Question>
  diagnostics: Record<string, DiagnosticIssue[]>
  activeLibraryId?: string
  isLoading: boolean
  initialized: boolean
  error?: string
  initialize: () => Promise<void>
  loadBuiltinLibrary: () => Promise<void>
  setActiveLibrary: (libraryId: string) => void
  importFiles: (files: File[]) => Promise<void>
  restoreBackup: (input: {
    libraries: LibraryManifest[]
    questions: Question[]
    diagnostics: DiagnosticIssue[]
    activeLibraryId?: string
  }) => Promise<void>
  deleteLibrary: (libraryId: string) => Promise<void>
  getAllLibraries: () => LibraryManifest[]
  getActiveLibrary: () => LibraryManifest | undefined
  getQuestionsForLibrary: (libraryId: string) => Question[]
  getQuestionsForActiveLibrary: () => Question[]
  getQuestionById: (questionId: string) => Question | undefined
  getDiagnosticsForLibrary: (libraryId: string) => DiagnosticIssue[]
  getDiagnosticsForActiveLibrary: () => DiagnosticIssue[]
}

type LibrarySnapshot = Pick<LibraryStoreState, 'libraries' | 'questions' | 'diagnostics' | 'activeLibraryId'>

const ACTIVE_LIBRARY_STORAGE_KEY = 'mdquiz.activeLibraryId'

function resolveVisibleError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
    return error.message
  }

  return fallbackMessage
}

async function fetchBuiltinLibraries(): Promise<BuiltinLibraryPayload> {
  const builtinLibraryBaseUrl = new URL('builtin-library/', window.location.origin + import.meta.env.BASE_URL)
  const [librariesResponse, questionsResponse, diagnosticsResponse] = await Promise.all([
    fetch(new URL('libraries.json', builtinLibraryBaseUrl)),
    fetch(new URL('questions.json', builtinLibraryBaseUrl)),
    fetch(new URL('diagnostics.json', builtinLibraryBaseUrl)),
  ])

  if (!librariesResponse.ok) {
    throw new Error(`加载默认题库清单失败：${librariesResponse.status}`)
  }

  if (!questionsResponse.ok) {
    throw new Error(`加载默认题目数据失败：${questionsResponse.status}`)
  }

  if (!diagnosticsResponse.ok) {
    throw new Error(`加载默认题库诊断失败：${diagnosticsResponse.status}`)
  }

  const manifests = (await librariesResponse.json()) as LibraryManifest[]
  const questions = (await questionsResponse.json()) as Question[]
  const diagnostics = (await diagnosticsResponse.json()) as DiagnosticIssue[]

  return { manifests, questions, diagnostics }
}

function buildLibraryMap(libraries: LibraryManifest[]): Record<string, LibraryManifest> {
  return Object.fromEntries(libraries.map((library) => [library.id, library]))
}

function buildQuestionMap(questions: Question[]): Record<string, Question> {
  return Object.fromEntries(questions.map((question) => [question.id, question]))
}

function buildDiagnosticsMap(diagnostics: DiagnosticIssue[]): Record<string, DiagnosticIssue[]> {
  return diagnostics.reduce<Record<string, DiagnosticIssue[]>>((acc, item) => {
    acc[item.libraryId] ??= []
    acc[item.libraryId].push(item)
    return acc
  }, {})
}

function sortLibraries(libraries: LibraryManifest[]): LibraryManifest[] {
  return [...libraries].sort((left, right) => right.updatedAt - left.updatedAt)
}

function pickNextActiveLibraryId(libraries: Record<string, LibraryManifest>): string | undefined {
  return sortLibraries(Object.values(libraries))[0]?.id
}

function readPersistedActiveLibraryId(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  const storedLibraryId = window.localStorage.getItem(ACTIVE_LIBRARY_STORAGE_KEY)?.trim()
  return storedLibraryId ? storedLibraryId : undefined
}

function persistActiveLibraryId(libraryId: string | undefined): void {
  if (typeof window === 'undefined') {
    return
  }

  if (libraryId) {
    window.localStorage.setItem(ACTIVE_LIBRARY_STORAGE_KEY, libraryId)
    return
  }

  window.localStorage.removeItem(ACTIVE_LIBRARY_STORAGE_KEY)
}

function resolveActiveLibraryId(
  libraries: Record<string, LibraryManifest>,
  preferredLibraryId?: string,
): string | undefined {
  if (preferredLibraryId && libraries[preferredLibraryId]) {
    return preferredLibraryId
  }

  return pickNextActiveLibraryId(libraries)
}

function removeLibrariesFromState(state: LibrarySnapshot, libraryIds: Iterable<string>): LibrarySnapshot {
  const libraryIdSet = new Set(libraryIds)

  if (libraryIdSet.size === 0) {
    return state
  }

  return {
    libraries: Object.fromEntries(
      Object.entries(state.libraries).filter(([libraryId]) => !libraryIdSet.has(libraryId)),
    ),
    questions: Object.fromEntries(
      Object.entries(state.questions).filter(([, question]) => !libraryIdSet.has(question.libraryId)),
    ),
    diagnostics: Object.fromEntries(
      Object.entries(state.diagnostics).filter(([libraryId]) => !libraryIdSet.has(libraryId)),
    ),
    activeLibraryId: libraryIdSet.has(state.activeLibraryId ?? '') ? undefined : state.activeLibraryId,
  }
}

async function clearLibraryRecords(libraryId: string): Promise<void> {
  const [{ useReviewStore }, { useSessionStore }, { useExamStore }] = await Promise.all([
    import('./reviewStore'),
    import('./sessionStore'),
    import('./examStore'),
  ])

  await Promise.all([
    useReviewStore.getState().clearRecordsForLibrary(libraryId),
    useSessionStore.getState().clearSessionsForLibrary(libraryId),
    useExamStore.getState().clearResultsForLibrary(libraryId),
  ])
}

async function purgeLibraryData(libraryId: string): Promise<void> {
  await deleteLibraryBundle(libraryId)
  await clearLibraryRecords(libraryId)
}

export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  libraries: {},
  questions: {},
  diagnostics: {},
  activeLibraryId: undefined,
  isLoading: false,
  initialized: false,
  error: undefined,

  initialize: async () => {
    if (get().initialized) {
      return
    }

    set({ isLoading: true, error: undefined })

    try {
      const [libraries, questions, diagnostics] = await Promise.all([
        loadStoredLibraries(),
        loadStoredQuestions(),
        loadStoredDiagnostics(),
      ])

      const libraryMap = buildLibraryMap(libraries)
      const questionMap = buildQuestionMap(questions)
      const diagnosticsMap = buildDiagnosticsMap(diagnostics)
      const nextActiveLibraryId = resolveActiveLibraryId(libraryMap, readPersistedActiveLibraryId())

      set({
        libraries: libraryMap,
        questions: questionMap,
        diagnostics: diagnosticsMap,
        activeLibraryId: nextActiveLibraryId,
        isLoading: false,
        initialized: true,
        error: undefined,
      })
      persistActiveLibraryId(nextActiveLibraryId)

      await get().loadBuiltinLibrary()
    } catch (error) {
      set({
        initialized: true,
        isLoading: false,
        error: resolveVisibleError(error, '初始化题库失败。'),
      })
    }
  },

  loadBuiltinLibrary: async () => {
    set({ isLoading: true, error: undefined })

    try {
      const preferredActiveLibraryId = readPersistedActiveLibraryId() ?? get().activeLibraryId
      const { manifests, questions, diagnostics } = await fetchBuiltinLibraries()
      const currentBuiltinIds = Object.values(get().libraries)
        .filter((library) => library.sourceType === 'builtin')
        .map((library) => library.id)
      const fetchedBuiltinIds = new Set(manifests.map((manifest) => manifest.id))
      const staleBuiltinIds = currentBuiltinIds.filter((libraryId) => !fetchedBuiltinIds.has(libraryId))
      const replaceBuiltinIds = currentBuiltinIds.filter((libraryId) => fetchedBuiltinIds.has(libraryId))

      await Promise.all(staleBuiltinIds.map((libraryId) => purgeLibraryData(libraryId)))
      await Promise.all(replaceBuiltinIds.map((libraryId) => deleteLibraryBundle(libraryId)))
      await saveLibraryBackup(manifests, questions, diagnostics)

      const stateWithoutBuiltin = removeLibrariesFromState(get(), currentBuiltinIds)
      const nextLibraries = {
        ...stateWithoutBuiltin.libraries,
        ...buildLibraryMap(manifests),
      }
      const nextQuestions = {
        ...stateWithoutBuiltin.questions,
        ...buildQuestionMap(questions),
      }
      const nextDiagnostics = {
        ...stateWithoutBuiltin.diagnostics,
        ...buildDiagnosticsMap(diagnostics),
      }
      const nextActiveLibraryId = resolveActiveLibraryId(nextLibraries, preferredActiveLibraryId)

      set({
        libraries: nextLibraries,
        questions: nextQuestions,
        diagnostics: nextDiagnostics,
        activeLibraryId: nextActiveLibraryId,
        isLoading: false,
        initialized: true,
        error: undefined,
      })
      persistActiveLibraryId(nextActiveLibraryId)
    } catch (error) {
      set({
        isLoading: false,
        initialized: true,
        error: resolveVisibleError(error, '加载默认题库失败。'),
      })
    }
  },

  setActiveLibrary: (libraryId) => {
    if (!get().libraries[libraryId]) {
      return
    }

    set({ activeLibraryId: libraryId })
    persistActiveLibraryId(libraryId)
  },

  importFiles: async (files) => {
    if (files.length === 0) {
      return
    }

    set({ isLoading: true, error: undefined })

    try {
      const bundle = await importMarkdownFiles(files)
      await saveLibraryBundle(bundle.manifest, bundle.questions, bundle.diagnostics)

      const state = get()
      const nextLibraries = {
        ...state.libraries,
        [bundle.manifest.id]: bundle.manifest,
      }
      const nextActiveLibraryId = resolveActiveLibraryId(nextLibraries, state.activeLibraryId ?? bundle.manifest.id)

      set({
        libraries: nextLibraries,
        questions: {
          ...state.questions,
          ...buildQuestionMap(bundle.questions),
        },
        diagnostics: {
          ...state.diagnostics,
          [bundle.manifest.id]: bundle.diagnostics,
        },
        activeLibraryId: nextActiveLibraryId,
        isLoading: false,
        error: undefined,
      })
      persistActiveLibraryId(nextActiveLibraryId)
    } catch (error) {
      set({
        isLoading: false,
        error: resolveVisibleError(error, '导入题库文件失败。'),
      })
    }
  },

  restoreBackup: async (input) => {
    await saveLibraryBackup(input.libraries, input.questions, input.diagnostics)

    const state = get()
    const mergedLibraries = {
      ...state.libraries,
      ...buildLibraryMap(input.libraries),
    }
    const mergedQuestions = {
      ...state.questions,
      ...buildQuestionMap(input.questions),
    }
    const mergedDiagnostics = {
      ...state.diagnostics,
      ...buildDiagnosticsMap(input.diagnostics),
    }
    const preferredLibraryId = input.activeLibraryId ?? state.activeLibraryId
    const nextActiveLibraryId = resolveActiveLibraryId(mergedLibraries, preferredLibraryId)

    set({
      libraries: mergedLibraries,
      questions: mergedQuestions,
      diagnostics: mergedDiagnostics,
      activeLibraryId: nextActiveLibraryId,
      isLoading: false,
      error: undefined,
    })
    persistActiveLibraryId(nextActiveLibraryId)
  },

  deleteLibrary: async (libraryId) => {
    const library = get().libraries[libraryId]

    if (!library) {
      return
    }

    if (library.sourceType === 'builtin') {
      throw new Error('默认题库不支持删除。')
    }

    set({ isLoading: true, error: undefined })

    try {
      await purgeLibraryData(libraryId)

      const nextState = removeLibrariesFromState(get(), [libraryId])
      const nextActiveLibraryId = resolveActiveLibraryId(nextState.libraries, nextState.activeLibraryId)

      set({
        ...nextState,
        activeLibraryId: nextActiveLibraryId,
        isLoading: false,
        error: undefined,
      })
      persistActiveLibraryId(nextActiveLibraryId)
    } catch (error) {
      set({
        isLoading: false,
        error: resolveVisibleError(error, '删除题库失败。'),
      })
      throw error
    }
  },

  getAllLibraries: () => sortLibraries(Object.values(get().libraries)),

  getActiveLibrary: () => {
    const state = get()
    return state.activeLibraryId ? state.libraries[state.activeLibraryId] : undefined
  },

  getQuestionsForLibrary: (libraryId) => {
    const state = get()
    const library = state.libraries[libraryId]

    if (!library) {
      return []
    }

    return library.questionIds
      .map((questionId) => state.questions[questionId])
      .filter((question): question is Question => Boolean(question))
  },

  getQuestionsForActiveLibrary: () => {
    const activeLibraryId = get().activeLibraryId
    return activeLibraryId ? get().getQuestionsForLibrary(activeLibraryId) : []
  },

  getQuestionById: (questionId) => get().questions[questionId],

  getDiagnosticsForLibrary: (libraryId) => get().diagnostics[libraryId] ?? [],

  getDiagnosticsForActiveLibrary: () => {
    const activeLibraryId = get().activeLibraryId
    return activeLibraryId ? get().getDiagnosticsForLibrary(activeLibraryId) : []
  },
}))
