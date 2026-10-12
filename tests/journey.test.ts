import assert from 'node:assert/strict'
import { japanTrip } from '../src/data'
import { nextJourneyAction, resolveTripDay, tripHref } from '../src/journey'
import { useApp } from '../src/store'
import { nearbyOrder, scheduleConflicts } from '../src/planOrdering'
import { createSyncSnapshot } from '../src/syncClient'
import { isSyncSnapshot } from '../src/syncSchema'
import { tripHotelStays } from '../src/bookingLinks'
import { itineraryExport } from '../src/tripExport'
import { mapsNavigateUrl } from '../src/geo'
import { validateSnapshot } from '../server/snapshot-store.mjs'
import type { PlaceStop } from '../src/types'

const trip = japanTrip()
assert.equal(resolveTripDay(trip, trip.days[3].id, trip.days[1].id)?.id, trip.days[3].id)
assert.equal(resolveTripDay(trip, trip.days[3].date, null)?.id, trip.days[3].id)
assert.equal(resolveTripDay(trip, 'missing', 'deleted', trip.days[2].date)?.id, trip.days[2].id)
assert.equal(resolveTripDay({ ...trip, days: [] }), undefined)
assert.equal(tripHref('trip', 'map', 'day with spaces', 'place'), '/trip/trip/map?day=day+with+spaces&place=place')
assert.equal(nextJourneyAction(trip, trip.days[3].date).kind, 'today')
const empty = { ...trip, days: trip.days.map((day) => ({ ...day, planA: [], planB: [] })), bookings: [], expenses: [] }
assert.equal(nextJourneyAction(empty, '2026-09-01').day?.id, empty.days[0].id)
assert.equal(nextJourneyAction(empty, '2026-10-10').kind, 'journal')
const filled = { ...trip, bookings: [], expenses: [], days: trip.days.map((day) => ({ ...day, stay: '', planA: day.planA.length ? day.planA : [trip.days[0].planA[0]], activePlan: 'A' as const })) }
assert.equal(nextJourneyAction(filled, '2026-09-01').kind, 'stay')
assert.equal(nextJourneyAction({ ...filled, days: filled.days.map((day) => ({ ...day, stay: 'Hotel' })), bookings: [{ id: 'pending', kind: 'hotel', name: 'Hotel', status: 'need' }] }, '2026-09-01').kind, 'book')

const previous = useApp.getState().trips
try {
  useApp.setState({ trips: [{ ...trip, id: 'flow-test', bookings: [], compares: [], saved: [
    { id: 'restaurant', kind: 'restaurant', name: 'Dinner', status: 'chosen', votes: {} },
    { id: 'hotel', kind: 'hotel', name: 'Hotel', status: 'chosen', votes: {} },
  ], days: trip.days.map((day) => ({ ...day, stay: '', stayBookingId: undefined, planA: [], planB: [] })) }] })
  const state = useApp.getState()
  const getTrip = () => useApp.getState().trips[0]
  const dayId = trip.days[0].id
  const stopId = state.scheduleSaved('flow-test', 'restaurant', dayId, '19:00')
  assert.ok(stopId)
  assert.equal(state.scheduleSaved('flow-test', 'restaurant', dayId, '19:00'), stopId, 'Repeated scheduling retains one stop')
  assert.equal(getTrip().days[0].planA.length, 1)
  assert.equal(state.scheduleSaved('flow-test', 'restaurant', dayId, '25:99'), null)
  state.addBooking('flow-test', { kind: 'restaurant', name: 'Dinner', status: 'booked', date: trip.days[0].date, sourceSavedId: 'restaurant' })
  const bookingId = getTrip().bookings[0].id
  assert.equal(getTrip().days[0].planA[0].bookingId, bookingId)
  assert.equal(getTrip().days[0].planA[0].booked, true)
  assert.equal(getTrip().saved[0].status, 'booked')
  state.updateBooking('flow-test', bookingId, { status: 'cancelled' })
  assert.equal(getTrip().days[0].planA[0].booked, false)
  assert.equal(getTrip().saved[0].status, 'chosen')
  state.updateBooking('flow-test', bookingId, { status: 'paid' })
  state.updateBooking('flow-test', bookingId, { date: trip.days[1].date })
  assert.equal(getTrip().days[0].planA[0].booked, false, 'Moved reservation no longer confirms the previous day')
  state.updateBooking('flow-test', bookingId, { date: trip.days[0].date })
  const snapshot = createSyncSnapshot(useApp.getState().profile, [getTrip()])
  assert.equal(snapshot.trips[0].days[0].planA[0].sourceSavedId, 'restaurant')
  assert.equal(snapshot.trips[0].days[0].planA[0].bookingId, bookingId)
  assert.equal(isSyncSnapshot(snapshot), true)
  assert.deepEqual(validateSnapshot(snapshot), snapshot, 'Browser and server preserve booking links')
  state.removeBooking('flow-test', bookingId)
  assert.equal(getTrip().days[0].planA[0].booked, false)
  assert.equal(getTrip().days[0].planA[0].bookingId, undefined)
  assert.equal(getTrip().saved[0].status, 'chosen')
  const hotelId = state.scheduleSaved('flow-test', 'hotel', dayId, '', trip.days[2].date)
  assert.ok(hotelId)
  assert.equal(state.scheduleSaved('flow-test', 'hotel', dayId, '', trip.days[2].date), hotelId)
  assert.equal(getTrip().bookings.length, 1)
  assert.deepEqual(getTrip().days.slice(0, 3).map((day) => day.stay), ['Hotel', 'Hotel', ''])
  const stays = tripHotelStays(getTrip())
  assert.equal(stays[0].checkout, trip.days[2].date, 'Hotel search dates stop when the planned accommodation ends')
  assert.equal(stays[1].stay, '')
  const hotelSnapshot = createSyncSnapshot(useApp.getState().profile, [getTrip()])
  assert.equal(hotelSnapshot.trips[0].days[0].stayBookingId, hotelId)
  assert.deepEqual(validateSnapshot(hotelSnapshot), hotelSnapshot)
  state.updateBooking('flow-test', hotelId!, { date: trip.days[1].date, checkout: trip.days[3].date })
  assert.deepEqual(getTrip().days.slice(0, 4).map((day) => day.stay), ['', 'Hotel', 'Hotel', ''])
  state.updateBooking('flow-test', hotelId!, { status: 'cancelled' })
  assert.ok(getTrip().days.every((day) => !day.stay))
  assert.equal(state.scheduleSaved('flow-test', 'hotel', dayId, '', '2027-01-01'), null)
} finally { useApp.setState({ trips: previous }) }

