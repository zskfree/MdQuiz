import { normalizeAnswerList } from './normalize-answer'

export function judgeBooleanAnswer(expected: string[], selected: string[]): boolean {
  const normalizedExpected = normalizeAnswerList(expected)
  const normalizedSelected = normalizeAnswerList(selected)

  return normalizedExpected.length === 1 &&
    normalizedSelected.length === 1 &&
    normalizedExpected[0] === normalizedSelected[0]
}
