import type { LibraryManifest, Question, QuestionOption } from '../../types'

type RenderedOption = {
  answerKey: string
  line: string
}

const BOOLEAN_TRUE_ALIASES = new Set(['TRUE', 'T', '正确', '对', '是', 'Y', 'YES', '√'])
const BOOLEAN_FALSE_ALIASES = new Set(['FALSE', 'F', '错误', '错', '否', 'N', 'NO', '×'])

function sanitizeFilenameSegment(value: string): string {
  const normalized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
  const collapsed = normalized.replace(/\s+/g, ' ').replace(/-+/g, '-').trim()
  return collapsed.length > 0 ? collapsed : 'library'
}

function normalizeBooleanValue(value: string): 'TRUE' | 'FALSE' | undefined {
  const normalized = value.trim().toUpperCase()

  if (BOOLEAN_TRUE_ALIASES.has(normalized)) {
    return 'TRUE'
  }

  if (BOOLEAN_FALSE_ALIASES.has(normalized)) {
    return 'FALSE'
  }

  return undefined
}

function resolveBooleanLabels(options: QuestionOption[]): { trueLabel: string; falseLabel: string } {
  let trueLabel = '正确'
  let falseLabel = '错误'

  for (const option of options) {
    const semantic = normalizeBooleanValue(option.label) ?? normalizeBooleanValue(option.key)

    if (semantic === 'TRUE') {
      trueLabel = option.label
    }

    if (semantic === 'FALSE') {
      falseLabel = option.label
    }
  }

  return { trueLabel, falseLabel }
}

function createFallbackLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26))
}

function renderStandardOptions(question: Question): { rendered: RenderedOption[]; answerMap: Map<string, string> } {
  const rendered: RenderedOption[] = []
  const answerMap = new Map<string, string>()

  question.options.forEach((option, index) => {
    const key = option.key.trim().toUpperCase()

    if (/^[A-Z]$/.test(key)) {
      rendered.push({
        answerKey: key,
        line: `- ${key}. ${option.label}`,
      })
      answerMap.set(key, key)
      return
    }

    if (/^\d+$/.test(key)) {
      rendered.push({
        answerKey: key,
        line: `${key}. ${option.label}`,
      })
      answerMap.set(key, key)
      return
    }

    const fallbackKey = createFallbackLetter(index)
    rendered.push({
      answerKey: fallbackKey,
      line: `- ${fallbackKey}. ${option.label}`,
    })
    answerMap.set(option.key.toUpperCase(), fallbackKey)
  })

  return { rendered, answerMap }
}

function renderBooleanQuestion(question: Question): { optionLines: string[]; answerValue: string } {
  const { trueLabel, falseLabel } = resolveBooleanLabels(question.options)
  const normalizedAnswer = normalizeBooleanValue(question.answer[0] ?? '')

  return {
    optionLines: [`- A. ${trueLabel}`, `- B. ${falseLabel}`],
    answerValue: normalizedAnswer === 'FALSE' ? 'B' : 'A',
  }
}

function formatAnswerValue(answerKeys: string[]): string {
  if (answerKeys.length === 0) {
    return ''
  }

  if (answerKeys.every((item) => /^[A-Z]$/.test(item))) {
    return answerKeys.join('')
  }

  return answerKeys.join(',')
}

function renderQuestionSection(question: Question, index: number): string {
  const lines = [`## ${index + 1}、${question.title}`]

  if (question.body.trim()) {
    lines.push('', question.body.trim())
  }

  if (question.type === 'boolean') {
    const { optionLines, answerValue } = renderBooleanQuestion(question)
    lines.push('', ...optionLines, `- 答案：${answerValue}`)
  } else {
    const { rendered, answerMap } = renderStandardOptions(question)
    const answerKeys = question.answer.map((item) => answerMap.get(item.toUpperCase()) ?? item.toUpperCase())

    if (rendered.length > 0) {
      lines.push('', ...rendered.map((item) => item.line))
    }

    lines.push(`- 答案：${formatAnswerValue(answerKeys)}`)
  }

  if (question.explanation.trim()) {
    const explanationLines = question.explanation.trim().split(/\r?\n/)
    lines.push(`- 解析：${explanationLines[0]}`)

    if (explanationLines.length > 1) {
      lines.push(...explanationLines.slice(1))
    }
  }

  return lines.join('\n')
}

export function createLibraryMarkdown(input: { library: LibraryManifest; questions: Question[] }): string {
  const sections = input.questions.map((question, index) => renderQuestionSection(question, index))
  return [`# ${input.library.name}`, '', ...sections].join('\n\n').trimEnd() + '\n'
}

export function createLibraryMarkdownFilename(libraryName: string): string {
  return `${sanitizeFilenameSegment(libraryName)}.md`
}
