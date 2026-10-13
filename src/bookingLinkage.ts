import { savedBookingCost } from './savedPricing'
import type { Booking, DayPlan, Trip } from './types'

export const confirmedBooking = (booking: Booking) => booking.status === 'booked' || booking.status === 'paid'
const activeBooking = (booking: Booking) => booking.status !== 'cancelled' && booking.status !== 'refunded'
const coversDay = (booking: Booking, day: DayPlan) => booking.kind === 'hotel'
  ? Boolean(booking.date && booking.checkout && day.date >= booking.date && day.date < booking.checkout)
  : booking.date === day.date

/** Reconcile only explicit links; unrelated manually entered travel records are retained. */
export function reconcileBookingLinks(trip: Trip): Trip {
  trip = { ...trip, bookings: trip.bookings.map((booking) => {
    const item = trip.saved.find((saved) => saved.id === booking.sourceSavedId)
    if (!item || booking.status !== 'need') return booking
    const auto = booking.costFromSaved === true || !booking.cost && booking.costFromSaved !== false
    const cost = auto ? savedBookingCost(item, booking.date, booking.checkout) : booking.cost
    const changed = JSON.stringify(cost) !== JSON.stringify(booking.cost)
    return { ...booking, name: item.name, url: item.url, cost, costFromSaved: auto, ...(changed ? { homeAmount: undefined, exchangeRate: undefined } : {}) }
  }) }
  const saved = trip.saved.map((item) => {
    const bookings = trip.bookings.filter((booking) => booking.sourceSavedId === item.id)
    if (!bookings.length) return item
    return { ...item, status: bookings.some(confirmedBooking) ? 'booked' as const : item.status === 'booked' ? 'chosen' as const : item.status }
  })
  const days = trip.days.map((day) => {
    const patchPlan = (places: DayPlan['planA']) => places.map((place) => {
      if (!place.bookingId && !place.sourceSavedId) return place
      const explicit = place.bookingId ? trip.bookings.find((item) => item.id === place.bookingId) : undefined
      const matching = trip.bookings.filter((item) => place.sourceSavedId && item.sourceSavedId === place.sourceSavedId && activeBooking(item) && coversDay(item, day))
      const booking = explicit && activeBooking(explicit) && coversDay(explicit, day) ? explicit
        : matching.find(confirmedBooking) || matching[0] || explicit
      return { ...place, bookingId: booking?.id, booked: booking ? confirmedBooking(booking) && coversDay(booking, day) : false }
    })
    const oldStay = day.stayBookingId ? trip.bookings.find((booking) => booking.id === day.stayBookingId) : undefined
    const hotel = trip.bookings.find((booking) => booking.kind === 'hotel' && booking.sourceSavedId && activeBooking(booking) && coversDay(booking, day))
    const stay = oldStay && activeBooking(oldStay) && coversDay(oldStay, day) ? oldStay : hotel
    const managed = Boolean(day.stayBookingId) || !day.stay
    return { ...day, planA: patchPlan(day.planA), planB: patchPlan(day.planB),
      ...(managed ? { stay: stay?.name || '', stayBookingId: stay?.id } : {}),
    }
  })
  return { ...trip, saved, days }
}