function place(id: string, lat: number, patch: Partial<PlaceStop> = {}): PlaceStop { return { id, name: id, category: '景点', setting: 'outdoor', coords: { lat, lng: 0 }, ...patch } }
const stops = [place('start', 0, { time: '09:00', booked: true }), place('far', 3, { time: '10:00' }), place('near', 1, { time: '11:00' }), place('middle', 2, { time: '12:00' }), place('appointment', 4, { time: '15:00', booked: true }), place('photo', 5, { photos: ['photo'] })]
const optimized = nearbyOrder(stops)
assert.deepEqual(optimized.map((stop) => stop.id), ['start', 'near', 'middle', 'far', 'appointment', 'photo'])
assert.deepEqual(optimized.map((stop) => stop.time), stops.map((stop) => stop.time), 'Time slots and appointment times are retained')
assert.deepEqual(optimized[4], stops[4])
assert.deepEqual(optimized[5], stops[5])
assert.equal(stops[1].id, 'far', 'Preview does not mutate the itinerary')
assert.equal(scheduleConflicts([place('long', 0, { time: '09:00', durationMin: 120 }), place('soon', 0, { time: '10:00' })])[0].id, 'soon')
assert.equal(scheduleConflicts([place('a', 0, { time: '09:00' }), place('b', 0, { time: '11:00' })]).length, 0)
console.log('Journey context, actions, booking links, scheduling, sync and protected ordering tests passed')

const shared = itineraryExport({ ...trip, notes: 'private', days: trip.days.map((day) => ({ ...day, notes: 'private day', planA: day.planA.map((place) => ({ ...place, photos: ['private photo'], feeling: 'private feeling', notes: 'private note' })) })), bookings: [{ id: 'secret', kind: 'hotel', name: 'Hotel', status: 'paid', confirmation: 'CONFIRMATION', notes: 'private order', cost: { amount: 999, currency: 'AUD' } }] })
assert.equal(shared.trips[0].notes, '')
assert.equal(shared.trips[0].bookings[0].confirmation, undefined)
assert.equal(shared.trips[0].bookings[0].cost, undefined)
assert.deepEqual(shared.trips[0].expenses, [])
assert.ok(shared.trips[0].days.every((day) => day.planA.every((place) => !place.photos && !place.feeling && !place.notes)))
const sharedSnapshot = { schemaVersion: 1, profile: { name: 'Recipient', homeCity: 'Melbourne', homeCurrency: 'AUD', themePref: 'cream', locale: 'zh' }, trips: shared.trips }
assert.equal(isSyncSnapshot(JSON.parse(JSON.stringify(sharedSnapshot)), { allowLocalFields: true }), true)
assert.ok(mapsNavigateUrl('Museum', undefined, 'cycling').includes('travelmode=bicycling'))
console.log('Share export privacy, import compatibility and navigation links passed')
