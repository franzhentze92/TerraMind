import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { NewsDocumentListItemDto } from '../types/news-dto.types'
import { MAPPABLE_STATUSES } from '../presentation/news-map-policy'

const GUATEMALA_CENTER: [number, number] = [15.5, -90.25]
const GUATEMALA_BOUNDS: [[number, number], [number, number]] = [
  [13.6, -92.3],
  [17.9, -88.1],
]

const STATUS_COLOR: Record<string, string> = {
  localizada: '#0ea5e9',
  ubicacion_aproximada: '#6366f1',
  varias_ubicaciones: '#f59e0b',
}

function markerIcon(status: string, selected: boolean) {
  const color = STATUS_COLOR[status] ?? '#6366f1'
  const size = selected ? 22 : 16
  const ring = selected ? '0 0 0 4px rgba(14,165,233,.35)' : '0 0 0 1px rgba(0,0,0,.25)'
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:${ring}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sin fecha'
  return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

function FitToMarkers({ points, regional }: { points: Array<[number, number]>; regional: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (regional) {
      map.setView(GUATEMALA_CENTER, 6)
      return
    }
    if (points.length === 0) {
      map.fitBounds(GUATEMALA_BOUNDS, { padding: [20, 20] })
      return
    }
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 })
  }, [map, points, regional])
  return null
}

interface NewsDocumentsMapProps {
  documents: NewsDocumentListItemDto[]
  selectedId?: string | null
  onSelect?: (doc: NewsDocumentListItemDto) => void
  regional?: boolean
}

export function NewsDocumentsMap({ documents, selectedId, onSelect, regional = false }: NewsDocumentsMapProps) {
  const mappable = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.primary_location?.latitude != null &&
          d.primary_location?.longitude != null &&
          MAPPABLE_STATUSES.has(d.geographic_status),
      ),
    [documents],
  )
  const points = useMemo<Array<[number, number]>>(
    () => mappable.map((d) => [d.primary_location!.latitude!, d.primary_location!.longitude!]),
    [mappable],
  )

  const nationalCount = documents.filter((d) => d.geographic_status === 'nacional').length
  const internationalCount = documents.filter((d) => d.geographic_status === 'internacional').length
  const noLocationCount = documents.filter((d) => d.geographic_status === 'sin_ubicacion').length
  const hiddenCount = nationalCount + internationalCount + noLocationCount

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2 text-xs text-text-secondary">
        Los marcadores representan noticias publicadas, no hechos confirmados ni amenazas.
      </p>
      <div className="h-[460px] overflow-hidden rounded-xl border border-border-subtle">
        <MapContainer
          center={GUATEMALA_CENTER}
          zoom={7}
          minZoom={5}
          maxZoom={13}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToMarkers points={points} regional={regional} />
          {mappable.map((doc) => (
            <Marker
              key={doc.id}
              position={[doc.primary_location!.latitude!, doc.primary_location!.longitude!]}
              icon={markerIcon(doc.geographic_status, doc.id === selectedId)}
              eventHandlers={{ click: () => onSelect?.(doc) }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-gray-600">
                    {doc.source_name} · {doc.geographic_status_label}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(doc.published_at)}</p>
                  <button
                    type="button"
                    onClick={() => onSelect?.(doc)}
                    className="text-xs text-sky-700 underline"
                  >
                    Ver detalle en el panel
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Punto localizado
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Cobertura departamental
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} /> Varias ubicaciones
        </span>
      </div>
      {hiddenCount > 0 && (
        <p className="text-xs text-text-tertiary">
          {hiddenCount} noticia{hiddenCount === 1 ? '' : 's'} no se muestra
          {hiddenCount === 1 ? '' : 'n'} en el mapa por ser nacionales, internacionales o no tener
          ubicación suficiente.
        </p>
      )}
    </div>
  )
}
