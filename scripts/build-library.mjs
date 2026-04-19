import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const sourceRoot = path.join(projectRoot, 'source-materials')
const outputRoot = path.join(projectRoot, 'public', 'builtin-library')

const LEGACY_DEFAULT_LIBRARY_NAME = '中级电力交易员笔试题库'
const LEGACY_DEFAULT_LIBRARY_ID = 'builtin-default'
const LEGACY_DEFAULT_QUESTION_PREFIX = 'trader-2025-10'

const QUESTION_HEADING_PATTERN = /^##\s*(\d+)\s*[、.．]?\s*(.+?)\s*$/
const ANSWER_LINE_PATTERN = /^\s*(?:[-*+]\s*)?答案[：:]\s*(.+?)\s*$/
const EXPLANATION_LINE_PATTERN = /^\s*(?:[-*+]\s*)?(?:解析|解释)[：:]\s*(.*)\s*$/
const LETTER_OPTION_PATTERN = /^\s*(?:[-*+]|\d+\.)?\s*([A-Z])(?:[.)]|[:：])\s*(.+)$/
const NUMBER_OPTION_PATTERN = /^\s*(\d+)[.)]\s*(.+)$/

let diagnosticCounter = 0

async function main() {
  const buildTimestamp = Date.now()
  const files = await collectMarkdownFiles(sourceRoot)
  const manifests = []
  const questions = []
  const diagnostics = []

  for (const filePath of files) {
    const bundle = await parseLibraryFile(filePath, buildTimestamp)
    manifests.push(bundle.manifest)
    questions.push(...bundle.questions)
    diagnostics.push(...bundle.diagnostics)
  }

  await fs.rm(outputRoot, { recursive: true, force: true })
  await fs.mkdir(outputRoot, { recursive: true })
  await fs.writeFile(path.join(outputRoot, 'libraries.json'), JSON.stringify(manifests, null, 2), 'utf8')
  await fs.writeFile(path.join(outputRoot, 'questions.json'), JSON.stringify(questions, null, 2), 'utf8')
  await fs.writeFile(path.join(outputRoot, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2), 'utf8')

  console.log(`内置题库构建完成：${manifests.length} 个题库，${questions.length} 道题，${diagnostics.length} 条诊断。`)
}

