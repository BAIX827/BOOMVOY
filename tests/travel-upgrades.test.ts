import assert from 'node:assert/strict'
import { japanTrip } from '../src/data'
import { rescheduleTrip, scheduleDraft, shiftDate } from '../src/tripSchedule'
import { reconcileBookingLinks } from '../src/bookingLinkage'
import { settle } from '../src/domain'
import { useApp } from '../src/store'
import { useShared, mergeSharedTrip } from '../src/collaborationState'
import { createSyncSnapshot } from '../src/syncClient'
import { isSyncSnapshot } from '../src/syncSchema'
import { validateSnapshot } from '../server/snapshot-store.mjs'
import { itineraryExport } from '../src/tripExport'
import type { Trip } from '../src/types'

const seed = japanTrip()
const trip: Trip = { ...seed, id: 'upgrade-trip', saved: [], bookings: [], expenses: [], gifts: [], settlements: [], members: [{ id: 'owner', name: 'Ari', role: 'owner', color: '#123456' }, { id: 'bo', name: 'Bo', role: 'editor', color: '#654321' }], days: seed.days.slice(0, 3).map((day) => ({ ...day, stay: '', stayBookingId: undefined, notes: '', planA: [], planB: [] })), endDate: seed.days[2].date }
trip.days[0].planA = [{ id: 'visited', name: 'Temple', category: '景点', setting: 'outdoor', checkedIn: true, photos: ['local-photo'], feeling: 'Memory' }]
trip.bookings = [{ id: 'confirmed', name: 'Flight', kind: 'flight', status: 'paid', date: trip.startDate }, { id: 'pending', name: 'Hotel', kind: 'hotel', status: 'need', date: trip.startDate, checkout: trip.endDate }]
const draft = scheduleDraft(trip), newStart = '2027-01-10'
const moved = rescheduleTrip(trip, { ...draft, startDate: newStart, endDate: shiftDate(newStart, 2) })
assert.ok(moved.ok)
assert.equal(moved.trip.days[0].id, trip.days[0].id)
assert.deepEqual(moved.trip.days[0].planA, trip.days[0].planA, 'Date changes preserve photos, check-ins and IDs')
assert.equal(moved.trip.days[0].weather.source, 'placeholder')
assert.equal(moved.trip.bookings[0].date, trip.startDate, 'Actual reservations keep actual dates')
assert.equal(moved.trip.bookings[1].date, newStart)
assert.deepEqual(moved.confirmed, ['Flight'])
assert.equal(rescheduleTrip(trip, { ...draft, startDate: '2027-02-30' }).ok, false)
const full = { ...trip, days: trip.days.map((day) => ({ ...day, notes: 'keep me' })) }
assert.deepEqual(rescheduleTrip(full, { ...draft, endDate: trip.startDate, cities: [{ city: 'Tokyo', days: 1 }] }), { ok: false, reason: 'protected', dates: full.days.slice(1).map((day) => day.date) })
const longer = rescheduleTrip(trip, { ...draft, endDate: shiftDate(trip.startDate, 3), cities: [{ city: 'Tokyo', days: 4 }] })
assert.ok(longer.ok); assert.equal(longer.trip.days[3].planA.length, 0)

const pricing: Trip = { ...trip, saved: [{ id: 'hotel', name: 'Hotel', kind: 'hotel', status: 'chosen', votes: {}, price: { amount: 150, currency: 'JPY' }, meta: { priceBasis: 'night' } }], bookings: [{ id: 'hotel-booking', name: 'Hotel', kind: 'hotel', status: 'need', date: trip.startDate, checkout: trip.endDate, sourceSavedId: 'hotel', costFromSaved: true }] }
const priced = reconcileBookingLinks(pricing)
assert.deepEqual(priced.bookings[0].cost, { amount: 300, currency: 'JPY' })
assert.equal(reconcileBookingLinks({ ...priced, saved: [{ ...priced.saved[0], price: { amount: 200, currency: 'JPY' } }] }).bookings[0].cost?.amount, 400)
assert.equal(reconcileBookingLinks({ ...priced, bookings: [{ ...priced.bookings[0], status: 'paid' }], saved: [{ ...priced.saved[0], price: { amount: 200, currency: 'JPY' } }] }).bookings[0].cost?.amount, 300, 'Confirmed price is retained')

