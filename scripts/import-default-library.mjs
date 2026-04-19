import fs from 'node:fs/promises'
import path from 'node:path'

const SOURCE_DIR = String.raw`E:\文档\SZU_zsk\待办\Electricity Trader Examination\source-materials`
const PROJECT_ROOT = process.cwd()
const TARGET_DIR = path.join(PROJECT_ROOT, 'libraries', 'builtin', 'questions')
const TARGET_PREFIX = 'trader-2025-10'

function splitSections(markdown) {
  return markdown.split(/^##\s+/m).slice(1)
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n')
}

function normalizeTypography(text) {
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\s*,\s*/g, '，')
    .replace(/\(\s*\)/g, '（）')
    .replace(/\s*（\s*）\s*/g, '（）')
    .replace(/\s*：\s*/g, '：')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function cleanText(text) {
  return normalizeTypography(text)
}

function extractAnswerLine(lines) {
  const bulletLines = lines.filter((line) => /^-\s+/.test(line))
  const optionPattern = /^-\s+[A-Z][.)]\s+/
  return [...bulletLines].reverse().find((line) => !optionPattern.test(line))
}

function parseAnswer(answerLine) {
  if (!answerLine) {
    return null
  }

  const payload = answerLine.replace(/^-\s*/, '')
  const answer = payload.split(/[:\uFF1A]/).pop()?.trim() ?? ''

  if (!answer) {
    return null
  }

  const normalizedBoolean = answer.trim().toLowerCase()

  if (['正确', '对', 'true', 't', '是', '√'].includes(normalizedBoolean)) {
    return 'true'
  }

  if (['错误', '错', 'false', 'f', '否', '×'].includes(normalizedBoolean)) {
    return 'false'
  }

  if (/^[A-Z]{2,}$/.test(answer)) {
    return answer.split('')
  }

  if (/[A-Z][,\s]+[A-Z]/.test(answer)) {
    return answer
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return answer
}

function inferType(answer) {
  if (Array.isArray(answer)) {
    return 'multiple'
  }

  if (!answer) {
    return undefined
  }

  if (/^(true|false)$/i.test(answer)) {
    return 'boolean'
  }

  return 'single'
}

function escapeYamlString(text) {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function buildFileName(index) {
  return `${TARGET_PREFIX}-${String(index).padStart(3, '0')}.md`
}

function buildQuestionDocument(question) {
  const frontmatterLines = [
    '---',
    `id: ${question.id}`,
    `title: ${escapeYamlString(question.title)}`,
  ]

  if (question.type) {
    frontmatterLines.push(`type: ${question.type}`)
  }

  frontmatterLines.push('tags: [Electricity Trader, Mid-Level, 2025-10]')
  frontmatterLines.push('difficulty: 3')

  if (Array.isArray(question.answer)) {
    frontmatterLines.push(`answer: [${question.answer.join(', ')}]`)
  } else if (question.answer) {
    frontmatterLines.push(`answer: ${question.answer}`)
  }

  frontmatterLines.push(`explanation: ${escapeYamlString('Imported from source Markdown question bank.')}`)
  frontmatterLines.push('---', '')
  frontmatterLines.push(`# ${question.title}`, '')
  frontmatterLines.push(question.body.trim(), '')

  return frontmatterLines.join('\n')
}

function parseQuestionSection(section, index) {
  const normalized = normalizeLineEndings(section)
  const lines = normalized.split('\n').map((line) => line.trimEnd())
  const firstLine = cleanText(lines[0] ?? '')
  const bodyLines = lines.slice(1)
  const answerLine = extractAnswerLine(bodyLines)
  const answer = parseAnswer(answerLine)
  const optionPattern = /^-\s+[A-Z][.)]\s+/

  const contentLines = bodyLines.filter((line) => line !== answerLine)
  const body = contentLines
    .map((line) => cleanText(line))
    .filter(Boolean)
    .map((line) => {
      if (optionPattern.test(line)) {
        return line.replace(/^-\s+([A-Z])[.)]\s+/, '- $1. ')
      }
      return line
    })
    .join('\n')

  return {
    id: `${TARGET_PREFIX}-${String(index).padStart(3, '0')}`,
    title: firstLine,
    body,
    answer,
    type: inferType(answer),
  }
}

async function resolveSourceFile() {
  const explicitSource = process.argv[2]

  if (explicitSource) {
    return explicitSource
  }

  const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true })
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort()

  if (markdownFiles.length === 0) {
    throw new Error(`No markdown source file found in ${SOURCE_DIR}`)
  }

  return path.join(SOURCE_DIR, markdownFiles[0])
}

async function removePreviousGeneratedFiles() {
  const entries = await fs.readdir(TARGET_DIR, { withFileTypes: true })
  const removals = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => fs.unlink(path.join(TARGET_DIR, entry.name)))

  await Promise.all(removals)
}

async function main() {
  const sourceFile = await resolveSourceFile()
  const raw = await fs.readFile(sourceFile, 'utf8')
  const sections = splitSections(raw)
  const questions = sections.map((section, index) => parseQuestionSection(section, index + 1))

  await fs.mkdir(TARGET_DIR, { recursive: true })
  await removePreviousGeneratedFiles()

  await Promise.all(
    questions.map((question, index) =>
      fs.writeFile(
        path.join(TARGET_DIR, buildFileName(index + 1)),
        buildQuestionDocument(question),
        'utf8',
      ),
    ),
  )

  console.log(`Imported ${questions.length} questions into builtin library from ${sourceFile}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