async function collectMarkdownFiles(rootDir) {
  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name)

      if (entry.isDirectory()) {
        const nested = await collectMarkdownFiles(fullPath)
        files.push(...nested)
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(fullPath)
      }
    }

    return files.sort((left, right) => left.localeCompare(right, 'zh-CN'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function parseLibraryFile(filePath, buildTimestamp) {
  const content = await fs.readFile(filePath, 'utf8')
  const libraryName = path.parse(filePath).name.trim() || '未命名题库'
  const libraryId = buildLibraryId(libraryName)
  const relativeSourcePath = toPosix(path.relative(projectRoot, filePath))
  const sections = splitQuestionSections(content)

  if (sections.length === 0) {
    throw new Error(`未能从 ${relativeSourcePath} 解析题库题目，请确认每道题都以 ## 题号开头。`)
  }

  if (!sections.some((section) => section.lines.some((line) => ANSWER_LINE_PATTERN.test(line)))) {
    throw new Error(`未能从 ${relativeSourcePath} 提取答案行，请确认题库中包含“答案：”字段。`)
  }

  const parsedEntries = sections.map((section, index) => {
    const extracted = extractSectionContent(section.lines)
    const rawId = section.rawId || String(index + 1)

    return parseQuestionSection({
      libraryId,
      sourcePath: `${relativeSourcePath}#${rawId}`,
      rawId,
      title: section.title,
      body: extracted.body,
      answer: extracted.answer,
      explanation: extracted.explanation,
      timestamp: buildTimestamp,
    })
  })

  const duplicateCounter = new Map()
  const questions = []
  const diagnostics = []

  for (const entry of parsedEntries) {
    const seenCount = (duplicateCounter.get(entry.rawId) ?? 0) + 1
    duplicateCounter.set(entry.rawId, seenCount)

    const questionId = createQuestionId(libraryId, entry.rawId, seenCount)
    const diagnosticInputs = [...entry.diagnostics]

    if (seenCount > 1) {
      diagnosticInputs.push({
        type: 'duplicate-id',
        message: `检测到重复题目编号 ${entry.rawId}，系统已自动生成新编号 ${questionId}。`,
      })
    }

    const resolvedDiagnostics = diagnosticInputs.map((diagnostic) =>
      createDiagnosticIssue({
        libraryId,
        questionId,
        type: diagnostic.type,
        message: diagnostic.message,
        timestamp: buildTimestamp,
      }),
    )

    questions.push({
      ...entry.question,
      id: questionId,
      libraryId,
      diagnostics: resolvedDiagnostics.map((item) => item.id),
      createdAt: buildTimestamp,
      updatedAt: buildTimestamp,
    })
    diagnostics.push(...resolvedDiagnostics)
  }

  return {
    manifest: {
      id: libraryId,
      name: libraryName,
      version: new Date(buildTimestamp).toISOString(),
      sourceType: 'builtin',
      questionIds: questions.map((question) => question.id),
      createdAt: buildTimestamp,
      updatedAt: buildTimestamp,
      questionCount: questions.length,
      scorableCount: questions.filter((question) => question.scorable).length,
      meta: {
        sourcePath: relativeSourcePath,
        diagnosticsCount: diagnostics.length,
      },
    },
    questions,
    diagnostics,
  }
}

function buildLibraryId(libraryName) {
  if (libraryName === LEGACY_DEFAULT_LIBRARY_NAME) {
    return LEGACY_DEFAULT_LIBRARY_ID
  }

  const slug = libraryName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug ? `builtin-${slug}` : `builtin-${createStableHash(libraryName)}`
}

function createStableHash(input) {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }

  return hash.toString(36)
}

function splitQuestionSections(content) {
  const sections = []
  let current

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

function extractSectionContent(lines) {
  const bodyLines = []
  const explanationLines = []
  let answer
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

function parseQuestionSection(input) {
  const diagnostics = []
  const bodyWithTitle = [input.title, input.body].filter(Boolean).join('\n\n')
  const extractedOptions = extractOptions(bodyWithTitle)
  const booleanOptionMeta = buildBooleanOptionMeta(extractedOptions)
  const rawAnswers = normalizeAnswer(input.answer)
  const type = inferQuestionType(rawAnswers, booleanOptionMeta)
  const answers = type === 'boolean' ? normalizeBooleanAnswers(rawAnswers, booleanOptionMeta) : rawAnswers
  const options =
    type === 'boolean'
      ? (booleanOptionMeta?.options ?? createDefaultBooleanOptions())
      : extractedOptions

  if (answers.length === 0) {
    diagnostics.push({
      type: 'missing-answer',
      message: `题目 ${input.rawId} 缺少可判分答案。`,
    })
  }

  const optionKeys = new Set(options.map((option) => option.key.toUpperCase()))

  if (answers.length > 0 && type !== 'boolean' && options.length === 0) {
    diagnostics.push({
      type: 'option-answer-mismatch',
      message: `题目 ${input.rawId} 已声明答案，但未提取到选项。`,
    })
  }

  if (answers.length > 0 && options.length > 0 && !answerMatchesOptions(type, answers, optionKeys)) {
    diagnostics.push({
      type: 'option-answer-mismatch',
      message: `题目 ${input.rawId} 的答案与提取到的选项不匹配。`,
    })
  }

  const cleanedBody = stripOptionsFromBody(bodyWithTitle)
  const displayBody = stripLeadingTitle(cleanedBody, input.title)

  return {
    rawId: input.rawId,
    question: {
      id: input.rawId,
      libraryId: input.libraryId,
      sourcePath: input.sourcePath,
      title: input.title || `题目 ${input.rawId}`,
      type,
      body: displayBody,
      options,
      answer: answers,
      explanation: input.explanation ?? '',
      tags: [],
      difficulty: 3,
      scorable: answers.length > 0 && (type === 'boolean' || options.length > 0),
      assets: [],
      diagnostics: [],
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    },
    diagnostics,
  }
}

function extractOptions(body) {
  const options = []

  for (const line of body.split(/\r?\n/)) {
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

function stripLeadingTitle(body, title) {
  const trimmedBody = body.trim()
  const trimmedTitle = title.trim()

  if (!trimmedBody || !trimmedTitle) {
    return trimmedBody
  }

  const lines = trimmedBody.split(/\r?\n/)

  if (lines[0]?.trim() === trimmedTitle) {
    return lines.slice(1).join('\n').trim()
  }

  return trimmedBody
}

function normalizeAnswer(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeAnswer(item))
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

function normalizeBooleanValue(value) {
  const normalized = value.trim().toLowerCase()

  if (['true', 't', '正确', '对', '是', 'y', 'yes', '√'].includes(normalized)) {
    return 'TRUE'
  }

  if (['false', 'f', '错误', '错', '否', 'n', 'no', '×'].includes(normalized)) {
    return 'FALSE'
  }

  return undefined
}

function createDefaultBooleanOptions() {
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

function inferQuestionType(answers, booleanOptionMeta) {
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

function createQuestionId(libraryId, rawId, duplicateIndex) {
  if (libraryId === LEGACY_DEFAULT_LIBRARY_ID && /^\d+$/.test(rawId)) {
    const baseId = `${LEGACY_DEFAULT_QUESTION_PREFIX}-${rawId.padStart(3, '0')}`
    return duplicateIndex <= 1 ? baseId : `${baseId}--dup-${duplicateIndex}`
  }

  return duplicateIndex <= 1 ? `${libraryId}::${rawId}` : `${libraryId}::${rawId}--dup-${duplicateIndex}`
}

function createDiagnosticIssue(input) {
  diagnosticCounter += 1

  return {
    id: `${input.libraryId}-diag-${diagnosticCounter}`,
    libraryId: input.libraryId,
    questionId: input.questionId,
    type: input.type,
    severity: input.type === 'asset-missing' ? 'warning' : 'error',
    message: input.message,
    createdAt: input.timestamp,
  }
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
