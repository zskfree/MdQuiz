import type { DiagnosticIssue, DiagnosticIssueType } from '../../types'

type DiagnosticInput = {
  libraryId: string
  questionId?: string
  type: DiagnosticIssueType
  message: string
}

let diagnosticCounter = 0

function severityFor(type: DiagnosticIssueType): DiagnosticIssue['severity'] {
  switch (type) {
    case 'missing-id':
    case 'missing-answer':
    case 'duplicate-id':
    case 'invalid-type':
    case 'option-answer-mismatch':
    case 'markdown-error':
      return 'error'
    case 'asset-missing':
      return 'warning'
    default:
      return 'info'
  }
}

export function createDiagnosticIssue(input: DiagnosticInput): DiagnosticIssue {
  diagnosticCounter += 1

  return {
    id: `${input.libraryId}-diag-${diagnosticCounter}`,
    libraryId: input.libraryId,
    questionId: input.questionId,
    type: input.type,
    severity: severityFor(input.type),
    message: input.message,
    createdAt: Date.now(),
  }
}
