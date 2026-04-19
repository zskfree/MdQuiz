import { describe, expect, it } from 'vitest'
import { gradeQuestion } from './judge'

describe('gradeQuestion', () => {
  it('grades single choice answers', () => {
    const result = gradeQuestion(
      { type: 'single', answer: ['B'] },
      ['b'],
    )

    expect(result.isCorrect).toBe(true)
    expect(result.normalizedSelected).toEqual(['B'])
  })

  it('grades multiple choice answers as set equality', () => {
    const correct = gradeQuestion(
      { type: 'multiple', answer: ['A', 'C', 'D'] },
      ['D', 'A', 'C'],
    )
    const incorrect = gradeQuestion(
      { type: 'multiple', answer: ['A', 'C', 'D'] },
      ['A', 'C'],
    )

    expect(correct.isCorrect).toBe(true)
    expect(incorrect.isCorrect).toBe(false)
  })

  it('grades boolean answers with semantic normalization', () => {
    const result = gradeQuestion(
      { type: 'boolean', answer: ['TRUE'] },
      ['对'],
    )

    expect(result.isCorrect).toBe(true)
    expect(result.normalizedSelected).toEqual(['TRUE'])
  })
})
