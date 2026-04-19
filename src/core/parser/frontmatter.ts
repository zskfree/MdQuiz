type FrontmatterShape = {
  id?: unknown
  title?: unknown
  type?: unknown
  tags?: unknown
  difficulty?: unknown
  answer?: unknown
  explanation?: unknown
}

export type ParsedFrontmatter = {
  id?: string
  title?: string
  type?: string
  tags: string[]
  difficulty?: number
  answer?: unknown
  explanation?: string
}

export type ParsedMarkdownFile = {
  body: string
  frontmatter: ParsedFrontmatter
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeDifficulty(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  if (trimmed === 'true') {
    return true
  }

  if (trimmed === 'false') {
    return false
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : trimmed
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.replace(/^['"]|['"]$/g, ''))
  }

  return trimmed
}

function parseSimpleYaml(input: string): FrontmatterShape {
  const result: FrontmatterShape = {}

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf(':')

    if (separatorIndex < 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim() as keyof FrontmatterShape
    const rawValue = line.slice(separatorIndex + 1)

    result[key] = parseScalar(rawValue)
  }

  return result
}

function extractFrontmatter(content: string): { data: FrontmatterShape; body: string } {
  if (!content.startsWith('---')) {
    return {
      data: {},
      body: content,
    }
  }

  const lines = content.split(/\r?\n/)

  if (lines[0].trim() !== '---') {
    return {
      data: {},
      body: content,
    }
  }

  let closingIndex = -1

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      closingIndex = index
      break
    }
  }

  if (closingIndex === -1) {
    return {
      data: {},
      body: content,
    }
  }

  const yamlBlock = lines.slice(1, closingIndex).join('\n')
  const body = lines.slice(closingIndex + 1).join('\n')

  return {
    data: parseSimpleYaml(yamlBlock),
    body,
  }
}

export function parseMarkdownWithFrontmatter(content: string): ParsedMarkdownFile {
  const parsed = extractFrontmatter(content)
  const data = parsed.data

  return {
    body: parsed.body.trim(),
    frontmatter: {
      id: normalizeString(data.id),
      title: normalizeString(data.title),
      type: normalizeString(data.type),
      tags: normalizeTags(data.tags),
      difficulty: normalizeDifficulty(data.difficulty),
      answer: data.answer,
      explanation: normalizeString(data.explanation),
    },
  }
}
