import type { DayPlan, Trip } from './types'
import { toISODate } from './lib'
import { activePlaces, settle } from './domain'

export function resolveTripDay(trip: Trip, requested?: string | null, remembered?: string | null, today = toISODate(new Date())) {
  return trip.days.find((day) => day.id === requested || day.date === requested)
    || trip.days.find((day) => day.id === remembered)
    || trip.days.find((day) => day.date === today)
    || trip.days[0]
}

export function tripHref(tripId: string, section = '', dayId?: string, placeId?: string) {
  const query = new URLSearchParams()
  if (dayId) query.set('day', dayId)
  if (placeId) query.set('place', placeId)
  return `/trip/${encodeURIComponent(tripId)}${section ? `/${section}` : ''}${query.size ? `?${query}` : ''}`
}

export type JourneyAction = { kind: 'today' | 'plan' | 'stay' | 'book' | 'pack' | 'ready' | 'settle' | 'journal'; section: string; day?: DayPlan; count?: number }

export function nextJourneyAction(trip: Trip, today = toISODate(new Date())): JourneyAction {
  const current = trip.days.find((day) => day.date === today)
  if (current) return { kind: 'today', section: 'plan', day: current }
  if (trip.endDate < today) {
    const count = settle(trip).transfers.length
    return count ? { kind: 'settle', section: 'expenses', count } : { kind: 'journal', section: 'journal' }
  }
  const empty = trip.days.filter((day) => !activePlaces(day).length)
  if (empty.length) return { kind: 'plan', section: 'plan', day: empty[0], count: empty.length }
  const missingStay = trip.days.slice(0, -1).filter((day) => !day.stay)
  if (missingStay.length) return { kind: 'stay', section: 'saved', day: missingStay[0], count: missingStay.length }
  const pending = trip.bookings.filter((booking) => booking.status === 'need')
  if (pending.length) return { kind: 'book', section: 'bookings', day: trip.days.find((day) => day.date === pending[0].date), count: pending.length }
  const unpacked = trip.packing?.items.filter((item) => !item.packedOut).length
  if (unpacked === undefined || unpacked > 0) return { kind: 'pack', section: 'pack', count: unpacked }
  return { kind: 'ready', section: 'plan', day: trip.days[0] }
}
