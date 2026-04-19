import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'

const projectRoot = process.cwd()
const libraryRoot = path.join(projectRoot, 'libraries', 'builtin')
const questionsRoot = path.join(libraryRoot, 'questions')
const outputRoot = path.join(projectRoot, 'public', 'builtin-library')

const LETTER_OPTION_PATTERN = /^\s*(?:[-*+]|\d+\.)?\s*([A-Z])(?:[.)]|[:\uFF1A])\s*(.+)$/
const NUMBER_OPTION_PATTERN = /^\s*(\d+)[.)]\s*(.+)$/

async function main() {
  const files = await collectMarkdownFiles(questionsRoot)
  const buildStartedAt = Date.now()
  const diagnostics = []
  const questions = []

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8')
    const relativePath = toPosix(path.relative(libraryRoot, filePath))
    const parsed = parseQuestion(relativePath, content, diagnostics)
    questions.push(parsed)
  }

  const manifest = {
    id: 'builtin-default',
    name: 'Builtin Library',
    sourceType: 'builtin',
    version: new Date(buildStartedAt).toISOString(),
    questionIds: questions.map((question) => question.id),
    questionCount: questions.length,
    scorableCount: questions.filter((question) => question.scorable).length,
    createdAt: buildStartedAt,
    updatedAt: buildStartedAt,
    meta: {
      diagnosticsCount: diagnostics.length,
    },
  }

  await fs.mkdir(outputRoot, { recursive: true })
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  await fs.writeFile(path.join(outputRoot, 'questions.json'), JSON.stringify(questions, null, 2), 'utf8')
  await fs.writeFile(path.join(outputRoot, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2), 'utf8')

  console.log(`Built builtin library: ${questions.length} questions, ${diagnostics.length} diagnostics.`)
}

async function collectMarkdownFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name)

    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(fullPath)
      files.push(...nested)
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function parseQuestion(relativePath, content, diagnostics) {
  const parsed = matter(content)
  const data = parsed.data ?? {}
  const body = parsed.content.trim()
  const questionId = normalizeString(data.id) ?? createFallbackId(relativePath)
  const rawAnswers = normalizeAnswer(data.answer)
  const extractedOptions = extractOptions(body)
  const booleanOptionMeta = buildBooleanOptionMeta(extractedOptions)
  const type = inferQuestionType(normalizeString(data.type), rawAnswers, booleanOptionMeta)
  const answers = type === 'boolean' ? normalizeBooleanAnswers(rawAnswers, booleanOptionMeta) : rawAnswers
  const options =
    type === 'boolean'
      ? (booleanOptionMeta?.options ?? createBooleanOptions())
      : extractedOptions

  if (!normalizeString(data.id)) {
    diagnostics.push(createDiagnostic(questionId, 'missing-id', `Generated fallback id for ${relativePath}.`))
  }

  if (answers.length === 0) {
    diagnostics.push(createDiagnostic(questionId, 'missing-answer', `Question ${questionId} has no scorable answer.`))
  }

  const optionKeys = new Set(options.map((option) => option.key.toUpperCase()))

  if (answers.length > 0 && type !== 'boolean' && options.length === 0) {
    diagnostics.push(
      createDiagnostic(
        questionId,
        'option-answer-mismatch',
        `Question ${questionId} has a declared answer but no options were extracted.`,
      ),
    )
  }

  if (answers.length > 0 && options.length > 0 && !answerMatchesOptions(type, answers, optionKeys)) {
    diagnostics.push(
      createDiagnostic(
        questionId,
        'option-answer-mismatch',
        `Question ${questionId} has answers that do not match extracted options.`,
      ),
    )
  }

  const cleanBody = stripOptionsFromBody(body)
  const title = normalizeString(data.title) ?? createTitle(cleanBody, questionId)
  const displayBody = stripDuplicateLeadingHeading(cleanBody, title)
  const timestamp = Date.now()

  return {
    id: questionId,
    libraryId: 'builtin-default',
    sourcePath: relativePath,
    title,
    type,
    body: displayBody,
    options,
    answer: answers,
    explanation: normalizeString(data.explanation) ?? '',
    tags: normalizeTags(data.tags),
    difficulty: normalizeDifficulty(data.difficulty) ?? 3,
    scorable: answers.length > 0 && (type === 'boolean' || options.length > 0),
    assets: [],
    diagnostics: diagnostics.filter((item) => item.questionId === questionId).map((item) => item.id),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
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

function normalizeDifficulty(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function normalizeBooleanValue(value) {
  const normalized = value.trim().toLowerCase()

  if (['true', 't', '对', '正确', '是', 'y', 'yes'].includes(normalized)) {
    return 'TRUE'
  }

  if (['false', 'f', '错', '错误', '否', 'n', 'no'].includes(normalized)) {
    return 'FALSE'
  }

  return undefined
}

function normalizeAnswer(value) {
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

function extractOptions(body) {
  const lines = body.split(/\r?\n/)
  const options = []

  for (const line of lines) {
    const letterMatch = line.match(LETTER_OPTION_PATTERN)

    if (letterMatch) {
      options.push({
        key: letterMatch[1].toUpperCase(),
        label: letterMatch[2].trim(),
      })
      continue
    }

    const numberMatch = line.match(NUMBER_OPTION_PATTERN)

    if (numberMatch) {
      options.push({
        key: numberMatch[1],
        label: numberMatch[2].trim(),
      })
    }
  }

  const seen = new Set()
  return options.filter((option) => {
    if (seen.has(option.key)) {
      return false
    }

    seen.add(option.key)
    return true
  })
}

function stripOptionsFromBody(body) {
  return body
    .split(/\r?\n/)
    .filter((line) => !LETTER_OPTION_PATTERN.test(line) && !NUMBER_OPTION_PATTERN.test(line))
    .join('\n')
    .trim()
}

function createFallbackId(relativePath) {
  return relativePath
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
}

function createTitle(body, fallbackId) {
  const firstContentLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstContentLine) {
    return `Untitled-${fallbackId}`
  }

  return firstContentLine.replace(/^#+\s*/, '')
}

function stripDuplicateLeadingHeading(body, title) {
  const trimmedTitle = title.trim()
  const trimmedBody = body.trim()

  if (!trimmedTitle || !trimmedBody) {
    return trimmedBody
  }

  const lines = trimmedBody.split(/\r?\n/)
  const firstLine = (lines[0] ?? '').trim().replace(/^#\s+/, '')

  if (firstLine === trimmedTitle) {
    return lines.slice(1).join('\n').trim()
  }

  return trimmedBody
}

function createBooleanOptions() {
  return [
    { key: 'TRUE', label: '正确' },
    { key: 'FALSE', label: '错误' },
  ]
}

function buildBooleanOptionMeta(extractedOptions) {
  if (extractedOptions.length === 0) {
    return undefined
  }

  const aliases = new Map()
  let trueLabel
  let falseLabel

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

function inferQuestionType(frontmatterType, answers, booleanOptionMeta) {
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

function normalizeBooleanAnswers(answers, booleanOptionMeta) {
  const normalized = new Set()

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

function answerMatchesOptions(type, answers, optionKeys) {
  if (type === 'boolean') {
    return answers.every((answer) => answer === 'TRUE' || answer === 'FALSE')
  }

  return answers.every((answer) => optionKeys.has(answer))
}

function createDiagnostic(questionId, type, message) {
  return {
    id: `${questionId}-${type}`,
    libraryId: 'builtin-default',
    questionId,
    type,
    severity: type === 'asset-missing' ? 'warning' : 'error',
    message,
    createdAt: Date.now(),
  }
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
