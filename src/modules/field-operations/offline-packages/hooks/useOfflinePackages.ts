import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  generateOfflinePackage,
  getOfflinePackageStatusApi,
  listMissionOfflinePackages,
  requestOfflinePackageDownloadUrl,
  revokeOfflinePackageApi,
  validateOfflinePackageApi,
} from '@/modules/field-operations/offline-packages/api/offline-packages-api'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'

export function useMissionOfflinePackages(missionId: string | undefined) {
  return useQuery({
    queryKey: ['offline-packages', 'mission', missionId],
    queryFn: () => listMissionOfflinePackages(missionId!),
    enabled: Boolean(missionId),
  })
}

export function useOfflinePackageStatus(packageId: string | undefined) {
  return useQuery({
    queryKey: ['offline-packages', 'status', packageId],
    queryFn: () => getOfflinePackageStatusApi(packageId!),
    enabled: Boolean(packageId),
  })
}

export function useGenerateOfflinePackage(missionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { idempotency_key: string }) =>
      generateOfflinePackage(missionId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offline-packages', 'mission', missionId] })
    },
  })
}

export function useDownloadOfflinePackage(missionId: string, missionTitle: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (packageId: string) => {
      const payload = await requestOfflinePackageDownloadUrl(packageId, {
        idempotency_key: crypto.randomUUID(),
        app_version: 'web-pwa-preview',
      })
      const files = payload.files
        .filter((f) => f.content)
        .map((f) => ({ path: f.path, content: f.content! }))
      const repo = OfflinePackageRepository.createDefault()
      const saved = await repo.saveDownload({
        mission_id: missionId,
        mission_title: missionTitle,
        manifest: payload.manifest,
        payloads: files,
      })
      return saved
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offline-packages', 'local'] })
      qc.invalidateQueries({ queryKey: ['offline-packages', 'mission', missionId] })
    },
  })
}

export function useRevokeOfflinePackage(missionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { packageId: string; reason: string }) =>
      revokeOfflinePackageApi(input.packageId, { reason: input.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offline-packages', 'mission', missionId] })
    },
  })
}

export function useValidateOfflinePackageIntegrity() {
  return useMutation({
    mutationFn: (packageId: string) => validateOfflinePackageApi(packageId),
  })
}

export function useLocalOfflinePackages() {
  return useQuery({
    queryKey: ['offline-packages', 'local'],
    queryFn: async () => OfflinePackageRepository.createDefault().list(),
  })
}
