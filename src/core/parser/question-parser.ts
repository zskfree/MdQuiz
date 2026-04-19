import type { DiagnosticIssue, Question, QuestionOption, QuestionType } from '../../types'
import { createDiagnosticIssue } from './diagnostics'
import { parseMarkdownWithFrontmatter } from './frontmatter'
import { extractOptions, stripOptionsFromBody } from './option-extractor'

export type ParseQuestionInput = {
  libraryId: string
  sourcePath: string
  content: string
}

export type ParseQuestionResult = {
  question: Question
  diagnostics: DiagnosticIssue[]
}

type BooleanOptionMeta = {
  options: QuestionOption[]
  aliases: Map<string, 'TRUE' | 'FALSE'>
}

function createFallbackId(sourcePath: string): string {
  return sourcePath
    .replace(/\\/g, '/')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
}

function createTitle(body: string, fallbackId: string): string {
  const firstContentLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstContentLine) {
    return `Untitled-${fallbackId}`
  }

  return firstContentLine.replace(/^#+\s*/, '')
}

function stripDuplicateLeadingHeading(body: string, title: string): string {
  const trimmedTitle = title.trim()
  const trimmedBody = body.trim()

  if (!trimmedTitle || !trimmedBody) {
    return trimmedBody
  }

  const lines = trimmedBody.split(/\r?\n/)
  const firstLine = lines[0]?.trim().replace(/^#\s+/, '') ?? ''

  if (firstLine === trimmedTitle) {
    return lines.slice(1).join('\n').trim()
  }

  return trimmedBody
}

function normalizeBooleanValue(value: string): 'TRUE' | 'FALSE' | undefined {
  const normalized = value.trim().toLowerCase()

  if (['true', 't', '对', '正确', '是', 'y', 'yes', '√'].includes(normalized)) {
    return 'TRUE'
  }

  if (['false', 'f', '错', '错误', '否', 'n', 'no', '×'].includes(normalized)) {
    return 'FALSE'
  }

  return undefined
}

function normalizeAnswer(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeAnswer(item))
  }

  if (typeof value === 'boolean') {
    return [value ? 'TRUE' : 'FALSE']
  }

  if (typeof value !== 'string') {
    return []
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  const normalizedBoolean = normalizeBooleanValue(trimmed)
  if (normalizedBoolean) {
    return [normalizedBoolean]
  }

  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  }

  if (/^[A-Za-z]{2,}$/.test(trimmed)) {
    return trimmed.toUpperCase().split('')
  }

  return [trimmed.toUpperCase()]
}

function createDefaultBooleanOptions(): QuestionOption[] {
  return [
    { key: 'TRUE', label: '正确' },
    { key: 'FALSE', label: '错误' },
  ]
}

function buildBooleanOptionMeta(extractedOptions: QuestionOption[]): BooleanOptionMeta | undefined {
  if (extractedOptions.length === 0) {
    return undefined
  }

  const aliases = new Map<string, 'TRUE' | 'FALSE'>()
  let trueLabel: string | undefined
  let falseLabel: string | undefined

  for (const option of extractedOptions) {
    const semantic = normalizeBooleanValue(option.label) ?? normalizeBooleanValue(option.key)

    if (!semantic) {
      continue
    }

    aliases.set(option.key.trim().toUpperCase(), semantic)
    aliases.set(option.label.trim().toUpperCase(), semantic)

    if (semantic === 'TRUE' && !trueLabel) {
      trueLabel = option.label
    }

    if (semantic === 'FALSE' && !falseLabel) {
      falseLabel = option.label
    }
  }

  if (!trueLabel || !falseLabel) {
    return undefined
  }

  return {
    options: [
      { key: 'TRUE', label: trueLabel },
      { key: 'FALSE', label: falseLabel },
    ],
    aliases,
  }
}

function inferQuestionType(
  frontmatterType: string | undefined,
  answers: string[],
  booleanOptionMeta: BooleanOptionMeta | undefined,
): QuestionType {
  if (frontmatterType === 'single' || frontmatterType === 'multiple' || frontmatterType === 'boolean') {
    return frontmatterType
  }

  if (answers.length === 1 && (answers[0] === 'TRUE' || answers[0] === 'FALSE')) {
    return 'boolean'
  }

  if (booleanOptionMeta && answers.length === 1) {
    const mapped = booleanOptionMeta.aliases.get(answers[0].trim().toUpperCase())
    if (mapped) {
      return 'boolean'
    }
  }

  if (answers.length > 1) {
    return 'multiple'
  }

  return 'single'
}

