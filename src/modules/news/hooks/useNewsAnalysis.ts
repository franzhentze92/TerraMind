import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  analyzeNewsDocument,
  approveAnalysis,
  batchAnalyze,
  batchAnalyzeDryRun,
  fetchDocumentAnalysis,
  fetchReviewQueue,
  rejectAnalysis,
} from '../api/news-analysis-api'

export function useDocumentAnalysis(documentId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'analysis', documentId],
    queryFn: () => fetchDocumentAnalysis(documentId!),
    enabled: authReady && Boolean(documentId),
  })
}

export function useAnalyzeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, modelTier }: { documentId: string; modelTier?: 'fast' | 'deep' }) =>
      analyzeNewsDocument(documentId, modelTier),
    onSuccess: (data) => {
      qc.setQueryData(['news', 'analysis', data.document_id], data)
      qc.invalidateQueries({ queryKey: ['news', 'review-queue'] })
    },
  })
}

export function useReviewQueue() {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'review-queue'],
    queryFn: fetchReviewQueue,
    enabled: authReady,
  })
}

export function useBatchAnalyzeDryRun() {
  return useMutation({
    mutationFn: batchAnalyzeDryRun,
  })
}

export function useBatchAnalyze() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: batchAnalyze,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news', 'analysis'] })
      qc.invalidateQueries({ queryKey: ['news', 'review-queue'] })
    },
  })
}

export function useApproveAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ analysisId, notes }: { analysisId: string; notes?: string }) =>
      approveAnalysis(analysisId, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news', 'analysis'] })
      qc.invalidateQueries({ queryKey: ['news', 'review-queue'] })
    },
  })
}

export function useRejectAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ analysisId, reason }: { analysisId: string; reason?: string }) =>
      rejectAnalysis(analysisId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news', 'analysis'] })
      qc.invalidateQueries({ queryKey: ['news', 'review-queue'] })
    },
  })
}
