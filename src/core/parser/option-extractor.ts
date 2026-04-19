import type { QuestionOption } from '../../types'

const LETTER_OPTION_PATTERN = /^\s*(?:[-*+]|\d+\.)?\s*([A-Z])(?:[.)]|[:\uFF1A])\s*(.+)$/
const NUMBER_OPTION_PATTERN = /^\s*(\d+)[.)]\s*(.+)$/

function normalizeLabel(label: string): string {
  return label.trim()
}

export function extractOptions(body: string): QuestionOption[] {
  const lines = body.split(/\r?\n/)
  const options: QuestionOption[] = []

  for (const line of lines) {
    const letterMatch = line.match(LETTER_OPTION_PATTERN)

    if (letterMatch) {
      options.push({
        key: letterMatch[1].toUpperCase(),
        label: normalizeLabel(letterMatch[2]),
      })
      continue
    }

    const numberMatch = line.match(NUMBER_OPTION_PATTERN)

    if (numberMatch) {
      options.push({
        key: numberMatch[1],
        label: normalizeLabel(numberMatch[2]),
      })
    }
  }

  return dedupeOptions(options)
}

function dedupeOptions(options: QuestionOption[]): QuestionOption[] {
  const seen = new Set<string>()

  return options.filter((option) => {
    if (seen.has(option.key)) {
      return false
    }

    seen.add(option.key)
    return true
  })
}

export function stripOptionsFromBody(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => !LETTER_OPTION_PATTERN.test(line) && !NUMBER_OPTION_PATTERN.test(line))
    .join('\n')
    .trim()
}
