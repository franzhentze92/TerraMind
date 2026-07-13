import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  fetchNewsDocumentDetail,
  fetchNewsDocuments,
  fetchNewsIngestionRuns,
  fetchNewsSources,
  fetchNewsSummary,
  runPrensaLibreIngestion,
} from '../api/news-api'

export function useNewsSummary(periodHours = 168) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'summary', periodHours],
    queryFn: () => fetchNewsSummary(periodHours),
    enabled: authReady,
  })
}

export function useNewsSources() {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'sources'],
    queryFn: fetchNewsSources,
    enabled: authReady,
  })
}

export function useNewsDocuments(filters: Record<string, string | undefined> = {}) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'documents', filters],
    queryFn: () => fetchNewsDocuments(filters),
    enabled: authReady,
  })
}

export function useNewsDocumentDetail(id?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'document', id],
    queryFn: () => fetchNewsDocumentDetail(id!),
    enabled: authReady && Boolean(id),
  })
}

export function useNewsIngestionRuns(enabled = true) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'ingestion-runs'],
    queryFn: fetchNewsIngestionRuns,
    enabled: authReady && enabled,
  })
}

export function useRunPrensaLibreIngestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: runPrensaLibreIngestion,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['news'] })
    },
  })
}
