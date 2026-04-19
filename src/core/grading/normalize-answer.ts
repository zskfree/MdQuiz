function normalizeBooleanToken(value: string): string | undefined {
  const normalized = value.trim().toLowerCase()

  if (['true', 't', '对', '正确', '是', 'y', 'yes', '√'].includes(normalized)) {
    return 'TRUE'
  }

  if (['false', 'f', '错', '错误', '否', 'n', 'no', '×'].includes(normalized)) {
    return 'FALSE'
  }

  return undefined
}

export function normalizeAnswerToken(value: string): string {
  const booleanToken = normalizeBooleanToken(value)

  if (booleanToken) {
    return booleanToken
  }

  return value.trim().toUpperCase()
}

export function normalizeAnswerList(values: string[]): string[] {
  const unique = new Set<string>()

  for (const value of values) {
    const trimmed = value.trim()

    if (!trimmed) {
      continue
    }

    unique.add(normalizeAnswerToken(trimmed))
  }

  return Array.from(unique)
}
