import { describe, expect, it } from 'vitest'
import { createLibraryMarkdown, createLibraryMarkdownFilename } from './export-markdown'
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

describe('export markdown helpers', () => {
  it('creates markdown files that can be imported again', async () => {
    const imported = await importMarkdownFiles([
      createMockFile({
        name: 'sample.md',
        content: `# Sample question bank

## 1、单选题

这是题干。

- A. 选项一
- B. 选项二
- 答案：B
- 解析：单选解析

## 2、多选题

- A. 选项甲
- B. 选项乙
- C. 选项丙
- 答案：AC

## 3、判断题

- A. 正确
- B. 错误
- 答案：A
`,
      }),
    ])

    const exportedMarkdown = createLibraryMarkdown({
      library: {
        ...imported.manifest,
        name: '导出题库',
      },
      questions: imported.questions,
    })

    const roundTripped = await importMarkdownFiles([
      createMockFile({
        name: 'round-trip.md',
        content: exportedMarkdown,
      }),
    ])

    expect(exportedMarkdown).toContain('# 导出题库')
    expect(exportedMarkdown).toContain('## 1、单选题')
    expect(exportedMarkdown).toContain('- 答案：B')
    expect(exportedMarkdown).toContain('- 解析：单选解析')
    expect(roundTripped.questions).toHaveLength(3)
    expect(roundTripped.questions[0].title).toBe('单选题')
    expect(roundTripped.questions[0].answer).toEqual(['B'])
    expect(roundTripped.questions[1].type).toBe('multiple')
    expect(roundTripped.questions[1].answer).toEqual(['A', 'C'])
    expect(roundTripped.questions[2].type).toBe('boolean')
    expect(roundTripped.questions[2].answer).toEqual(['TRUE'])
  })

  it('creates markdown filenames from the library name', () => {
    expect(createLibraryMarkdownFilename('中级/电力:交易员笔试题库')).toBe('中级-电力-交易员笔试题库.md')
  })
})