function normalizeBooleanAnswers(answers: string[], booleanOptionMeta: BooleanOptionMeta | undefined): string[] {
  const normalized = new Set<string>()

  for (const answer of answers) {
    const semantic = normalizeBooleanValue(answer)
    if (semantic) {
      normalized.add(semantic)
      continue
    }

    const alias = booleanOptionMeta?.aliases.get(answer.trim().toUpperCase())
    if (alias) {
      normalized.add(alias)
      continue
    }

    normalized.add(answer.trim().toUpperCase())
  }

  return Array.from(normalized)
}

function answerMatchesOptions(type: QuestionType, answers: string[], optionKeys: Set<string>): boolean {
  if (type === 'boolean') {
    return answers.every((answer) => answer === 'TRUE' || answer === 'FALSE')
  }

  return answers.every((answer) => optionKeys.has(answer))
}

export function parseMarkdownQuestion(input: ParseQuestionInput): ParseQuestionResult {
  const now = Date.now()
  const diagnostics: DiagnosticIssue[] = []
  const parsed = parseMarkdownWithFrontmatter(input.content)
  const fallbackId = createFallbackId(input.sourcePath)
  const questionId = parsed.frontmatter.id ?? fallbackId
  const extractedOptions = extractOptions(parsed.body)
  const booleanOptionMeta = buildBooleanOptionMeta(extractedOptions)
  const rawAnswers = normalizeAnswer(parsed.frontmatter.answer)
  const type = inferQuestionType(parsed.frontmatter.type, rawAnswers, booleanOptionMeta)
  const answers = type === 'boolean' ? normalizeBooleanAnswers(rawAnswers, booleanOptionMeta) : rawAnswers
  const options =
    type === 'boolean'
      ? (booleanOptionMeta?.options ?? createDefaultBooleanOptions())
      : extractedOptions

  if (!parsed.frontmatter.id) {
    diagnostics.push(
      createDiagnosticIssue({
        libraryId: input.libraryId,
        questionId,
        type: 'missing-id',
        message: `Question in ${input.sourcePath} is missing an explicit id; generated fallback id ${questionId}.`,
      }),
    )
  }

  if (answers.length === 0) {
    diagnostics.push(
      createDiagnosticIssue({
        libraryId: input.libraryId,
        questionId,
        type: 'missing-answer',
        message: `Question ${questionId} has no scorable answer.`,
      }),
    )
  }

  const optionKeys = new Set(options.map((option) => option.key.toUpperCase()))

  if (answers.length > 0 && type !== 'boolean' && options.length === 0) {
    diagnostics.push(
      createDiagnosticIssue({
        libraryId: input.libraryId,
        questionId,
        type: 'option-answer-mismatch',
        message: `Question ${questionId} has a declared answer but no options were extracted.`,
      }),
    )
  }

  if (answers.length > 0 && options.length > 0 && !answerMatchesOptions(type, answers, optionKeys)) {
    diagnostics.push(
      createDiagnosticIssue({
        libraryId: input.libraryId,
        questionId,
        type: 'option-answer-mismatch',
        message: `Question ${questionId} has answers that do not match extracted options.`,
      }),
    )
  }

  const cleanedBody = stripOptionsFromBody(parsed.body)
  const title = parsed.frontmatter.title ?? createTitle(cleanedBody, questionId)
  const displayBody = stripDuplicateLeadingHeading(cleanedBody, title)

  const question: Question = {
    id: questionId,
    libraryId: input.libraryId,
    sourcePath: input.sourcePath,
    title,
    type,
    body: displayBody,
    options,
    answer: answers,
    explanation: parsed.frontmatter.explanation ?? '',
    tags: parsed.frontmatter.tags,
    difficulty: parsed.frontmatter.difficulty ?? 3,
    scorable: answers.length > 0 && (type === 'boolean' || options.length > 0),
    assets: [],
    diagnostics: diagnostics.map((item) => item.id),
    createdAt: now,
    updatedAt: now,
  }

  return {
    question,
    diagnostics,
  }
}
