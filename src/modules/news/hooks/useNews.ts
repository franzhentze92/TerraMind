import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  estimateNewsSourceIngestion,
  fetchNewsDocumentDetail,
  fetchNewsDocuments,
  fetchNewsIngestionRuns,
  fetchNewsSources,
  fetchNewsSummary,
  runNewsSourceIngestion,
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

export function useNewsIngestionRuns(enabled = true, sourceId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['news', 'ingestion-runs', sourceId ?? 'all'],
    queryFn: () => fetchNewsIngestionRuns(sourceId),
    enabled: authReady && enabled,
  })
}

export function useRunNewsSourceIngestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sourceCode: string) => runNewsSourceIngestion(sourceCode),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['news'] })
    },
  })
}

export function useEstimateNewsSourceIngestion() {
  return useMutation({
    mutationFn: (sourceCode: string) => estimateNewsSourceIngestion(sourceCode),
  })
}

/** Compatibilidad: tipado antiguo apunta a Prensa Libre. */
export function useRunPrensaLibreIngestion() {
  const mutation = useRunNewsSourceIngestion()
  return {
    ...mutation,
    mutate: () => mutation.mutate('prensa_libre_gt'),
    mutateAsync: () => mutation.mutateAsync('prensa_libre_gt'),
  }
}
