import { evaluateFireResponseOrchestration } from '@/modules/response-orchestration/engine/fire-response-orchestration.engine'
import { assertSafeResponsePayload } from '@/modules/response-orchestration/response-orchestration-copy-guard'
import type { ResponseOrchestrationInput, ResponseOrchestrationOutput } from '@/modules/response-orchestration/response-orchestration.types'

export function evaluateResponseOrchestration(input: ResponseOrchestrationInput): ResponseOrchestrationOutput {
  const output = evaluateFireResponseOrchestration(input)
  assertSafeResponsePayload({
    rationaleCodes: output.rationaleCodes,
    blockingUncertainties: output.blockingUncertainties,
    recommendedActions: output.recommendedActions,
  })
  return output
}
