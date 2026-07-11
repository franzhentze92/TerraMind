import type {
  BiodiversityFeaturedSpeciesDto,
  BiodiversityObservationVisual,
  BiodiversityVisualDetailDto,
} from '@/modules/biodiversity/biodiversity-visual.types'
import { X, ExternalLink } from 'lucide-react'
import { Badge } from '@/shared/components/Badge'
import { cn } from '@/shared/utils/cn'
import {
  biodiversityProviderLabel,
  biodiversityQualityGradeLabel,
} from '@/modules/biodiversity/utils/biodiversity-labels'

interface BiodiversityVisualDetailModalProps {
  detail?: BiodiversityVisualDetailDto | null
  fallback?: BiodiversityObservationVisual | BiodiversityFeaturedSpeciesDto | null
  isLoading?: boolean
  onClose: () => void
}

export function BiodiversityVisualDetailModal({
  detail,
  fallback,
  isLoading,
  onClose,
}: BiodiversityVisualDetailModalProps) {
  if (!detail && !fallback && !isLoading) return null

  const obs = detail?.observation
  const title =
    obs?.commonName ??
    fallback?.commonName ??
    obs?.taxonName ??
    (fallback && 'scientificName' in fallback ? fallback.scientificName : undefined)
  const scientific =
    obs?.taxonName ?? (fallback && 'scientificName' in fallback ? fallback.scientificName : undefined)
  const imageUrl = obs?.imageUrl ?? ('imageUrl' in (fallback ?? {}) ? fallback?.imageUrl : undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-subtle bg-surface-1 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-text-tertiary hover:bg-surface-3"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {isLoading ? (
          <div className="h-64 animate-pulse bg-surface-3" />
        ) : (
          <>
            {imageUrl && (
              <img
                src={imageUrl}
                alt={title ?? 'Especie'}
                className="max-h-80 w-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
                {scientific && title !== scientific && (
                  <p className="text-sm italic text-text-tertiary">{scientific}</p>
                )}
                {obs?.taxonomicGroupLabel && (
                  <p className="mt-1 text-xs text-text-secondary">{obs.taxonomicGroupLabel}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {obs?.isRecent && <Badge variant="accent">Reciente</Badge>}
                {obs?.qualityGrade && (
                  <Badge variant="default">{biodiversityQualityGradeLabel(obs.qualityGrade)}</Badge>
                )}
                {obs?.coordinatesPrivacyLabel && (
                  <Badge variant="warning">{obs.coordinatesPrivacyLabel}</Badge>
                )}
              </div>

              {detail?.narrative && (
                <p className="text-sm leading-relaxed text-text-secondary">{detail.narrative}</p>
              )}

              <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 text-xs text-text-tertiary">
                <p>
                  Fuente:{' '}
                  {biodiversityProviderLabel(
                    obs?.source ?? ('source' in (fallback ?? {}) ? (fallback?.source ?? '') : ''),
                  )}
                </p>
                {obs?.imageLicense && <p>Licencia imagen: {obs.imageLicense}</p>}
                <p>Atribución: {obs?.imageAttribution ?? ''}</p>
                {obs?.zoneName && <p>Territorio: {obs.zoneName}</p>}
              </div>

              {(obs?.observationUrl || ('observationUrl' in (fallback ?? {}) && fallback?.observationUrl)) && (
                <a
                  href={obs?.observationUrl ?? (fallback as BiodiversityFeaturedSpeciesDto).observationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-text-primary',
                  )}
                >
                  Ver fuente original
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              {detail?.disclaimer && (
                <p className="text-[11px] text-text-tertiary">{detail.disclaimer}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
