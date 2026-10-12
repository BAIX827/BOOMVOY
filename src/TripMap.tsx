import { useEffect, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import type { Coords } from './types'
import 'leaflet/dist/leaflet.css'

export type MapStop = { id: string; name: string; time?: string; coords: Coords; color: string; checkedIn?: boolean; feeling?: string; number?: string }
export type MapLine = { id: string; color: string; pts: [number, number][]; estimated?: boolean }

function Fit({ points }: { points: Coords[] }) {
  const map = useMap()
  const fingerprint = points.map((point) => `${point.lat},${point.lng}`).join('|')
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points.map((point) => [point.lat, point.lng] as [number, number]), { padding: [36, 36] })
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13)
  }, [map, fingerprint])
  return null
}

function Focus({ stop }: { stop?: MapStop }) {
  const map = useMap()
  useEffect(() => { if (stop) map.panTo([stop.coords.lat, stop.coords.lng], { animate: false }) }, [map, stop?.id, stop?.coords.lat, stop?.coords.lng])
  return null
}

function stopIcon(stop: MapStop, selected: boolean, offset: [number, number]) {
  const wrapper = document.createElement('span')
  const element = document.createElement('span')
  element.className = `map-stop-label${selected ? ' is-selected' : ''}${stop.checkedIn ? ' is-checked' : ''}`
  element.textContent = stop.number || (stop.checkedIn ? '✓' : '•')
  element.style.backgroundColor = stop.color
  if (offset[0] || offset[1]) {
    const leader = document.createElement('span')
    leader.className = 'map-stop-leader'
    leader.style.width = `${Math.hypot(...offset)}px`
    leader.style.backgroundColor = stop.color
    leader.style.transform = `rotate(${Math.atan2(-offset[1], -offset[0])}rad)`
    wrapper.append(leader)
  }
  wrapper.append(element)
  return divIcon({ html: wrapper, className: 'map-stop-icon', iconSize: [36, 36], iconAnchor: [18 - offset[0], 18 - offset[1]], popupAnchor: [offset[0], offset[1] - 18] })
}

function Stops({ stops, selectedId, onSelect }: { stops: MapStop[]; selectedId?: string; onSelect?: (id: string) => void }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useEffect(() => { const update = () => setZoom(map.getZoom()); map.on('zoomend', update); return () => { map.off('zoomend', update) } }, [map])
  const occupied: Array<{ x: number; y: number }> = []
  return <>{stops.map((stop) => {
    const point = map.project([stop.coords.lat, stop.coords.lng], zoom)
    let offset: [number, number] = [0, 0]
    const collides = (x: number, y: number) => occupied.some((previous) => Math.hypot(previous.x - x, previous.y - y) < 42)
    if (collides(point.x, point.y)) {
      outer: for (let ring = 1; ring <= 8; ring++) for (let direction = 0; direction < 8; direction++) {
        const angle = direction * Math.PI / 4
        const candidate: [number, number] = [Math.cos(angle) * ring * 44, Math.sin(angle) * ring * 44]
        if (!collides(point.x + candidate[0], point.y + candidate[1])) { offset = candidate; break outer }
      }
    }
    occupied.push({ x: point.x + offset[0], y: point.y + offset[1] })
    return <Marker key={stop.id} position={[stop.coords.lat, stop.coords.lng]} icon={stopIcon(stop, stop.id === selectedId, offset)} title={`${stop.number || ''} ${stop.name}`} eventHandlers={{ click: () => onSelect?.(stop.id) }}>
      <Popup><div className="text-sm"><strong>{stop.number ? `${stop.number}. ` : ''}{stop.name}</strong>{stop.time && <div>{stop.time}</div>}{stop.checkedIn && <div>{stop.feeling || '✓'}</div>}</div></Popup>
    </Marker>
  })}</>
}

function Direction({ line }: { line: MapLine }) {
  if (line.pts.length < 2) return null
  const index = Math.max(1, Math.floor(line.pts.length / 2))
  const a = line.pts[index - 1], b = line.pts[index]
  const angle = Math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * Math.cos((a[0] + b[0]) * Math.PI / 360)) * 180 / Math.PI
  const element = document.createElement('span')
  element.className = 'map-route-arrow'
  element.textContent = '➤'
  element.style.color = line.color
  element.style.transform = `rotate(${angle}deg)`
  const icon = divIcon({ html: element, className: 'map-arrow-icon', iconSize: [24, 24], iconAnchor: [12, 12] })
  return <Marker position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]} icon={icon} interactive={false} keyboard={false} zIndexOffset={-1000} />
}

export default function TripMap({ stops, lines = [], empty, selectedId, onSelect }: { stops: MapStop[]; lines?: MapLine[]; empty: string; selectedId?: string; onSelect?: (id: string) => void }) {
  if (!stops.length) return <div className="grid h-[420px] place-items-center p-5 text-center text-sm" style={{ color: 'var(--muted)' }}>{empty}</div>
  const center = stops[0].coords
  return <MapContainer center={[center.lat, center.lng]} zoom={12} className="trip-leaflet" scrollWheelZoom>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Fit points={stops.map((stop) => stop.coords)} />
    <Focus stop={stops.find((stop) => stop.id === selectedId)} />
    {lines.map((line) => <Polyline key={line.id} positions={line.pts} pathOptions={{ color: line.color, weight: 4, opacity: 0.85, dashArray: line.estimated ? '6 8' : undefined }} />)}
    {lines.map((line) => <Direction key={`direction-${line.id}`} line={line} />)}
    <Stops stops={stops} selectedId={selectedId} onSelect={onSelect} />
  </MapContainer>
}
