import type { Coords, PlaceStop, TransportMode } from './types'
import { estimateMinutes, haversineKm } from './lib'

const geoCache = new Map<string, { lat: number; lng: number; address: string } | null>()

export function mapsPlaceUrl(name: string, coords?: Coords) {
  if (coords) return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
}

export function mapsDirUrl(a: Coords, b: Coords, mode: TransportMode = 'public') {
  const travelmode = mode === 'walking' ? 'walking' : mode === 'self-drive' || mode === 'taxi' ? 'driving' : 'transit'
  return `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=${travelmode}`
}

export function mapsDayRoute(places: Array<{ name: string; coords?: Coords }>) {
  const pts = places.filter((p) => p.coords)
  if (!pts.length) return ''
  if (pts.length === 1) return mapsPlaceUrl(pts[0].name, pts[0].coords)
  return `https://www.google.com/maps/dir/${pts.map((p) => `${p.coords!.lat},${p.coords!.lng}`).join('/')}`
}

export function ticketSearchUrl(name: string, city: string) {
  return `https://www.klook.com/en-AU/search/?query=${encodeURIComponent(`${name} ${city}`)}`
}

function cleanTicketUrl(needed: boolean | undefined, url: string | undefined, name: string, city: string) {
  if (!needed) return undefined
  if (url && /^https?:\/\//i.test(url) && /klook\.com|getyourguide\.com|tiqets\.com|trip\.com/i.test(url)) return url
  return ticketSearchUrl(name, city)
}

export async function geocodePlace(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const key = query.trim().toLowerCase()
  if (geoCache.has(key)) return geoCache.get(key) || null
  const photon = await fromPhoton(query)
  const hit = photon || (await fromNominatim(query))
  geoCache.set(key, hit)
  return hit
}

async function fromPhoton(query: string) {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    const f = data.features?.[0]
    if (!f?.geometry?.coordinates) return null
    const [lng, lat] = f.geometry.coordinates as [number, number]
    const p = f.properties || {}
    const address = [p.name, p.street, p.city || p.state, p.country].filter(Boolean).join(', ')
    return { lat, lng, address: address || query }
  } catch {
    return null
  }
}

async function fromNominatim(query: string) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const h = data[0]
    if (!h) return null
    return { lat: Number(h.lat), lng: Number(h.lon), address: String(h.display_name || query) }
  } catch {
    return null
  }
}

function guessTransport(km: number): TransportMode {
  if (km < 1.2) return 'walking'
  if (km < 8) return 'public'
  return 'taxi'
}

export async function enrichStops(city: string, places: Omit<PlaceStop, 'id'>[]): Promise<Omit<PlaceStop, 'id'>[]> {
  const out: Omit<PlaceStop, 'id'>[] = []
  for (const pl of places) {
    let coords = pl.coords
    let address = pl.address
    if (!coords) {
      const g = await geocodePlace(`${pl.name}, ${city}`)
      if (g) {
        coords = { lat: g.lat, lng: g.lng }
        address = g.address
      }
    }
    out.push({
      ...pl,
      coords,
      address,
      ticketNeeded: pl.ticketNeeded || undefined,
      ticketUrl: cleanTicketUrl(pl.ticketNeeded, pl.ticketUrl, pl.name, city),
      transportToNext: pl.transportToNext || 'public',
    })
  }
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i]
    const b = out[i + 1]
    if (a.coords && b.coords) {
      const km = haversineKm(a.coords, b.coords)
      if (!places[i].transportToNext) a.transportToNext = guessTransport(km)
    }
  }
  return out
}

export function hopMeta(a: { coords?: PlaceStop['coords']; transportToNext?: TransportMode }, b: { coords?: PlaceStop['coords'] }) {
  if (!a.coords || !b.coords) return null
  const km = haversineKm(a.coords, b.coords)
  const mode = a.transportToNext || 'public'
  return {
    km,
    minutes: estimateMinutes(km, mode),
    mode,
    url: mapsDirUrl(a.coords, b.coords, mode),
  }
}

export async function ensurePlaceGeo<T extends { name: string; coords?: PlaceStop['coords']; address?: string }>(
  city: string,
  place: T,
): Promise<T> {
  if (place.coords) return place
  const g = await geocodePlace(`${place.name}, ${city}`)
  if (!g) return place
  return { ...place, coords: { lat: g.lat, lng: g.lng }, address: place.address || g.address }
}

export async function ensurePlacesGeo<T extends { name: string; coords?: PlaceStop['coords']; address?: string }>(
  city: string,
  places: T[],
): Promise<T[]> {
  const out: T[] = []
  for (const place of places) out.push(await ensurePlaceGeo(city, place))
  return out
}

export type HopRoute = {
  mode: TransportMode
  minutes: number
  km: number
  geometry: [number, number][]
  source: 'osrm' | 'estimate'
}

const routeCache = new Map<string, HopRoute>()

function osrmProfile(mode: TransportMode): 'driving' | 'walking' | 'cycling' {
  if (mode === 'walking') return 'walking'
  if (mode === 'cycling') return 'cycling'
  return 'driving'
}

export async function routeHop(a: Coords, b: Coords, mode: TransportMode = 'public'): Promise<HopRoute> {
  const key = `${mode}:${a.lat.toFixed(5)},${a.lng.toFixed(5)}:${b.lat.toFixed(5)},${b.lng.toFixed(5)}`
  const hit = routeCache.get(key)
  if (hit) return hit
  const profile = osrmProfile(mode)
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const r = data.routes?.[0]
      if (r) {
        let minutes = Math.max(1, Math.round(r.duration / 60))
        if (mode === 'public') minutes = Math.round(minutes * 1.35)
        const hop: HopRoute = {
          mode,
          minutes,
          km: Math.round((r.distance / 1000) * 10) / 10,
          geometry: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
          source: 'osrm',
        }
        routeCache.set(key, hop)
        return hop
      }
    }
  } catch {
    /* fall through to estimate */
  }
  const km = haversineKm(a, b)
  const hop: HopRoute = {
    mode,
    minutes: estimateMinutes(km, mode),
    km: Math.round(km * 10) / 10,
    geometry: [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ],
    source: 'estimate',
  }
  routeCache.set(key, hop)
  return hop
}
