import type { Trip } from './types'
import { eachDate } from './lib'
import { confirmedBooking } from './bookingLinkage'

/** Checkout is exclusive. Count each night once, including overlapping hotel bookings. */
export function stayCoverage(trip: Trip) {
  const nights = eachDate(trip.startDate, trip.endDate).slice(0, -1)
  const hotels = trip.bookings.filter((booking) => booking.kind === 'hotel' && confirmedBooking(booking))
  const valid = hotels.filter((booking) => booking.date && booking.checkout && booking.date < booking.checkout)
  const missing = nights.filter((date) => !valid.some((booking) => date >= booking.date! && date < booking.checkout!))
  return { total: nights.length, done: nights.length - missing.length, missing,
    undated: hotels.filter((booking) => !valid.includes(booking)).map((booking) => booking.name) }
}
