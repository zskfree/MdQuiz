import type { Question } from '../../types'
import { judgeBooleanAnswer } from './judge-boolean'
import { judgeMultipleAnswer } from './judge-multiple'
import { normalizeAnswerList } from './normalize-answer'
import { judgeSingleAnswer } from './judge-single'

export type GradeResult = {
  isCorrect: boolean
  normalizedExpected: string[]
  normalizedSelected: string[]
}

export function gradeQuestion(
  question: Pick<Question, 'type' | 'answer'>,
  selected: string[],
): GradeResult {
  const normalizedExpected = normalizeAnswerList(question.answer)
  const normalizedSelected = normalizeAnswerList(selected)

  switch (question.type) {
    case 'multiple':
      return {
        isCorrect: judgeMultipleAnswer(normalizedExpected, normalizedSelected),
        normalizedExpected,
        normalizedSelected,
      }
    case 'boolean':
      return {
        isCorrect: judgeBooleanAnswer(normalizedExpected, normalizedSelected),
        normalizedExpected,
        normalizedSelected,
      }
    case 'single':
    default:
      return {
        isCorrect: judgeSingleAnswer(normalizedExpected, normalizedSelected),
        normalizedExpected,
        normalizedSelected,
      }
  }
}
