import type { Coords, PlaceStop, TransportMode } from './types'
import { estimateMinutes, haversineKm } from './lib'
import { RequestCache } from './requestCache'

type GeoHit = { lat: number; lng: number; address: string }
export type PlaceSearchHit = { display_name: string; lat: string; lon: string }

const geoCache = new RequestCache<GeoHit>({ ttlMs: 7 * 24 * 60 * 60 * 1000, maxEntries: 400 })
const searchCache = new RequestCache<PlaceSearchHit[]>({ ttlMs: 15 * 60 * 1000, maxEntries: 120 })

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
  try {
    const parsed = new URL(url || '')
    const allowed = ['klook.com', 'getyourguide.com', 'tiqets.com', 'trip.com']
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && allowed.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))) return parsed.href
  } catch { /* use the fixed search URL */ }
  return ticketSearchUrl(name, city)
}

export async function geocodePlace(query: string): Promise<GeoHit | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  try {
    return await geoCache.getOrCreate(key, async () => {
      const photon = await fromPhoton(query)
      const hit = photon || (await fromNominatim(query))
      if (!hit) throw new Error('place not found')
      return hit
    })
  } catch {
    return null
  }
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

export async function searchPlaces(query: string, city = '', signal?: AbortSignal): Promise<PlaceSearchHit[]> {
  const input = query.trim()
  if (!input) return []
  const scoped = city.trim() ? `${input}, ${city.trim()}` : input
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(scoped)}`
  return searchCache.getOrCreate(url, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Geocoding API ${res.status}`)
    const data: unknown = await res.json()
    if (!Array.isArray(data)) throw new Error('Invalid geocoding response')
    return data.flatMap((value): PlaceSearchHit[] => {
      if (!value || typeof value !== 'object') return []
      const item = value as Record<string, unknown>
      const lat = typeof item.lat === 'string' ? Number(item.lat) : NaN
      const lon = typeof item.lon === 'string' ? Number(item.lon) : NaN
      if (typeof item.display_name !== 'string' || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) return []
      return [{ display_name: item.display_name, lat: item.lat as string, lon: item.lon as string }]
    }).slice(0, 5)
  }, signal)
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
  concurrency = 4,
): Promise<T[]> {
  if (!places.length) return []
  const out = new Array<T>(places.length)
  const limit = Math.min(8, Math.max(1, Number.isFinite(concurrency) ? Math.floor(concurrency) : 1), places.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < places.length) {
      const index = cursor++
      out[index] = await ensurePlaceGeo(city, places[index])
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return out
}

export type HopRoute = {
  mode: TransportMode
  minutes: number
  km: number
  geometry: [number, number][]
  source: 'osrm' | 'estimate'
}

type OsrmRoute = Pick<HopRoute, 'minutes' | 'km' | 'geometry'>

const routeCache = new RequestCache<OsrmRoute>({ ttlMs: 30 * 60 * 1000, maxEntries: 500 })

function osrmProfile(mode: TransportMode): 'driving' | 'walking' | 'cycling' {
  if (mode === 'walking') return 'walking'
  if (mode === 'cycling') return 'cycling'
  return 'driving'
}

export async function routeHop(a: Coords, b: Coords, mode: TransportMode = 'public'): Promise<HopRoute> {
  const profile = osrmProfile(mode)
  const key = `${profile}:${a.lat.toFixed(5)},${a.lng.toFixed(5)}:${b.lat.toFixed(5)},${b.lng.toFixed(5)}`
  try {
    const route = await routeCache.getOrCreate(key, async () => {
      const url = `https://router.project-osrm.org/route/v1/${profile}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Route API ${res.status}`)
      const data = await res.json()
      const r = data.routes?.[0]
      if (!r || !Number.isFinite(r.duration) || !Number.isFinite(r.distance) || !Array.isArray(r.geometry?.coordinates)) throw new Error('Invalid route response')
      return {
        minutes: Math.max(1, Math.round(r.duration / 60)),
        km: Math.round((r.distance / 1000) * 10) / 10,
        geometry: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
      }
    })
    return { ...route, mode, minutes: mode === 'public' ? Math.max(1, Math.round(route.minutes * 1.35)) : route.minutes, source: 'osrm' }
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
  return hop
}
