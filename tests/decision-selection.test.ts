import assert from 'node:assert/strict'
import { japanTrip } from '../src/data'
import { savedDecisionCandidates, selectDecision } from '../src/decisionSelection'
import type { DecisionCandidate, DecisionPreferences } from '../src/decisionTypes'
import type { Trip } from '../src/types'

const failures: string[] = []
function test(name: string, run: () => void) {
  try { run() } catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

function fixture(): Trip {
  return { ...japanTrip(), id: 'decision-trip', saved: [], compares: [], bookings: [], mealSelections: [] }
}

function preferences(patch: Partial<DecisionPreferences> = {}): DecisionPreferences {
  return {
    kind: 'restaurant', city: 'Tokyo', currency: 'JPY', budgetMax: 6000,
    seaView: false, parking: false, freeParking: false, cuisine: 'mexican', variety: true,
    minRating: 4.2, minReviews: 100, checkin: '2026-09-25', checkout: '2026-09-27', travellers: 2,
    ...patch,
  }
}

function candidate(patch: Partial<DecisionCandidate> = {}): DecisionCandidate {
  return {
    id: 'curated-test-restaurant', kind: 'restaurant', name: 'Test Restaurant', city: 'Tokyo',
    source: 'curated', cuisines: ['mexican'], sourceUrl: 'https://example.com/restaurant',
    websiteUrl: 'https://example.com/restaurant', bookingUrl: 'https://example.com/restaurant/reserve',
    ...patch,
  }
}

function selected(trip: Trip, choice = candidate(), prefs = preferences(), choose = true, label = 'My dinner') {
  const result = selectDecision(trip, choice, prefs, label, choose, 'Dining choices')
  assert(!('error' in result), 'selection succeeds')
  return result
}

test('one immutable selection creates all four linked records', () => {
  const trip = fixture(), prefs = preferences(), choice = candidate()
  const before = structuredClone({ trip, prefs, choice })
  const result = selected(trip, choice, prefs)
  assert.deepEqual({ trip, prefs, choice }, before, 'inputs remain unchanged')
  assert.equal(result.trip.saved.length, 1)
  assert.equal(result.trip.saved[0].status, 'chosen')
  assert.deepEqual(result.trip.compares[0].itemIds, [result.savedId])
  assert.equal(result.trip.bookings[0].sourceSavedId, result.savedId)
  assert.equal(result.trip.bookings[0].status, 'need', 'choosing adds a reminder without claiming an actual reservation')
  assert.equal(result.trip.bookings[0].date, prefs.checkin)
  assert.deepEqual(result.trip.mealSelections, [{ date: prefs.checkin, city: 'Tokyo', cuisine: 'mexican', savedId: result.savedId }])
})

test('bookmark alone creates no booking or meal', () => {
  const result = selected(fixture(), candidate(), preferences(), false)
  assert.equal(result.trip.saved[0].status, 'comparing')
  assert.deepEqual(result.trip.compares[0].itemIds, [result.savedId])
  assert.deepEqual(result.trip.bookings, [])
  assert.deepEqual(result.trip.mealSelections, [])
  const chosen = selected(result.trip)
  assert.equal(chosen.savedId, result.savedId)
  assert.equal(chosen.trip.saved.length, 1)
  assert.equal(chosen.trip.bookings.length, 1)
})

test('decision boards keep different cities separate', () => {
  const first = selected(fixture(), candidate(), preferences(), false)
  const second = selected(first.trip, candidate({ id: 'different-city', city: 'Canggu' }), preferences({ city: 'Canggu' }), false)
  assert.equal(second.trip.compares.length, 2)
  assert.equal(second.trip.compares[0].city, 'Tokyo')
  assert.equal(second.trip.compares[1].city, 'Canggu')
})

test('repeat buttons cannot duplicate records', () => {
  const once = selected(fixture())
  const twice = selected(once.trip)
  const bookmarkAgain = selected(twice.trip, candidate(), preferences(), false)
  assert.equal(once.savedId, twice.savedId)
  assert.equal(bookmarkAgain.trip.saved.length, 1)
  assert.equal(bookmarkAgain.trip.compares.length, 1)
  assert.deepEqual(bookmarkAgain.trip.compares[0].itemIds, [once.savedId])
  assert.equal(bookmarkAgain.trip.bookings.length, 1)
  assert.equal(bookmarkAgain.trip.mealSelections?.length, 1)
  assert.equal(bookmarkAgain.trip.saved[0].status, 'chosen', 'bookmark button retains a chosen status')
})

test('manual saved candidate keeps its ID, notes, votes and unrelated board', () => {
  const trip = fixture()
  trip.saved = [{ id: 'manual', kind: 'restaurant', name: 'Manual dinner', status: 'comparing', notes: 'Call for allergy request', votes: { alice: true, bob: false }, url: 'https://example.com/manual', meta: { city: 'Tokyo', custom: 'Keep me' } }]
  trip.compares = [{ id: 'existing-board', kind: 'restaurant', title: 'Our dinners', itemIds: ['manual'] }, { id: 'hotel-board', kind: 'hotel', title: 'Our hotels', itemIds: [] }]
  const [manual] = savedDecisionCandidates(trip.saved)
  const result = selected(trip, manual)
  assert.equal(result.savedId, 'manual')
  assert.equal(result.trip.saved.length, 1)
  assert.equal(result.trip.saved[0].notes, trip.saved[0].notes)
  assert.deepEqual(result.trip.saved[0].votes, trip.saved[0].votes)
  assert.equal(result.trip.saved[0].meta?.custom, 'Keep me')
  assert.equal(result.trip.compares[0].title, 'Our dinners')
  assert.deepEqual(result.trip.compares[1], trip.compares[1])
  assert.deepEqual(result.trip.compares[0].itemIds, ['manual'])
})

test('same-day meal conflict rejects the entire change', () => {
  const once = selected(fixture())
  const before = structuredClone(once.trip)
  const result = selectDecision(once.trip, candidate({ id: 'another-restaurant', name: 'Other dinner' }), preferences(), 'Another dinner', true, 'Dining')
  assert.deepEqual(result, { error: 'mealConflict' })
  assert.deepEqual(once.trip, before)
  const tomorrow = selected(once.trip, candidate({ id: 'another-restaurant' }), preferences({ checkin: '2026-09-26' }))
  assert.deepEqual(tomorrow.trip.mealSelections?.map((meal) => meal.date), ['2026-09-25', '2026-09-26'])
})

test('chosen meal records the actual cuisine when search is any', () => {
  const result = selected(fixture(), candidate({ cuisines: ['mexican'] }), preferences({ cuisine: 'any' }))
  assert.equal(result.trip.mealSelections?.[0].cuisine, 'mexican')
})

test('restaurant selection rejects missing and out-of-trip dates', () => {
  for (const checkin of ['', 'not-a-date', '2026-02-30', '2040-01-01']) {
    assert.deepEqual(selectDecision(fixture(), candidate(), preferences({ checkin }), 'Dinner', true, 'Dining'), { error: 'date' })
  }
})

test('hotel selection rejects malformed, reversed and out-of-trip stays', () => {
  const hotel = candidate({ id: 'hotel', kind: 'hotel' })
  for (const dates of [
    { checkin: '', checkout: '' },
    { checkin: '2026-02-30', checkout: '2026-03-02' },
    { checkin: '2026-09-25', checkout: '2026-09-25' },
    { checkin: '2026-09-27', checkout: '2026-09-25' },
    { checkin: '2040-01-01', checkout: '2040-01-02' },
  ]) {
    const result = selectDecision(fixture(), hotel, preferences({ kind: 'hotel', ...dates }), 'My hotel', true, 'Hotels')
    assert.equal('error' in result ? result.error : null, 'date', `invalid stay ${JSON.stringify(dates)} is rejected`)
  }
})

test('hotel booking retains its own checkout after later preference changes', () => {
  const hotel = candidate({ id: 'stay-with-dates', kind: 'hotel' })
  const result = selectDecision(fixture(), hotel, preferences({ kind: 'hotel' }), 'First hotel', true, 'Hotels')
  assert.ok(!('error' in result))
  if ('error' in result) return
  assert.equal(result.trip.bookings[0].date, '2026-09-25')
  assert.equal(result.trip.bookings[0].checkout, '2026-09-27')
  result.trip.decisionPreferences = preferences({ kind: 'hotel', checkin: '2026-09-29', checkout: '2026-10-01' })
  assert.equal(result.trip.bookings[0].checkout, '2026-09-27')
})

test('malformed imported candidate facts cannot reach rating or currency renderers', () => {
  const malformed = candidate({ rating: { value: 'five', count: 'many', sourceUrl: 'javascript:alert(1)' }, price: { max: 'cheap', currency: {}, basis: 'night' }, cuisines: 'mexican', attributions: 'bad' } as unknown as Partial<DecisionCandidate>)
  const values = savedDecisionCandidates([{ id: 'import', name: 'Imported restaurant', kind: 'restaurant', status: 'interested', votes: {}, decision: malformed }])
  assert.equal(values[0].rating, undefined)
  assert.equal(values[0].price, undefined)
  assert.equal(values[0].cuisines, undefined)
  assert.equal(values[0].attributions, undefined)
})

test('verified reservation entry stays preferred when it is also the official website', () => {
  const url = 'https://example.com/official-booking-page'
  const result = selected(fixture(), candidate({ sourceUrl: url, websiteUrl: url, bookingUrl: url }))
  assert.equal(result.trip.saved[0].url, url)
  assert.equal(result.trip.bookings[0].url, url)
})

test('booked saved items and booking records retain status and confirmation', () => {
  const once = selected(fixture())
  once.trip.saved[0].status = 'booked'
  once.trip.bookings[0] = { ...once.trip.bookings[0], status: 'paid', confirmation: 'KEEP-123', cost: { amount: 123, currency: 'JPY' } }
  const beforeBooking = structuredClone(once.trip.bookings)
  const again = selected(once.trip)
  assert.equal(again.trip.saved[0].status, 'booked')
  assert.deepEqual(again.trip.bookings, beforeBooking)
  const bookmarked = selected(again.trip, candidate(), preferences(), false)
  assert.equal(bookmarked.trip.saved[0].status, 'booked')
  assert.deepEqual(bookmarked.trip.bookings, beforeBooking)
})

test('blank label cannot create a selection', () => {
  assert.deepEqual(selectDecision(fixture(), candidate(), preferences(), '   ', true, 'Dining'), { error: 'label' })
})

const googleCandidate = candidate({
  id: 'google:ChIJ_TEST_PLACE_ID', source: 'google', name: 'PROVIDER_NAME_SENTINEL',
  address: 'PROVIDER_ADDRESS_SENTINEL', city: 'PROVIDER_CITY_SENTINEL',
  sourceUrl: 'https://provider-sentinel.example/source', websiteUrl: 'https://provider-sentinel.example/website',
  bookingUrl: 'https://provider-sentinel.example/booking', mapsUrl: 'https://provider-sentinel.example/maps',
  rating: { value: 4.81234567, count: 91827364, sourceUrl: 'https://provider-sentinel.example/rating' },
  price: { min: 76543, max: 87654, currency: 'JPY', basis: 'person' },
  attributions: [{ name: 'PROVIDER_ATTRIBUTION_SENTINEL', url: 'https://provider-sentinel.example/attribution' }],
})

function assertProviderFactsAbsent(value: unknown) {
  const json = JSON.stringify(value)
  for (const marker of ['PROVIDER_', 'provider-sentinel.example', '4.81234567', '91827364', '76543', '87654']) assert.equal(json.includes(marker), false, `provider fact ${marker} must stay session-only`)
}

test('Google selection retains place ID and user data only', () => {
  const result = selected(fixture(), googleCandidate, preferences(), true, 'My own dinner label')
  const item = result.trip.saved[0]
  assert.equal(item.name, 'My own dinner label')
  assert.equal(item.meta?.decisionId, 'google:ChIJ_TEST_PLACE_ID')
  assert.equal(item.meta?.decisionSource, 'google')
  assert.equal(item.decision, undefined)
  assert.equal(item.rating, undefined)
  assert.equal(item.price, undefined)
  assert.equal(item.subtitle, undefined)
  assert.equal(new URL(item.url!).searchParams.get('query_place_id'), 'ChIJ_TEST_PLACE_ID')
  assertProviderFactsAbsent(result.trip)
  assert.deepEqual(savedDecisionCandidates(result.trip.saved), [], 'persisted Google references cannot masquerade as independently sourced candidates')
})

// Isolate Zustand persistence from all real browser storage.
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
} })

