/**
 * NationalEventMap — registry-driven multi-type event map.
 *
 * The map has NO per-type logic. For every enabled type it renders one layer
 * built from that type's registry map renderer (`toMapFeature`), so points
 * (thermal) and polygons (rainfall deficit) — and any future geometry — render
 * automatically. Colors come from `manifest.accentColor` / the feature's own
 * `fill_color`. Selection flows up to the shared context.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, TileLayer, GeoJSON, ScaleControl, ZoomControl, useMap } from 'react-leaflet'
import type { Layer, PathOptions } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  GUATEMALA_MAP_BOUNDS,
  GUATEMALA_MAP_CENTER,
  GUATEMALA_MAP_ZOOM,
} from '@/modules/fires/utils/map-styles'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { EventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'
import { useEnvironmentalEvents } from '@/modules/environmental-events/hooks/useEnvironmentalEvents'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { DashboardEventType } from '../hooks/useDashboardEventTypes'
import {
  boundsFromFeatureCollection,
  combineBounds,
  hasRenderableGeometry,
  type LatLngBox,
} from '../utils/map-bounds'

/**
 * Builds a Leaflet marker whose glyph is the SAME registry icon shown in the
 * legend and the intelligence timeline (a white lucide icon inside a filled
 * accent-color badge). Icons are cached per `iconKey|color|selected` so the
 * SVG is only serialized once per variant.
 */
const eventIconCache = new Map<string, L.DivIcon>()

