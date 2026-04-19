import type { DiagnosticIssue, Question } from '../../types'
import { createDiagnosticIssue } from './diagnostics'
import {
  answerMatchesOptions,
  buildBooleanOptionMeta,
  createDefaultBooleanOptions,
  inferQuestionType,
  normalizeAnswer,
  normalizeBooleanAnswers,
  type ParseQuestionInput,
  type ParseQuestionResult,
} from './question-parser'
import { extractOptions, stripOptionsFromBody } from './option-extractor'

const QUESTION_HEADING_PATTERN = /^##\s*(\d+)\s*[、.．)]\s*(.+?)\s*$/
const ANSWER_LINE_PATTERN = /^\s*(?:[-*+]\s*)?\u7b54\u6848[：:]\s*(.+?)\s*$/
const EXPLANATION_LINE_PATTERN = /^\s*(?:[-*+]\s*)?(?:\u89e3\u6790|\u89e3\u91ca)[：:]\s*(.*)\s*$/

type QuestionSection = {
  rawId: string
  title: string
  lines: string[]
}

type ExtractedSectionContent = {
  body: string
  answer?: string
  explanation?: string
}

function splitQuestionSections(content: string): QuestionSection[] {
  const sections: QuestionSection[] = []
  let current: QuestionSection | undefined

  for (const line of content.split(/\r?\n/)) {
    const headingMatch = line.match(QUESTION_HEADING_PATTERN)

    if (headingMatch) {
      if (current) {
        sections.push(current)
      }

      current = {
        rawId: headingMatch[1],
        title: headingMatch[2].trim(),
        lines: [],
      }
      continue
    }

    if (current) {
      current.lines.push(line)
    }
  }

  if (current) {
    sections.push(current)
  }

  return sections
}

function extractSectionContent(lines: string[]): ExtractedSectionContent {
  const bodyLines: string[] = []
  const explanationLines: string[] = []
  let answer: string | undefined
  let collectingExplanation = false

  for (const line of lines) {
    const answerMatch = line.match(ANSWER_LINE_PATTERN)

    if (answerMatch) {
      answer = answerMatch[1].trim()
      collectingExplanation = false
      continue
    }

    const explanationMatch = line.match(EXPLANATION_LINE_PATTERN)

    if (explanationMatch) {
      collectingExplanation = true
      const firstLine = explanationMatch[1].trim()

      if (firstLine) {
        explanationLines.push(firstLine)
      }
      continue
    }

    if (collectingExplanation) {
      explanationLines.push(line)
      continue
    }

    bodyLines.push(line)
  }

  const explanation = explanationLines.join('\n').trim()

  return {
    body: bodyLines.join('\n').trim(),
    answer,
    explanation: explanation || undefined,
  }
}

function stripLeadingTitle(body: string, title: string): string {
  const trimmedBody = body.trim()
  const trimmedTitle = title.trim()

  if (!trimmedBody || !trimmedTitle) {
    return trimmedBody
  }

  const lines = trimmedBody.split(/\r?\n/)
  const firstLine = lines[0]?.trim()

  if (firstLine === trimmedTitle) {
    return lines.slice(1).join('\n').trim()
  }

  return trimmedBody
}

function parseQuestionSection(input: {
  libraryId: string
  sourcePath: string
  rawId: string
  title: string
  body: string
  answer?: string
  explanation?: string
}): ParseQuestionResult {
  const now = Date.now()
  const diagnostics: DiagnosticIssue[] = []
  const bodyWithTitle = [input.title, input.body].filter(Boolean).join('\n\n')
  const extractedOptions = extractOptions(bodyWithTitle)
  const booleanOptionMeta = buildBooleanOptionMeta(extractedOptions)
  const rawAnswers = normalizeAnswer(input.answer)
  const type = inferQuestionType(undefined, rawAnswers, booleanOptionMeta)
  const answers = type === 'boolean' ? normalizeBooleanAnswers(rawAnswers, booleanOptionMeta) : rawAnswers
  const options =
    type === 'boolean'
      ? (booleanOptionMeta?.options ?? createDefaultBooleanOptions())
      : extractedOptions

  if (answers.length === 0) {
    diagnostics.push(
      createDiagnosticIssue({
        libraryId: input.libraryId,
        questionId: input.rawId,
        type: 'missing-answer',
        message: `\u9898\u76ee ${input.rawId} \u7f3a\u5c11\u53ef\u5224\u5206\u7b54\u6848\u3002`,
      }),
    )
  }

  const optionKeys = new Set(options.map((option) => option.key.toUpperCase()))

  if (answers.length > 0 && type !== 'boolean' && options.length === 0) {
    diagnostics.push(
      createDiagnosticIssue({
        libraryId: input.libraryId,
        questionId: input.rawId,
        type: 'option-answer-mismatch',
        message: `\u9898\u76ee ${input.rawId} \u5df2\u58f0\u660e\u7b54\u6848\uff0c\u4f46\u672a\u63d0\u53d6\u5230\u9009\u9879\u3002`,
      }),
    )
  }

  if (answers.length > 0 && options.length > 0 && !answerMatchesOptions(type, answers, optionKeys)) {
    diagnostics.push(
      createDiagnosticIssue({
        libraryId: input.libraryId,
        questionId: input.rawId,
        type: 'option-answer-mismatch',
        message: `\u9898\u76ee ${input.rawId} \u7684\u7b54\u6848\u4e0e\u63d0\u53d6\u5230\u7684\u9009\u9879\u4e0d\u5339\u914d\u3002`,
      }),
    )
  }

  const cleanedBody = stripOptionsFromBody(bodyWithTitle)
  const displayBody = stripLeadingTitle(cleanedBody, input.title)

  const question: Question = {
    id: input.rawId,
    libraryId: input.libraryId,
    sourcePath: input.sourcePath,
    title: input.title || `Question ${input.rawId}`,
    type,
    body: displayBody,
    options,
    answer: answers,
    explanation: input.explanation ?? '',
    tags: [],
    difficulty: 3,
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

export function parseMarkdownQuestionCollection(input: ParseQuestionInput): ParseQuestionResult[] {
  if (input.content.trimStart().startsWith('---')) {
    return []
  }

  const sections = splitQuestionSections(input.content)

  if (sections.length === 0) {
    return []
  }

  const hasInlineAnswer = sections.some((section) => section.lines.some((line) => ANSWER_LINE_PATTERN.test(line)))

  if (!hasInlineAnswer) {
    return []
  }

  return sections.map((section, index) => {
    const content = extractSectionContent(section.lines)
    const rawId = section.rawId || String(index + 1)

    return parseQuestionSection({
      libraryId: input.libraryId,
      sourcePath: `${input.sourcePath}#${rawId}`,
      rawId,
      title: section.title,
      body: content.body,
      answer: content.answer,
      explanation: content.explanation,
    })
  })
}
