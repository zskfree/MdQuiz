import { describe, expect, it } from 'vitest'
import { importMarkdownFiles } from './import-markdown'

type MockFileInput = {
  name: string
  content: string
  size?: number
  lastModified?: number
}

function createMockFile(input: MockFileInput): File {
  return {
    name: input.name,
    size: input.size ?? input.content.length,
    lastModified: input.lastModified ?? 1_700_000_000_000,
    text: async () => input.content,
  } as File
}

describe('importMarkdownFiles', () => {
  it('imports markdown files into a namespaced library bundle', async () => {
    const bundle = await importMarkdownFiles([
      createMockFile({
        name: 'a.md',
        content: `---
id: same
answer: A
---

# First

- A. Alpha
- B. Beta
`,
      }),
      createMockFile({
        name: 'b.md',
        content: `---
id: same
answer: true
---

# Second
`,
      }),
    ])

    expect(bundle.manifest.sourceType).toBe('imported')
    expect(bundle.questions).toHaveLength(2)
    expect(bundle.questions[0].id).toMatch(/^imported-/)
    expect(bundle.questions[1].id).toContain('--dup-2')
    expect(bundle.diagnostics.some((item) => item.type === 'duplicate-id')).toBe(true)
  })

  it('imports question-bank markdown files that contain multiple numbered questions', async () => {
    const answerLabel = '\u7b54\u6848'
    const explanationLabel = '\u89e3\u6790'
    const correctLabel = '\u6b63\u786e'
    const incorrectLabel = '\u9519\u8bef'

    const bundle = await importMarkdownFiles([
      createMockFile({
        name: 'question-bank.md',
        content: `# Sample question bank

## 1、Which option applies?

- A. Alpha
- B. Beta
- ${answerLabel}：B

## 2、Select every valid option

Additional context paragraph.

- A. First
- B. Second
- C. Third
- ${answerLabel}：AC
- ${explanationLabel}：Choose the first and third options.

## 3、Judge the statement

- A. ${correctLabel}
- B. ${incorrectLabel}
- ${answerLabel}：A
`,
      }),
    ])

    expect(bundle.questions).toHaveLength(3)
    expect(bundle.manifest.questionCount).toBe(3)
    expect(bundle.questions[0].title).toBe('Which option applies?')
    expect(bundle.questions[0].answer).toEqual(['B'])
    expect(bundle.questions[1].type).toBe('multiple')
    expect(bundle.questions[1].answer).toEqual(['A', 'C'])
    expect(bundle.questions[1].body).toBe('Additional context paragraph.')
    expect(bundle.questions[1].explanation).toBe('Choose the first and third options.')
    expect(bundle.questions[2].type).toBe('boolean')
    expect(bundle.questions[2].answer).toEqual(['TRUE'])
    expect(bundle.questions[2].options).toEqual([
      { key: 'TRUE', label: correctLabel },
      { key: 'FALSE', label: incorrectLabel },
    ])
  })

  it('rejects empty selections', async () => {
    await expect(importMarkdownFiles([])).rejects.toThrow()
  })
})