try {
  const { useApp } = await import('../src/store')
  const initialState = useApp.getState()
  try {
    test('store commits bookmark, compare, booking and meal atomically', () => {
      const other = { ...fixture(), id: 'other-trip' }
      useApp.setState({ trips: [fixture(), other] })
      const snapshots: number[][] = []
      const unsubscribe = useApp.subscribe((state) => {
        const trip = state.trips[0]
        snapshots.push([trip.saved.length, trip.compares.length, trip.bookings.length, trip.mealSelections?.length || 0])
      })
      try {
        assert.equal(useApp.getState().saveDecision('decision-trip', candidate(), preferences(), 'Dinner', true, 'Dining'), null)
        assert.deepEqual(snapshots, [[1, 1, 1, 1]], 'subscribers see one complete selection')
        assert.deepEqual(useApp.getState().trips[1], other, 'other trips remain untouched')
        assert.equal(useApp.getState().saveDecision('decision-trip', candidate(), preferences(), 'Dinner', true, 'Dining'), null)
        assert.deepEqual(snapshots[1], [1, 1, 1, 1], 'duplicate clicks leave record counts unchanged')
        const before = structuredClone(useApp.getState().trips)
        const updateCount = snapshots.length
        assert.equal(useApp.getState().saveDecision('decision-trip', candidate({ id: 'conflict' }), preferences(), 'Other dinner', true, 'Dining'), 'mealConflict')
        assert.equal(useApp.getState().saveDecision('missing-trip', candidate(), preferences(), 'Dinner', true, 'Dining'), 'trip')
        assert.equal(useApp.getState().saveDecision('decision-trip', candidate(), preferences({ checkin: '2040-01-01' }), 'Dinner', true, 'Dining'), 'date')
        assert.equal(snapshots.length, updateCount, 'rejected calls never write to the store')
        assert.deepEqual(useApp.getState().trips, before)
      } finally { unsubscribe() }
    })

    test('serialized store excludes Google response content', () => {
      useApp.setState({ trips: [fixture()] })
      values.clear()
      assert.equal(useApp.getState().saveDecision('decision-trip', googleCandidate, preferences(), 'Private user label', true, 'My food choices'), null)
      assert(values.size > 0, 'persistence wrote the selection')
      for (const serialized of values.values()) {
        const persisted = JSON.parse(serialized)
        assertProviderFactsAbsent(persisted)
        assert(serialized.includes('ChIJ_TEST_PLACE_ID'))
        assert(serialized.includes('Private user label'))
      }
    })
  } finally { useApp.setState(initialState, true) }
} finally {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}

assert.equal(failures.length, 0, failures.join('\n\n'))
console.log('decision selection tests passed')
