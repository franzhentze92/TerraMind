import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  ScaleControl,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import type { Layer, PathOptions } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import type {
  FireDetectionsGeoJsonDto,
  FireEventListItemDto,
  FireEventsGeoJsonDto,
  FireEventGeoJsonFeature,
  LandCoverContextDto,
} from '@/modules/fires/types/fire.dto'
import {
  DETECTION_MARKER_STYLE,
  EVENT_FIT_MAX_ZOOM,
  EVENT_FIT_PADDING,
  GUATEMALA_FIT_PADDING,
  GUATEMALA_MAP_BOUNDS,
  GUATEMALA_MAP_CENTER,
  GUATEMALA_MAP_ZOOM,
  centroidMarkerStyle,
  riskMapStyle,
} from '@/modules/fires/utils/map-styles'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import {
  eventSemanticLabel,
  eventStatusLabel,
  validationStatusLabel,
} from '@/modules/fires/utils/fire-interpretation'
import { riskLevelLabel } from '@/modules/fires/utils/format'
import { sourceProductDisplayName } from '@/modules/fires/utils/source-labels'
import { pluralizeCount } from '@/modules/fires/utils/thermal-labels'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'
import { FireMapLegend } from '@/modules/fires/components/FireMapLegend'
import { buildLandCoverMapSnippet } from '@/modules/fires/utils/land-cover-summary'
import { cn } from '@/shared/utils/cn'

interface FireEventsMapProps {
  eventsGeoJson?: FireEventsGeoJsonDto
  detectionsGeoJson?: FireDetectionsGeoJsonDto
  eventListItems?: FireEventListItemDto[]
  showDetections: boolean
  selectedEventId?: string
  selectedEventLandCover?: LandCoverContextDto | null
  isLoading?: boolean
  isError?: boolean
  onSelectEvent: (eventId: string) => void
  onViewDetail: (eventId: string) => void
  className?: string
}

interface CentroidPoint {
  eventId: string
  lat: number
  lng: number
  priority: number
  riskLevel: string
  validationStatus: string
  feature: FireEventGeoJsonFeature
}

function geometryCenter(geometry: GeoJSON.Geometry): L.LatLng | null {
  const layer = L.geoJSON(geometry as GeoJSON.GeoJsonObject)
  const bounds = layer.getBounds()
  if (!bounds.isValid()) return null
  return bounds.getCenter()
}

function buildCentroids(geoJson?: FireEventsGeoJsonDto): CentroidPoint[] {
  if (!geoJson) return []
  return geoJson.features
    .map((feature) => {
      const center = geometryCenter(feature.geometry)
      if (!center) return null
      return {
        eventId: feature.properties.event_id,
        lat: center.lat,
        lng: center.lng,
        priority: feature.properties.priority_score,
        riskLevel: feature.properties.risk_level,
        validationStatus: feature.properties.validation_status,
        feature,
      }
    })
    .filter((c): c is CentroidPoint => c !== null)
}

function priorityIcon(priority: number, color: string, selected: boolean) {
  const size = selected ? 30 : 26
  return L.divIcon({
    className: 'fire-priority-marker',
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      border:2px solid ${selected ? '#fff' : color};
      box-shadow:${selected ? '0 0 0 3px rgba(249,115,22,0.55), 0 2px 6px rgba(0,0,0,0.35)' : '0 2px 4px rgba(0,0,0,0.25)'};
      display:flex;align-items:center;justify-content:center;
      font-size:10px;font-weight:700;color:#fff;
      font-family:ui-monospace,monospace;
    ">${Math.round(priority)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function MapViewportController({
  selectedEventId,
  nationalViewToken,
  centroids,
}: {
  selectedEventId?: string
  nationalViewToken: number
  centroids: CentroidPoint[]
}) {
  const map = useMap()

  const fitNational = useCallback(() => {
    map.fitBounds(GUATEMALA_MAP_BOUNDS, { padding: GUATEMALA_FIT_PADDING })
  }, [map])

  useEffect(() => {
    if (nationalViewToken > 0) {
      fitNational()
      return
    }

    if (!selectedEventId) {
      fitNational()
      return
    }

    const selected = centroids.find((c) => c.eventId === selectedEventId)
    if (!selected) {
      fitNational()
      return
    }

    const layer = L.geoJSON(selected.feature.geometry as GeoJSON.GeoJsonObject)
    const bounds = layer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: EVENT_FIT_PADDING,
        maxZoom: EVENT_FIT_MAX_ZOOM,
      })
    }
  }, [selectedEventId, nationalViewToken, centroids, map, fitNational])

  return null
}

