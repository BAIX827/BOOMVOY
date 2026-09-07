import type { PlaceStop } from './types'
import { uid } from './lib'
import { samePlace } from './recommendation'

export type RecommendationMode = 'append' | 'replace'
export type RecommendationUndo = { before: PlaceStop[]; after: string }
export type RecommendationApplyResult =
  | { ok: true; count: number; undo: RecommendationUndo }
  | { ok: false; reason: 'changed' | 'protected' | 'empty' }

export function planFingerprint(places: PlaceStop[]) {
  return JSON.stringify(places)
}

export function hasTravelRecord(places: PlaceStop[]) {
  return places.some((place) => place.booked || place.checkedIn || place.checkedInAt || place.photos?.length || place.feeling)
}

/** Prepare one immutable update; the store checks the preview revision before committing it. */
export function prepareRecommendation(current: PlaceStop[], incoming: Omit<PlaceStop, 'id'>[], mode: RecommendationMode): PlaceStop[] {
  const unique = incoming.filter((place, index) => !incoming.slice(0, index).some((other) => samePlace(place, other)))
  if (mode === 'append') {
    const additions = unique.filter((place) => !current.some((other) => samePlace(place, other))).map((place) => ({ ...place, id: uid() }))
    const retained = [...current]
    const transport = additions[0]?.transportToNext
    if (retained.length && transport !== undefined) {
      const lastIndex = retained.length - 1
      retained[lastIndex] = { ...retained[lastIndex], transportToNext: transport }
    }
    return [...retained, ...additions]
  }
  return unique.map((place) => {
    const previous = current.find((other) => samePlace(place, other))
    return {
      ...previous,
      ...place,
      id: previous?.id || uid(),
      notes: previous?.notes || place.notes,
      cost: previous?.cost || place.cost,
    }
  })
}
