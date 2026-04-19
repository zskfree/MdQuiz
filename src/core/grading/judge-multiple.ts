import { normalizeAnswerList } from './normalize-answer'

export function judgeMultipleAnswer(expected: string[], selected: string[]): boolean {
  const normalizedExpected = normalizeAnswerList(expected).sort()
  const normalizedSelected = normalizeAnswerList(selected).sort()

  if (normalizedExpected.length !== normalizedSelected.length) {
    return false
  }

  return normalizedExpected.every((item, index) => item === normalizedSelected[index])
}