function MapControlButton({
  onClick,
  children,
  title,
}: {
  onClick: () => void
  children: ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-md border border-border-subtle bg-surface-1/95 px-2.5 py-1.5 text-[11px] font-medium text-text-secondary shadow-sm backdrop-blur-sm hover:bg-surface-2 hover:text-text-primary"
    >
      {children}
    </button>
  )
}

export function FireEventsMap({
  eventsGeoJson,
  detectionsGeoJson,
  eventListItems,
  showDetections,
  selectedEventId,
  selectedEventLandCover,
  isLoading,
  isError,
  onSelectEvent,
  onViewDetail,
  className,
}: FireEventsMapProps) {
  const [nationalViewToken, setNationalViewToken] = useState(0)
  const eventsById = useMemo(
    () => Object.fromEntries((eventListItems ?? []).map((e) => [e.id, e])),
    [eventListItems],
  )

  const centroids = useMemo(() => buildCentroids(eventsGeoJson), [eventsGeoJson])

  const eventStyle = useMemo(
    () =>
      (feature?: GeoJSON.Feature): PathOptions => {
        const props = feature?.properties as {
          risk_level?: string
          event_id?: string
          validation_status?: string
        }
        const risk = props?.risk_level ?? 'informativo'
        const id = props?.event_id
        return riskMapStyle(risk, id === selectedEventId, props?.validation_status)
      },
    [selectedEventId],
  )

  const onEachEvent = (feature: GeoJSON.Feature, layer: Layer) => {
    const eventId = (feature.properties as { event_id: string }).event_id
    const typed = feature as unknown as FireEventGeoJsonFeature
    layer.on({ click: () => onSelectEvent(eventId) })
    const popup = L.popup({ maxWidth: 300 }).setContent(`<div id="popup-${eventId}"></div>`)
    layer.bindPopup(popup)
    layer.on('popupopen', () => {
      const el = document.getElementById(`popup-${eventId}`)
      if (!el) return
      const p = typed.properties
      const listItem = eventsById[eventId]
      const sources = listItem?.source_products
        .map((s) => sourceProductDisplayName(s))
        .join(', ')
      const btnId = `popup-btn-${eventId}`
      const landCoverHtml =
        eventId === selectedEventId && selectedEventLandCover
          ? (() => {
              const snippet = buildLandCoverMapSnippet(selectedEventLandCover)
              if (!snippet) return ''
              return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;color:#4b5563;white-space:pre-line">${snippet
                .split('\n')
                .map((line) => `<div>${line}</div>`)
                .join('')}</div>`
            })()
          : ''
      const popupTitle =
        listItem != null
          ? buildThermalEventDisplayName(listItem)
          : (p.department_name ?? 'Evento térmico')
      el.innerHTML = `
        <div style="font-size:12px;line-height:1.5">
          <strong>${popupTitle}</strong>
          <div style="margin-top:4px;color:#374151;font-weight:500">
            ${eventSemanticLabel(p.validation_status)}
          </div>
          <div style="margin-top:2px;color:#6b7280">${riskLevelLabel(p.risk_level)}</div>
          <div style="margin-top:6px;display:grid;gap:2px;color:#6b7280">
            <span>Estado: ${eventStatusLabel(p.status)}</span>
            <span>Validación: ${validationStatusLabel(p.validation_status)}</span>
            <span>${pluralizeCount(p.detection_count, 'detección', 'detecciones')}</span>
            <span>${pluralizeCount(p.satellite_count, 'fuente satelital', 'fuentes satelitales')}</span>
            ${sources ? `<span title="${listItem?.source_products.join(', ') ?? ''}">Fuentes: ${sources}</span>` : ''}
            <span>Última det.: ${formatGuatemalaDateTime(p.last_detected_at)}</span>
          </div>
          ${landCoverHtml}
          <button id="${btnId}" type="button" style="margin-top:8px;font-size:12px;font-weight:500;color:#2563eb;background:none;border:none;padding:0;cursor:pointer">
            Ver detalle
          </button>
        </div>
      `
      document.getElementById(btnId)?.addEventListener('click', (e) => {
        e.stopPropagation()
        onViewDetail(eventId)
      })
    })
  }

  const empty = !isLoading && (eventsGeoJson?.features.length ?? 0) === 0

  const bumpNationalView = () => setNationalViewToken((t) => t + 1)

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl border border-border-subtle', className)}
      aria-label="Mapa de eventos térmicos"
    >
      <MapContainer
        center={GUATEMALA_MAP_CENTER}
        zoom={GUATEMALA_MAP_ZOOM}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="topright" />
        <ScaleControl position="bottomleft" />

        {eventsGeoJson && eventsGeoJson.features.length > 0 && (
          <GeoJSON
            key={`events-${eventsGeoJson.generated_at}-${selectedEventId ?? 'none'}-${selectedEventLandCover?.generated_at ?? 'no-lc'}`}
            data={eventsGeoJson as GeoJSON.FeatureCollection}
            style={eventStyle}
            onEachFeature={onEachEvent}
          />
        )}

        {centroids.map((c) => {
          const style = centroidMarkerStyle(c.riskLevel, c.eventId === selectedEventId)
          return (
            <Marker
              key={`centroid-${c.eventId}-${selectedEventId === c.eventId ? 'sel' : 'n'}`}
              position={[c.lat, c.lng]}
              icon={priorityIcon(
                c.priority,
                style.fillColor,
                c.eventId === selectedEventId,
              )}
              eventHandlers={{ click: () => onSelectEvent(c.eventId) }}
            />
          )
        })}

        {showDetections && detectionsGeoJson && detectionsGeoJson.features.length > 0 && (
          <GeoJSON
            key={`det-${detectionsGeoJson.generated_at}`}
            data={detectionsGeoJson as GeoJSON.FeatureCollection}
            pointToLayer={(_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: DETECTION_MARKER_STYLE.radius,
                fillColor: DETECTION_MARKER_STYLE.fillColor,
                color: DETECTION_MARKER_STYLE.strokeColor,
                weight: 1,
                opacity: 0.9,
                fillOpacity: 0.75,
              })
            }
            onEachFeature={(feature, layer) => {
              const p = feature.properties as {
                acquired_at_utc: string
                source_display_name: string
                source_product: string
                frp_mw: number | null
                confidence_normalized: string | null
              }
              layer.bindTooltip('Detección satelital', { direction: 'top' })
              layer.bindPopup(
                `<div style="font-size:12px;line-height:1.5">
                  <strong>Detección satelital</strong><br/>
                  <span style="color:#374151">No representa incendio confirmado</span><br/>
                  <span title="${p.source_product}">${p.source_display_name}</span><br/>
                  Energía radiativa: ${p.frp_mw ?? '—'} MW<br/>Confianza: ${p.confidence_normalized ?? '—'}
                </div>`,
              )
            }}
          />
        )}

        <MapViewportController
          selectedEventId={selectedEventId}
          nationalViewToken={nationalViewToken}
          centroids={centroids}
        />
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[400] flex flex-col justify-between p-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <FireMapLegend className="pointer-events-auto max-w-[200px]" />
          <div className="pointer-events-auto flex flex-col gap-1.5">
            <MapControlButton onClick={bumpNationalView} title="Centrar mapa en Guatemala">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Centrar en Guatemala
              </span>
            </MapControlButton>
            {selectedEventId && (
              <MapControlButton
                onClick={bumpNationalView}
                title="Volver a la vista nacional del país"
              >
                Volver a vista nacional
              </MapControlButton>
            )}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-surface-0/70 text-sm text-text-secondary">
          Cargando mapa…
        </div>
      )}

      {isError && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-surface-0/80 p-4 text-center text-sm text-confidence-low">
          No se pudo cargar el mapa.
        </div>
      )}

      {empty && !isError && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-[400] flex justify-center">
          <span className="rounded-md bg-surface-1/90 px-3 py-1.5 text-xs text-text-secondary shadow">
            Sin eventos para los filtros actuales
          </span>
        </div>
      )}
    </div>
  )
}
