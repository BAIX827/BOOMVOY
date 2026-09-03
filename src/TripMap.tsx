import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import type { Coords } from './types'
import 'leaflet/dist/leaflet.css'

export type MapStop = {
  id: string
  name: string
  time?: string
  coords: Coords
  color: string
  checkedIn?: boolean
  feeling?: string
}

export type MapLine = {
  id: string
  color: string
  pts: [number, number][]
}

function Fit({ points }: { points: Coords[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [36, 36] },
      )
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
    }
  }, [map, points])
  return null
}

export default function TripMap({
  stops,
  lines = [],
  empty,
}: {
  stops: MapStop[]
  lines?: MapLine[]
  empty: string
}) {
  if (!stops.length) {
    return (
      <div className="grid h-[420px] place-items-center text-sm" style={{ color: 'var(--muted)' }}>
        {empty}
      </div>
    )
  }
  const center = stops[0].coords
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={12} className="trip-leaflet" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit points={stops.map((s) => s.coords)} />
      {lines.map((l) => (
        <Polyline key={l.id} positions={l.pts} pathOptions={{ color: l.color, weight: 4, opacity: 0.85 }} />
      ))}
      {stops.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.coords.lat, s.coords.lng]}
          radius={s.checkedIn ? 10 : 7}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: s.checkedIn ? '#c47a3a' : s.color,
            fillOpacity: 1,
          }}
        >
          <Popup>
            <div className="text-sm">
              <strong>{s.name}</strong>
              {s.time ? <div>{s.time}</div> : null}
              {s.checkedIn ? <div>{s.feeling || '✓'}</div> : null}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
