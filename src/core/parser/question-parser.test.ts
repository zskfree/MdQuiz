import { describe, expect, it } from 'vitest'
import { parseMarkdownWithFrontmatter } from './frontmatter'
import { parseMarkdownQuestion } from './question-parser'

describe('frontmatter parser', () => {
  it('parses simple yaml frontmatter fields', () => {
    const result = parseMarkdownWithFrontmatter(`---
id: js-001
tags: [JavaScript, 基础]
difficulty: 2
answer: B
---

# Title
`)

    expect(result.frontmatter.id).toBe('js-001')
    expect(result.frontmatter.tags).toEqual(['JavaScript', '基础'])
    expect(result.frontmatter.difficulty).toBe(2)
    expect(result.frontmatter.answer).toBe('B')
  })
})

describe('question parser', () => {
  it('parses single choice question and strips options from body', () => {
    const result = parseMarkdownQuestion({
      libraryId: 'builtin-default',
      sourcePath: 'js-001.md',
      content: `---
id: js-001
type: single
answer: B
explanation: because
---

# Which statement is true?

- A. let is always hoisted safely
- B. var hoists declaration
`,
    })

    expect(result.question.id).toBe('js-001')
    expect(result.question.type).toBe('single')
    expect(result.question.options).toHaveLength(2)
    expect(result.question.body).toBe('')
    expect(result.question.body).not.toContain('A.')
    expect(result.question.answer).toEqual(['B'])
    expect(result.diagnostics).toHaveLength(0)
  })

  it('extracts options when labels have no space after the separator', () => {
    const result = parseMarkdownQuestion({
      libraryId: 'builtin-default',
      sourcePath: 'compact-options.md',
      content: `---
id: compact-options
type: single
answer: C
---

# Which one applies?

- A.First option
- B.Second option
- C.Third option
`,
    })

    expect(result.question.options).toEqual([
      { key: 'A', label: 'First option' },
      { key: 'B', label: 'Second option' },
      { key: 'C', label: 'Third option' },
    ])
    expect(result.question.scorable).toBe(true)
    expect(result.diagnostics).toHaveLength(0)
  })

  it('falls back to generated id and boolean options when metadata is incomplete', () => {
    const result = parseMarkdownQuestion({
      libraryId: 'builtin-default',
      sourcePath: 'logic/001.md',
      content: `---
answer: true
---

# A true proposition is valid in context.
`,
    })

    expect(result.question.id).toBe('logic/001')
    expect(result.question.type).toBe('boolean')
    expect(result.question.options).toEqual([
      { key: 'TRUE', label: '正确' },
      { key: 'FALSE', label: '错误' },
    ])
    expect(result.diagnostics.some((item) => item.type === 'missing-id')).toBe(true)
  })

  it('normalizes boolean questions expressed as A/B options', () => {
    const result = parseMarkdownQuestion({
      libraryId: 'builtin-default',
      sourcePath: 'logic/002.md',
      content: `---
answer: A
---

# 判断题：电力现货交易可以独立于规则执行。

- A. 正确
- B. 错误
`,
    })

    expect(result.question.type).toBe('boolean')
    expect(result.question.answer).toEqual(['TRUE'])
    expect(result.question.options).toEqual([
      { key: 'TRUE', label: '正确' },
      { key: 'FALSE', label: '错误' },
    ])
  })
})