function eventDivIcon(iconKey: string, color: string, selected: boolean): L.DivIcon {
  const cacheKey = `${iconKey}|${color}|${selected}`
  const cached = eventIconCache.get(cacheKey)
  if (cached) return cached

  const size = selected ? 34 : 28
  const glyph = Math.round(size * 0.55)
  const svg = renderToStaticMarkup(<EventTypeIcon icon={iconKey} color="#ffffff" size={glyph} />)
  const html =
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};` +
    `border:${selected ? '3px solid #fffbeb' : '2px solid rgba(255,255,255,0.9)'};` +
    `box-shadow:${
      selected
        ? '0 0 0 3px rgba(255,255,255,0.35),0 2px 6px rgba(0,0,0,0.4)'
        : '0 2px 5px rgba(0,0,0,0.3)'
    };display:flex;align-items:center;justify-content:center;">${svg}</div>`

  const divIcon = L.divIcon({
    className: 'event-type-marker',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
  eventIconCache.set(cacheKey, divIcon)
  return divIcon
}

/**
 * Fits the viewport to the active events on load/update, and re-centres on
 * Guatemala when the user presses "Centrar Guatemala" (`centerToken`). Two
 * effects keep manual recentring and event-driven fitting independent so a
 * manual recentre is never immediately overridden.
 */
function FitController({
  combined,
  combinedKey,
  centerToken,
}: {
  combined: LatLngBox | null
  combinedKey: string
  centerToken: number
}) {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(GUATEMALA_MAP_BOUNDS, { padding: [24, 24] })
  }, [map, centerToken])

  useEffect(() => {
    // Visible features → fit to them; none → fall back to Guatemala (never keep
    // the bounds of a previous load).
    if (combined) {
      map.fitBounds(combined as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 9 })
    } else {
      map.fitBounds(GUATEMALA_MAP_BOUNDS, { padding: [24, 24] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, combinedKey])

  return null
}

function TypeLayer({
  type,
  icon,
  accentColor,
  since,
  selectedEventId,
  onSelect,
  onReady,
  onBounds,
}: {
  type: EnvironmentalEventType
  icon: string
  accentColor: string
  since: string
  selectedEventId: string | undefined
  onSelect: (id: string) => void
  onReady?: () => void
  onBounds: (type: string, bounds: LatLngBox | null) => void
}) {
  // Same canonical window the "Eventos activos" KPI counts (period `since`), and
  // `limit <= 100` (the generic list route caps at 100 — `limit: 500` was
  // rejected with HTTP 400, which is why the map used to receive nothing).
  const eventsQuery = useEnvironmentalEvents({ type, since, limit: 100 })
  const renderer = useMemo(() => environmentalEventRegistry.getMapRenderer(type), [type])

  const featureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    const items = eventsQuery.data?.items ?? []
    const features = items.map((e) => renderer.toMapFeature(e)).filter(hasRenderableGeometry)
    if (import.meta.env.DEV) {
      const dropped = items.length - features.length
      // Dev-only trace of the events→features pipeline (never in production UI).
      // eslint-disable-next-line no-console
      console.debug(
        `[NationalEventMap] ${type}: ${items.length} eventos → ${features.length} features` +
          (dropped > 0 ? ` (${dropped} sin geometría válida)` : ''),
      )
    }
    return { type: 'FeatureCollection', features }
  }, [eventsQuery.data, renderer, type])

  useEffect(() => {
    if (eventsQuery.data && !eventsQuery.isLoading) onReady?.()
  }, [eventsQuery.data, eventsQuery.isLoading, onReady])

  useEffect(() => {
    onBounds(type, boundsFromFeatureCollection(featureCollection))
    return () => onBounds(type, null)
  }, [type, featureCollection, onBounds])

  if (featureCollection.features.length === 0) return null

  const pointToLayer = (feature: GeoJSON.Feature, latlng: L.LatLng) => {
    const selected = String(feature.id) === selectedEventId
    const fill = (feature.properties?.fill_color as string) || accentColor
    // Same registry icon shown in the legend/timeline, rendered as a filled
    // accent badge. The selected marker is larger with a brighter ring.
    return L.marker(latlng, { icon: eventDivIcon(icon, fill, selected) })
  }

  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const selected = feature && String(feature.id) === selectedEventId
    const fill = (feature?.properties?.fill_color as string) || accentColor
    return {
      color: selected ? '#ffffff' : fill,
      weight: selected ? 2.5 : 1,
      fillColor: fill,
      fillOpacity: selected ? 0.5 : 0.3,
    }
  }

  const onEachFeature = (feature: GeoJSON.Feature, layer: Layer) => {
    const id = feature.properties?.event_id as string | undefined
    const title = (feature.properties?.title as string) || 'Evento'
    layer.bindTooltip(title, { direction: 'top', sticky: true })
    layer.on('click', () => {
      if (id) onSelect(id)
    })
  }

  return (
    <GeoJSON
      key={`${type}-${featureCollection.features.length}-${selectedEventId ?? 'none'}`}
      data={featureCollection}
      pointToLayer={pointToLayer}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

interface NationalEventMapProps {
  types: DashboardEventType[]
  hiddenTypes: Set<string>
  /** Lower bound (`since`) of the active-event window shared with the KPI. */
  since: string
  selectedEventId: string | undefined
  onSelect: (id: string) => void
  centerToken: number
  className?: string
  onLayerReady?: () => void
}

export function NationalEventMap({
  types,
  hiddenTypes,
  since,
  selectedEventId,
  onSelect,
  centerToken,
  className,
  onLayerReady,
}: NationalEventMapProps) {
  const visible = types.filter((t) => !hiddenTypes.has(t.type))

  const [boundsByType, setBoundsByType] = useState<Record<string, LatLngBox | null>>({})

  const reportBounds = useCallback((type: string, bounds: LatLngBox | null) => {
    setBoundsByType((prev) => {
      const prevKey = JSON.stringify(prev[type] ?? null)
      const nextKey = JSON.stringify(bounds)
      if (prevKey === nextKey) return prev
      return { ...prev, [type]: bounds }
    })
  }, [])

  const combined = useMemo(
    () => combineBounds(visible.map((t) => boundsByType[t.type] ?? null)),
    [visible, boundsByType],
  )
  const combinedKey = JSON.stringify(combined)

  return (
    <MapContainer
      center={GUATEMALA_MAP_CENTER}
      zoom={GUATEMALA_MAP_ZOOM}
      className={className}
      zoomControl={false}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="topleft" />
      <ScaleControl position="bottomright" />
      <FitController combined={combined} combinedKey={combinedKey} centerToken={centerToken} />
      {visible.map((t) => (
        <TypeLayer
          key={t.type}
          type={t.type}
          icon={t.icon}
          accentColor={t.accentColor}
          since={since}
          selectedEventId={selectedEventId}
          onSelect={onSelect}
          onReady={onLayerReady}
          onBounds={reportBounds}
        />
      ))}
    </MapContainer>
  )
}
