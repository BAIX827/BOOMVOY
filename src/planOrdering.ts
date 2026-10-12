import type { PlaceStop } from './types'
import { haversineKm, nearestNeighbor, estimateMinutes } from './lib'
import { hasTravelRecord } from './recommendationApplication'

/** Sort only between protected anchors, reusing each slot's time. */
export function nearbyOrder(places: PlaceStop[]): PlaceStop[] {
  const result = [...places]
  let start = 0
  while (start < places.length) {
    if (!places[start].coords || hasTravelRecord([places[start]])) { start += 1; continue }
    let end = start
    while (end < places.length && places[end].coords && !hasTravelRecord([places[end]])) end += 1
    const segment = places.slice(start, end)
    const anchor = start > 0 && places[start - 1].coords ? places[start - 1] : undefined
    const sorted = anchor ? nearestNeighbor([anchor, ...segment]).slice(1) : nearestNeighbor(segment)
    sorted.forEach((place, index) => { result[start + index] = { ...place, time: segment[index].time } })
    start = end
  }
  return result
}

export function scheduleConflicts(places: PlaceStop[]) {
  const minutes = (time?: string) => time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : undefined
  return places.slice(1).filter((next, index) => {
    const previous = places[index]
    const arrival = minutes(previous.time), nextArrival = minutes(next.time)
    if (arrival === undefined || nextArrival === undefined) return false
    const travel = previous.coords && next.coords ? estimateMinutes(haversineKm(previous.coords, next.coords), previous.transportToNext || 'public') : 0
    return arrival + (previous.durationMin || 60) + travel > nextArrival
  })
}
