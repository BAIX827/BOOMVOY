import type { DayPlan, Trip } from './types'
import { uid } from './lib'
import { confirmedBooking, reconcileBookingLinks } from './bookingLinkage'

export type ScheduleDraft = { origin: string; startDate: string; endDate: string; cities: { city: string; days: number }[] }
export const validTripDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T12:00:00Z')) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date
export function shiftDate(date: string, offset: number) { return new Date(Date.parse(date + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10) }
export function scheduleDraft(trip: Trip): ScheduleDraft {
  const cities: ScheduleDraft['cities'] = []
  for (const day of trip.days) { const last = cities[cities.length - 1]; if (last?.city === day.city) last.days++; else cities.push({ city: day.city, days: 1 }) }
  return { origin: trip.origin, startDate: trip.startDate, endDate: trip.endDate, cities }
}
const occupied = (day: DayPlan) => day.planA.length || day.planB.length || day.notes?.trim() || day.stay || day.stayBookingId
export function rescheduleTrip(trip: Trip, draft: ScheduleDraft): { ok: false; reason: 'invalid' | 'protected'; dates?: string[] } | { ok: true; trip: Trip; changedCities: string[]; confirmed: string[] } {
  if (!draft.origin.trim() || draft.origin.length > 250 || !validTripDate(draft.startDate) || !validTripDate(draft.endDate) || draft.endDate < draft.startDate) return { ok: false, reason: 'invalid' }
  const count = Math.round((Date.parse(draft.endDate) - Date.parse(draft.startDate)) / 86400000) + 1
  if (count > 730 || !draft.cities.length || draft.cities.length > 100 || draft.cities.some((item) => !item.city.trim() || item.city.length > 250 || !Number.isInteger(item.days) || item.days < 1 || item.days > 730) || draft.cities.reduce((n, item) => n + item.days, 0) !== count) return { ok: false, reason: 'invalid' }
  const removed = trip.days.slice(count).filter(occupied)
  if (removed.length) return { ok: false, reason: 'protected', dates: removed.map((day) => day.date) }
  const cityDays = draft.cities.flatMap((item) => Array<string>(item.days).fill(item.city.trim()))
  const changedCities: string[] = []
  const days = cityDays.map((city, index): DayPlan => {
    const date = shiftDate(draft.startDate, index), previous = trip.days[index]
    if (previous && previous.city !== city && occupied(previous)) changedCities.push(date)
    const changed = !previous || previous.date !== date || previous.city !== city
    return { ...previous, id: previous?.id || uid(), city, date, planA: previous?.planA || [], planB: previous?.planB || [], activePlan: previous?.activePlan || 'A', transportMode: previous?.transportMode || trip.transportModes[0] || 'mixed', weather: changed ? { condition: 'cloudy', tMin: 16, tMax: 24, rainProb: 20, summary: '', source: 'placeholder' } : previous.weather }
  })
  const dateMap = new Map(trip.days.map((day, index) => [day.date, shiftDate(draft.startDate, index)]))
  const offset = Math.round((Date.parse(draft.startDate) - Date.parse(trip.startDate)) / 86400000)
  const confirmed = trip.bookings.filter((booking) => confirmedBooking(booking) && (offset !== 0 || !!booking.date && (booking.date < draft.startDate || booking.date > draft.endDate) || !!booking.checkout && booking.checkout > draft.endDate)).map((booking) => booking.name)
  const bookings = trip.bookings.map((booking) => confirmedBooking(booking) || booking.status !== 'need' ? booking : { ...booking, date: booking.date ? dateMap.get(booking.date) || shiftDate(booking.date, offset) : undefined, checkout: booking.checkout ? shiftDate(booking.checkout, offset) : undefined })
  const next = reconcileBookingLinks({ ...trip, origin: draft.origin.trim(), startDate: draft.startDate, endDate: draft.endDate, destinations: draft.cities.map((item) => item.city.trim()), days, bookings, weatherUpdatedAt: undefined, decisionPreferences: undefined, mealSelections: trip.mealSelections?.map((meal) => ({ ...meal, date: dateMap.get(meal.date) || meal.date, city: days.find((day) => day.date === (dateMap.get(meal.date) || meal.date))?.city || meal.city })) })
  return { ok: true, trip: next, changedCities, confirmed }
}
