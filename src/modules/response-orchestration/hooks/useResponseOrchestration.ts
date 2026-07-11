import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveDecision,
  fetchResponseBriefing,
  fetchResponseDetail,
  fetchResponseHistory,
  fetchResponses,
  modifyDecision,
  rejectDecision,
} from '../api/response-orchestration-api'

export function useResponsesList(filter?: string) {
  return useQuery({
    queryKey: ['responses', filter ?? 'all'],
    queryFn: () => fetchResponses(filter),
  })
}

export function useResponseDetail(incidentId?: string) {
  return useQuery({
    queryKey: ['response-detail', incidentId],
    queryFn: () => fetchResponseDetail(incidentId!),
    enabled: Boolean(incidentId),
  })
}

export function useResponseBriefing(incidentId?: string) {
  return useQuery({
    queryKey: ['response-briefing', incidentId],
    queryFn: () => fetchResponseBriefing(incidentId!),
    enabled: Boolean(incidentId),
  })
}

export function useResponseHistory(incidentId?: string) {
  return useQuery({
    queryKey: ['response-history', incidentId],
    queryFn: () => fetchResponseHistory(incidentId!),
    enabled: Boolean(incidentId),
  })
}

export function useResponseDecisionActions(incidentId?: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['response-detail', incidentId] })
    void qc.invalidateQueries({ queryKey: ['responses'] })
  }

  const approve = useMutation({
    mutationFn: (decisionId: string) => approveDecision(decisionId),
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: (input: { decisionId: string; rationale: string }) =>
      rejectDecision(input.decisionId, input.rationale),
    onSuccess: invalidate,
  })

  const modify = useMutation({
    mutationFn: (input: {
      decisionId: string
      modified_decision: string
      rationale: string
      updated_at?: string
    }) =>
      modifyDecision(input.decisionId, {
        modified_decision: input.modified_decision,
        rationale: input.rationale,
        updated_at: input.updated_at,
      }),
    onSuccess: invalidate,
  })

  return { approve, reject, modify }
}
