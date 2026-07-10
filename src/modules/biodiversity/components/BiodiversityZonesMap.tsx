import { useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, ScaleControl, ZoomControl } from 'react-leaflet'
import type { BiodiversityDashboardZoneItem } from '@/modules/biodiversity/types/biodiversity-dashboard.types'
import { formatResearchGradeLabel } from '@/modules/biodiversity/biodiversity-visual-status'
import {
  GUATEMALA_MAP_BOUNDS,
  GUATEMALA_MAP_CENTER,
  GUATEMALA_MAP_ZOOM,
} from '@/modules/fires/utils/map-styles'
import { cn } from '@/shared/utils/cn'
import 'leaflet/dist/leaflet.css'

export type BiodiversityMapLayer = 'richness' | 'recent' | 'quality'

interface BiodiversityZonesMapProps {
  zones: BiodiversityDashboardZoneItem[]
  selectedZoneCode?: string
  layer?: BiodiversityMapLayer
  onSelectZone: (zoneCode: string) => void
  isLoading?: boolean
  isError?: boolean
  className?: string
}

function zoneRadius(speciesCount: number, maxSpecies: number): number {
  const minR = 8
  const maxR = 28
  if (maxSpecies <= 0) return minR
  return minR + (speciesCount / maxSpecies) * (maxR - minR)
}

function zoneColor(zone: BiodiversityDashboardZoneItem, layer: BiodiversityMapLayer): string {
  if (layer === 'recent') {
    if (zone.recent_count >= 10) return '#22c55e'
    if (zone.recent_count >= 1) return '#eab308'
    return '#6b7280'
  }
  if (layer === 'quality') {
    if (zone.source_distribution.inaturalist === 0) {
      if (zone.generalized_count > 0) return '#f97316'
      return '#94a3b8'
    }
    if ((zone.research_grade_pct ?? 0) >= 50) return '#3b82f6'
    if (zone.generalized_count > 0) return '#f97316'
    return '#94a3b8'
  }
  if (zone.species_count >= 20) return '#10b981'
  if (zone.species_count >= 5) return '#6366f1'
  return '#64748b'
}

export function BiodiversityZonesMap({
  zones,
  selectedZoneCode,
  layer = 'richness',
  onSelectZone,
  isLoading,
  isError,
  className,
}: BiodiversityZonesMapProps) {
  const maxSpecies = useMemo(
    () => Math.max(...zones.map((z) => z.species_count), 1),
    [zones],
  )

  if (isError) {
    return (
      <div
        className={cn(
          'flex h-[360px] items-center justify-center rounded-xl border border-border-subtle bg-surface-2/40 text-sm text-text-secondary',
          className,
        )}
      >
        No se pudo cargar el mapa de zonas.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          'h-[360px] animate-pulse rounded-xl border border-border-subtle bg-surface-3',
          className,
        )}
      />
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-border-subtle', className)}>
      <MapContainer
        center={GUATEMALA_MAP_CENTER}
        zoom={GUATEMALA_MAP_ZOOM}
        maxBounds={GUATEMALA_MAP_BOUNDS}
        maxBoundsViscosity={1}
        className="h-[360px] w-full bg-surface-1"
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="topright" />
        <ScaleControl position="bottomleft" />

        {zones.map((zone) => {
          const selected = zone.zone_code === selectedZoneCode
          const color = zoneColor(zone, layer)
          const radius = zoneRadius(zone.species_count, maxSpecies)
          return (
            <CircleMarker
              key={zone.zone_code}
              center={[zone.centroid.lat, zone.centroid.lng]}
              radius={selected ? radius + 4 : radius}
              pathOptions={{
                color: selected ? '#fff' : color,
                fillColor: color,
                fillOpacity: selected ? 0.55 : 0.4,
                weight: selected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onSelectZone(zone.zone_code),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">{zone.zone_name}</p>
                  <p>{zone.species_count} especies · {zone.observations_count} obs.</p>
                  <p>
                    {zone.recent_count} recientes ·{' '}
                    {formatResearchGradeLabel(
                      zone.research_grade_pct,
                      zone.source_distribution.inaturalist,
                    )}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <div className="absolute bottom-3 left-3 max-w-[220px] rounded-md border border-border-subtle bg-surface-1/95 px-3 py-2 text-[10px] text-text-secondary">
        <p className="font-medium text-text-primary">Leyenda</p>
        {layer === 'richness' && (
          <>
            <p className="mt-1">Tamaño del círculo: especies documentadas</p>
            <p>Color: riqueza relativa en la muestra</p>
            <p className="mt-1 text-text-tertiary">Verde alto · Índigo medio · Gris bajo</p>
          </>
        )}
        {layer === 'recent' && (
          <>
            <p className="mt-1">Tamaño del círculo: especies documentadas</p>
            <p>Color: observaciones recientes (30 días)</p>
            <p className="mt-1 text-text-tertiary">Verde ≥10 · Amarillo 1–9 · Gris 0</p>
          </>
        )}
        {layer === 'quality' && (
          <>
            <p className="mt-1">Tamaño del círculo: especies documentadas</p>
            <p>Color: calidad iNaturalist o generalización</p>
            <p className="mt-1 text-text-tertiary">Azul ≥50% research · Naranja generalizados · Gris sin iNat</p>
          </>
        )}
      </div>
    </div>
  )
}
