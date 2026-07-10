import { useState } from 'react'
import type { BiodiversityFeaturedSpeciesDto } from '@/modules/biodiversity/biodiversity-visual.types'
import { Badge } from '@/shared/components/Badge'
import { cn } from '@/shared/utils/cn'

interface BiodiversityFeaturedSpeciesProps {
  species: BiodiversityFeaturedSpeciesDto[]
  isLoading?: boolean
  emptyMessage?: string
  onSelect?: (item: BiodiversityFeaturedSpeciesDto) => void
  className?: string
}

export function BiodiversityFeaturedSpecies({
  species,
  isLoading,
  emptyMessage,
  onSelect,
  className,
}: BiodiversityFeaturedSpeciesProps) {
  if (isLoading) {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-surface-3" />
        ))}
      </div>
    )
  }

  if (species.length === 0) {
    return (
      <p className={cn('text-sm text-text-secondary', className)}>
        {emptyMessage ?? 'No hay especies con imagen utilizable en la muestra actual.'}
      </p>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {species.map((item) => (
        <FeaturedSpeciesCard key={`${item.source}-${item.scientificName}`} item={item} onSelect={onSelect} />
      ))}
    </div>
  )
}

function FeaturedSpeciesCard({
  item,
  onSelect,
}: {
  item: BiodiversityFeaturedSpeciesDto
  onSelect?: (item: BiodiversityFeaturedSpeciesDto) => void
}) {
  const [imageError, setImageError] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      className="group overflow-hidden rounded-xl border border-border-subtle bg-surface-2/60 text-left transition hover:border-accent/40"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-3">
        {!imageError ? (
          <img
            src={item.thumbnailUrl}
            alt={item.commonName ?? item.scientificName}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-text-tertiary">
            Imagen no disponible
          </div>
        )}
        {item.isRecent && (
          <Badge variant="accent" className="absolute left-2 top-2 text-[10px]">
            Reciente
          </Badge>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-text-primary line-clamp-1">
          {item.commonName ?? item.scientificName}
        </p>
        {item.commonName && (
          <p className="text-[11px] italic text-text-tertiary line-clamp-1">{item.scientificName}</p>
        )}
        <p className="mt-1 text-[10px] text-text-tertiary">
          {item.taxonomicGroupLabel} · {item.primaryZoneName}
        </p>
        <p className="mt-1 text-[10px] text-text-tertiary uppercase">{item.source}</p>
      </div>
    </button>
  )
}
