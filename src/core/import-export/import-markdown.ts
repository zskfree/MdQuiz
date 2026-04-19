import { createDiagnosticIssue, parseMarkdownQuestion } from '../parser'
import type { DiagnosticIssue, LibraryManifest, Question } from '../../types'

type ImportedLibraryBundle = {
  manifest: LibraryManifest
  questions: Question[]
  diagnostics: DiagnosticIssue[]
}

type ParsedQuestionEntry = {
  rawId: string
  question: Question
  diagnostics: DiagnosticIssue[]
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createStableHash(input: string): string {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }

  return hash.toString(36)
}

function buildImportedLibraryId(files: File[]): string {
  const signature = files
    .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
    .sort((left, right) => left.localeCompare(right))
    .join('|')

  return `imported-${createStableHash(signature)}`
}

function buildImportedLibraryName(files: File[]): string {
  if (files.length === 1) {
    return `Imported: ${files[0].name}`
  }

  const firstStem = slugify(files[0]?.name ?? 'library')
  return `Imported Library (${firstStem || 'markdown'})`
}

function createNamespacedQuestionId(libraryId: string, rawId: string, duplicateIndex: number): string {
  return duplicateIndex <= 1 ? `${libraryId}::${rawId}` : `${libraryId}::${rawId}--dup-${duplicateIndex}`
}

export async function importMarkdownFiles(files: File[]): Promise<ImportedLibraryBundle> {
  const markdownFiles = files.filter((file) => file.name.toLowerCase().endsWith('.md'))

  if (markdownFiles.length === 0) {
    throw new Error('No Markdown files were selected.')
  }

  const libraryId = buildImportedLibraryId(markdownFiles)
  const parsedEntries: ParsedQuestionEntry[] = []

  for (const file of markdownFiles) {
    const content = await file.text()
    const result = parseMarkdownQuestion({
      libraryId,
      sourcePath: file.name,
      content,
    })

    parsedEntries.push({
      rawId: result.question.id,
      question: result.question,
      diagnostics: result.diagnostics,
    })
  }

  const duplicateCounter = new Map<string, number>()
  const diagnostics: DiagnosticIssue[] = []
  const questions: Question[] = parsedEntries.map((entry) => {
    const seenCount = (duplicateCounter.get(entry.rawId) ?? 0) + 1
    duplicateCounter.set(entry.rawId, seenCount)

    const nextId = createNamespacedQuestionId(libraryId, entry.rawId, seenCount)
    const entryDiagnostics = [...entry.diagnostics]

    if (seenCount > 1) {
      entryDiagnostics.push(
        createDiagnosticIssue({
          libraryId,
          questionId: nextId,
          type: 'duplicate-id',
          message: `Duplicate question id detected: ${entry.rawId}. Generated fallback namespaced id ${nextId}.`,
        }),
      )
    }

    const nextQuestion: Question = {
      ...entry.question,
      id: nextId,
      libraryId,
      diagnostics: entryDiagnostics.map((item) => item.id),
      updatedAt: Date.now(),
    }

    diagnostics.push(
      ...entryDiagnostics.map((item) => ({
        ...item,
        questionId: item.questionId ? nextId : item.questionId,
      })),
    )

    return nextQuestion
  })

  const buildFinishedAt = Date.now()
  const manifest: LibraryManifest = {
    id: libraryId,
    name: buildImportedLibraryName(markdownFiles),
    sourceType: 'imported',
    questionIds: questions.map((question) => question.id),
    createdAt: buildFinishedAt,
    updatedAt: buildFinishedAt,
    questionCount: questions.length,
    scorableCount: questions.filter((question) => question.scorable).length,
    meta: {
      importedFileCount: markdownFiles.length,
      diagnosticsCount: diagnostics.length,
    },
  }

  return {
    manifest,
    questions,
    diagnostics,
  }
}
