import type { Coords, PlaceStop, TransportMode } from './types'
import { normalizePlaceName } from './placeIdentity.mjs'

export { normalizePlaceName } from './placeIdentity.mjs'

export type RecommendationPreferences = {
  pace: 'relaxed' | 'balanced' | 'full'
  startTime: string
  endTime: string
  transportMode: TransportMode
  indoorOnly: boolean
}

export type PlannedPlace = { name: string; date: string; city?: string; coords?: Coords }

export const DEFAULT_RECOMMENDATION_PREFERENCES: RecommendationPreferences = {
  pace: 'balanced', startTime: '09:00', endTime: '19:00', transportMode: 'public', indoorOnly: false,
}

function validCoords(coords?: Coords): coords is Coords {
  return !!coords && Number.isFinite(coords.lat) && Math.abs(coords.lat) <= 90 && Number.isFinite(coords.lng) && Math.abs(coords.lng) <= 180
}

function distance(a: Coords, b: Coords): number {
  const rad = Math.PI / 180
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

export function samePlace(a: { name: string; coords?: Coords }, b: { name: string; coords?: Coords }): boolean {
  const name = normalizePlaceName(a.name)
  if (!name || name !== normalizePlaceName(b.name)) return false
  return !validCoords(a.coords) || !validCoords(b.coords) || distance(a.coords, b.coords) <= 1
}

export function recommendationTravelMinutes(a: { coords?: Coords }, b: { coords?: Coords }, mode: TransportMode): number {
  if (!validCoords(a.coords) || !validCoords(b.coords)) return mode === 'walking' ? 35 : 30
  const km = distance(a.coords, b.coords) * 1.3
  if (km < 0.03) return 0
  if (mode === 'walking' || (mode === 'mixed' && km < 1)) return Math.ceil(km / 4.3 * 60)
  if (mode === 'cycling') return Math.ceil(km / 13 * 60 + 5)
  if (mode === 'taxi' || mode === 'self-drive') return Math.ceil(km / 25 * 60 + 8)
  return Math.ceil(km / 18 * 60 + 12)
}

function minutes(time?: string): number | undefined {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function formatTime(value: number): string {
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}

export function scheduleSuggestion(places: Omit<PlaceStop, 'id'>[], preferences: RecommendationPreferences, anchor?: PlaceStop) {
  const start = minutes(preferences.startTime)
  const end = minutes(preferences.endTime)
  const out: Omit<PlaceStop, 'id'>[] = []
  const empty = { places: out, omitted: places.length, travelMinutes: 0, totalMinutes: 0, distanceKm: 0, unlocated: 0 }
  if (start === undefined || end === undefined || start >= end) return empty
  const pace = { relaxed: { limit: 3, buffer: 15, duration: 75 }, balanced: { limit: 5, buffer: 10, duration: 60 }, full: { limit: 7, buffer: 5, duration: 45 } }[preferences.pace] || { limit: 5, buffer: 10, duration: 60 }
  const anchorDuration = anchor && Number.isFinite(anchor.durationMin) && anchor.durationMin! > 0 ? Math.round(anchor.durationMin!) : 60
  const initial = anchor ? Math.max(start, (minutes(anchor.time) ?? start) + anchorDuration) : start
  let cursor = initial
  let previous: Omit<PlaceStop, 'id'> | undefined = anchor
  let travelMinutes = 0
  let distanceKm = 0
  for (const candidate of places) {
    if (out.length >= pace.limit) break
    if (!candidate.name.trim() || (preferences.indoorOnly && candidate.setting !== 'indoor')) continue
    if ((anchor && samePlace(anchor, candidate)) || out.some((place) => samePlace(place, candidate))) continue
    const travel = previous ? recommendationTravelMinutes(previous, candidate, preferences.transportMode) : 0
    const buffer = previous ? pace.buffer : 0
    const from = Math.max(cursor + travel + buffer, minutes(candidate.time) ?? start)
    const duration = Number.isFinite(candidate.durationMin) && candidate.durationMin! > 0 ? Math.max(15, Math.min(480, Math.round(candidate.durationMin!))) : pace.duration
    if (from + duration > end) continue
    const place = { ...candidate, time: formatTime(from), durationMin: duration, transportToNext: preferences.transportMode }
    out.push(place)
    travelMinutes += travel
    if (validCoords(previous?.coords) && validCoords(place.coords)) distanceKm += distance(previous.coords, place.coords) * 1.3
    previous = place
    cursor = from + duration
  }
  return {
    places: out,
    omitted: places.length - out.length,
    travelMinutes,
    totalMinutes: out.length ? cursor - (anchor ? initial : minutes(out[0].time)!) : 0,
    distanceKm: Math.round(distanceKm * 10) / 10,
    unlocated: out.filter((place) => !validCoords(place.coords)).length,
  }
}
