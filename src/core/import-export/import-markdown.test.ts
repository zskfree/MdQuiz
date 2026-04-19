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

  it('rejects empty selections', async () => {
    await expect(importMarkdownFiles([])).rejects.toThrow('No Markdown files were selected.')
  })
})