const previous = useApp.getState().trips
try {
  useApp.setState({ trips: [priced] })
  useApp.getState().updateBooking(priced.id, 'hotel-booking', { cost: { amount: 250, currency: 'JPY' } })
  useApp.getState().updateSaved(priced.id, 'hotel', { price: { amount: 300, currency: 'JPY' } })
  assert.equal(useApp.getState().trips[0].bookings[0].cost?.amount, 250, 'A manually edited order price stops following estimates')
  const expenses: Trip = { ...trip, expenses: [{ id: 'meal', title: 'Meal', amount: 120, currency: 'AUD', date: trip.startDate, category: '餐饮', paidBy: 'owner', split: 'equal', excluded: [], status: 'paid' }] }
  useApp.setState({ trips: [expenses] })
  assert.equal(useApp.getState().recordSettlement(trip.id, { from: 'bo', to: 'owner', amount: 60 }), true)
  assert.equal(useApp.getState().recordSettlement(trip.id, { from: 'bo', to: 'owner', amount: 60 }), false, 'Double click does not record twice')
  const settled = useApp.getState().trips[0]
  assert.equal(settle(settled).transfers.length, 0)
  assert.equal(settle({ ...settled, expenses: [...settled.expenses, { ...settled.expenses[0], id: 'later', amount: 20 }] }).transfers[0].amount, 10, 'New expenses reopen only the remaining difference')
  const snapshot = createSyncSnapshot(useApp.getState().profile, [settled])
  assert.equal(isSyncSnapshot(snapshot), true)
  assert.deepEqual(validateSnapshot(snapshot), snapshot, 'Settlement history survives browser and server backup')
  assert.deepEqual(itineraryExport(settled).trips[0].settlements, [], 'Payments stay out of public exports')
  useApp.getState().undoSettlement(trip.id, settled.settlements![0].id)
  assert.equal(settle(useApp.getState().trips[0]).transfers[0].amount, 60)
  useShared.getState().put(trip.id, { roomId: 'room', memberId: 'bo', role: 'viewer', revision: 1, updatedAt: '', trip, base: trip, backend: '/api', token: 'test', changes: [], status: 'synced' })
  useApp.getState().updateTrip(trip.id, { name: 'unauthorized' })
  useApp.getState().addSaved(trip.id, { kind: 'place', name: 'unauthorized', status: 'interested' })
  assert.equal(useApp.getState().trips[0].name, trip.name)
  assert.equal(useApp.getState().trips[0].saved.length, 0)
} finally { useShared.getState().disconnect(trip.id); useApp.setState({ trips: previous }) }

const left = structuredClone(trip), right = structuredClone(trip)
left.days[0].notes = 'Local'; right.days[1].notes = 'Remote'
const merged = mergeSharedTrip(trip, left, right)
assert.deepEqual(merged.conflicts, []); assert.equal(merged.trip.days[0].notes, 'Local'); assert.equal(merged.trip.days[1].notes, 'Remote')
right.days[0].notes = 'Different'
assert.ok(mergeSharedTrip(trip, left, right).conflicts.includes(`trip.days.${trip.days[0].id}.notes`))
const deleted = { ...trip, days: trip.days.slice(1) }
assert.ok(mergeSharedTrip(trip, deleted, left).conflicts.length, 'Deleting a concurrently edited day requires review')
console.info('Travel upgrade checks passed')

const pennyTrip: Trip = { ...trip, settlements: [], members: [...trip.members, { id: 'third', name: 'Third', role: 'editor', color: '#123456' }], expenses: [{ id: 'penny', title: 'Small shared bill', amount: 1, currency: 'AUD', category: '餐饮', date: trip.startDate, paidBy: 'owner', split: 'equal', excluded: [], status: 'paid' }] }
const pennyTransfers = settle(pennyTrip).transfers
assert.deepEqual(pennyTransfers, [{ from: 'bo', to: 'owner', amount: 0.33 }, { from: 'third', to: 'owner', amount: 0.33 }])
assert.deepEqual(settle({ ...pennyTrip, settlements: pennyTransfers.map((transfer, index) => ({ ...transfer, id: String(index), currency: 'AUD', settledAt: new Date().toISOString() })) }).transfers, [], 'Recorded cent amounts clear the bill exactly')
const weatherLeft = { ...trip, weatherUpdatedAt: '2026-10-13T00:00:01Z' }, weatherRight = { ...trip, weatherUpdatedAt: '2026-10-13T00:00:02Z' }
assert.equal(mergeSharedTrip(trip, weatherLeft, weatherRight).conflicts.length, 0, 'Background weather timestamps do not create editing conflicts')
