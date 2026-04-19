import { create } from 'zustand'
import { importMarkdownFiles } from '../core/import-export'
import {
  loadStoredDiagnostics,
  loadStoredLibraries,
  loadStoredQuestions,
  saveLibraryBackup,
  saveLibraryBundle,
} from '../core/storage'
import type { DiagnosticIssue, LibraryManifest, Question } from '../types'

type BuiltinLibraryPayload = {
  manifest: LibraryManifest
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
  getAllLibraries: () => LibraryManifest[]
  getActiveLibrary: () => LibraryManifest | undefined
  getQuestionsForActiveLibrary: () => Question[]
  getQuestionById: (questionId: string) => Question | undefined
  getDiagnosticsForActiveLibrary: () => DiagnosticIssue[]
}

async function fetchBuiltinLibrary(): Promise<BuiltinLibraryPayload> {
  const [manifestResponse, questionsResponse, diagnosticsResponse] = await Promise.all([
    fetch('/builtin-library/manifest.json'),
    fetch('/builtin-library/questions.json'),
    fetch('/builtin-library/diagnostics.json'),
  ])

  if (!manifestResponse.ok) {
    throw new Error(`Failed to load builtin manifest: ${manifestResponse.status}`)
  }

  if (!questionsResponse.ok) {
    throw new Error(`Failed to load builtin questions: ${questionsResponse.status}`)
  }

  if (!diagnosticsResponse.ok) {
    throw new Error(`Failed to load builtin diagnostics: ${diagnosticsResponse.status}`)
  }

  const manifest = (await manifestResponse.json()) as LibraryManifest
  const questions = (await questionsResponse.json()) as Question[]
  const diagnostics = (await diagnosticsResponse.json()) as DiagnosticIssue[]

  return { manifest, questions, diagnostics }
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

      if (libraries.length > 0) {
        const libraryMap = Object.fromEntries(libraries.map((library) => [library.id, library]))
        const questionMap = Object.fromEntries(questions.map((question) => [question.id, question]))
        const diagnosticsMap = diagnostics.reduce<Record<string, DiagnosticIssue[]>>((acc, item) => {
          acc[item.libraryId] ??= []
          acc[item.libraryId].push(item)
          return acc
        }, {})
        const firstLibrary = libraries[0]

        set({
          libraries: libraryMap,
          questions: questionMap,
          diagnostics: diagnosticsMap,
          activeLibraryId: firstLibrary?.id,
          isLoading: false,
          initialized: true,
          error: undefined,
        })
        void get().loadBuiltinLibrary()
        return
      }

      set({ initialized: true, isLoading: false })
      await get().loadBuiltinLibrary()
    } catch (error) {
      set({
        initialized: true,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize libraries.',
      })
    }
  },

  loadBuiltinLibrary: async () => {
    set({ isLoading: true, error: undefined })

    try {
      const { manifest, questions, diagnostics } = await fetchBuiltinLibrary()
      const questionMap = Object.fromEntries(questions.map((question) => [question.id, question]))
      await saveLibraryBundle(manifest, questions, diagnostics)
      const currentActiveLibraryId = get().activeLibraryId
      const shouldActivateBuiltin =
        !currentActiveLibraryId || currentActiveLibraryId === manifest.id || !get().libraries[currentActiveLibraryId]

      set({
        libraries: {
          ...get().libraries,
          [manifest.id]: manifest,
        },
        questions: {
          ...get().questions,
          ...questionMap,
        },
        diagnostics: {
          ...get().diagnostics,
          [manifest.id]: diagnostics,
        },
        activeLibraryId: shouldActivateBuiltin ? manifest.id : currentActiveLibraryId,
        isLoading: false,
        initialized: true,
        error: undefined,
      })
    } catch (error) {
      set({
        isLoading: false,
        initialized: true,
        error: error instanceof Error ? error.message : 'Failed to load builtin library.',
      })
    }
  },

  setActiveLibrary: (libraryId) => {
    if (!get().libraries[libraryId]) {
      return
    }

    set({
      activeLibraryId: libraryId,
    })
  },

  importFiles: async (files) => {
    if (files.length === 0) {
      return
    }

    set({ isLoading: true, error: undefined })

    try {
      const bundle = await importMarkdownFiles(files)
      await saveLibraryBundle(bundle.manifest, bundle.questions, bundle.diagnostics)

      set({
        libraries: {
          ...get().libraries,
          [bundle.manifest.id]: bundle.manifest,
        },
        questions: {
          ...get().questions,
          ...Object.fromEntries(bundle.questions.map((question) => [question.id, question])),
        },
        diagnostics: {
          ...get().diagnostics,
          [bundle.manifest.id]: bundle.diagnostics,
        },
        activeLibraryId: bundle.manifest.id,
        isLoading: false,
        error: undefined,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to import Markdown files.',
      })
    }
  },

  restoreBackup: async (input) => {
    await saveLibraryBackup(input.libraries, input.questions, input.diagnostics)

    const libraryMap = {
      ...get().libraries,
      ...Object.fromEntries(input.libraries.map((library) => [library.id, library])),
    }
    const questionMap = {
      ...get().questions,
      ...Object.fromEntries(input.questions.map((question) => [question.id, question])),
    }
    const diagnosticsMap = { ...get().diagnostics }

    for (const diagnostic of input.diagnostics) {
      diagnosticsMap[diagnostic.libraryId] = [
        ...(diagnosticsMap[diagnostic.libraryId] ?? []).filter((item) => item.id !== diagnostic.id),
        diagnostic,
      ]
    }

    set({
      libraries: libraryMap,
      questions: questionMap,
      diagnostics: diagnosticsMap,
      activeLibraryId:
        input.activeLibraryId && libraryMap[input.activeLibraryId]
          ? input.activeLibraryId
          : get().activeLibraryId ?? input.libraries[0]?.id,
      isLoading: false,
      error: undefined,
    })
  },

  getAllLibraries: () =>
    Object.values(get().libraries).sort((left, right) => right.updatedAt - left.updatedAt),

  getActiveLibrary: () => {
    const state = get()
    return state.activeLibraryId ? state.libraries[state.activeLibraryId] : undefined
  },

  getQuestionsForActiveLibrary: () => {
    const state = get()
    const activeLibrary = state.activeLibraryId ? state.libraries[state.activeLibraryId] : undefined

    if (!activeLibrary) {
      return []
    }

    return activeLibrary.questionIds
      .map((questionId) => state.questions[questionId])
      .filter((question): question is Question => Boolean(question))
  },

  getQuestionById: (questionId) => get().questions[questionId],

  getDiagnosticsForActiveLibrary: () => {
    const state = get()
    return state.activeLibraryId ? state.diagnostics[state.activeLibraryId] ?? [] : []
  },
}))
