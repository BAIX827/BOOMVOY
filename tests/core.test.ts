import assert from 'node:assert/strict'
import { budgetCategoryActuals, budgetTotals, settle } from '../src/domain'
import { cityForDay, eachDate } from '../src/lib'
import type { Trip } from '../src/types'
import { RequestCache } from '../src/requestCache'
import { ensurePlacesGeo, geocodePlace, routeHop, searchPlaces } from '../src/geo'
import { weatherForCity } from '../src/weather'
import { matchBoomi } from '../src/boomiChat'
import { askBoomi } from '../src/llm'
import { replaceTravelData, useApp } from '../src/store'

function tripFixture(): Trip {
  return {
    id: 'trip',
    name: 'Test trip',
    origin: 'Melbourne',
    destinations: ['Tokyo'],
    startDate: '2026-10-01',
    endDate: '2026-10-02',
    travellers: 2,
    members: [
      { id: 'a', name: 'A', role: 'owner', color: '#000' },
      { id: 'b', name: 'B', role: 'editor', color: '#fff' },
    ],
    budgetPerPerson: 1000,
    totalBudget: 2000,
    homeCurrency: 'AUD',
    theme: 'cream',
    cover: 'cream',
    transportModes: ['public'],
    days: [],
    saved: [],
    compares: [],
    bookings: [
      { id: 'bk1', kind: 'flight', name: 'Flight', status: 'paid', cost: { amount: 500, currency: 'USD' }, exchangeRate: 1.5 },
      { id: 'bk2', kind: 'hotel', name: 'Hotel', status: 'need', cost: { amount: 300, currency: 'AUD' } },
    ],
    budget: [
      { id: 'flight', name: '机票', estimated: 900, booked: 1, paid: 1 },
      { id: 'hotel', name: '住宿', estimated: 500, booked: 1, paid: 1 },
    ],
    expenses: [
      { id: 'ex1', title: 'Flight', amount: 500, currency: 'USD', homeAmount: 750, exchangeRate: 1.5, category: '机票', date: '2026-09-01', paidBy: 'a', split: 'equal', excluded: [], status: 'paid' },
    ],
    gifts: [],
    notes: '',
    share: { visibility: 'private' },
    createdAt: '2026-09-01',
  }
}

assert.deepEqual(eachDate('2026-10-01', '2026-10-03'), ['2026-10-01', '2026-10-02', '2026-10-03'])
assert.deepEqual(eachDate('2026-10-03', '2026-10-01'), [])
assert.deepEqual([0, 1, 2, 3, 4].map((index) => cityForDay(['Tokyo', 'Kyoto'], [2, 3], index)), ['Tokyo', 'Tokyo', 'Kyoto', 'Kyoto', 'Kyoto'])

const trip = tripFixture()
assert.deepEqual(budgetTotals(trip), { estimated: 1400, booked: 750, paid: 750 })
assert.deepEqual(budgetCategoryActuals(trip, '机票'), { booked: 750, paid: 750 })
assert.deepEqual(settle(trip).transfers, [{ from: 'b', to: 'a', amount: 375 }])

trip.expenses = [{ ...trip.expenses[0], split: { a: 200, b: 300 } }]
assert.deepEqual(settle(trip).transfers, [{ from: 'b', to: 'a', amount: 450 }])
assert.deepEqual(matchBoomi('后端 API 密钥怎么设置？', 'trip'), { sayKey: 'chat.backend', route: '/profile' })
assert.deepEqual(matchBoomi('How do I sync?', 'trip'), { sayKey: 'chat.backend', route: '/profile' })

const originalSetState = useApp.setState
const beforeReplacement = useApp.getState()
let rejectFirstPersist = true
useApp.setState = ((state, replace) => {
  originalSetState(state, replace)
  if (rejectFirstPersist) {
    rejectFirstPersist = false
    throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
  }
}) as typeof useApp.setState
try {
  assert.throws(() => replaceTravelData({ profile: beforeReplacement.profile, trips: [] }), /Storage quota exceeded/)
  assert.equal(useApp.getState().trips.length, beforeReplacement.trips.length, 'A failed persisted replacement rolls memory back')
} finally {
  useApp.setState = originalSetState
  originalSetState({ profile: beforeReplacement.profile, trips: beforeReplacement.trips })
}

let clock = 1_000
let loads = 0
let releaseShared!: (value: number) => void
const sharedValue = new Promise<number>((resolve) => { releaseShared = resolve })
const cache = new RequestCache<number>({ ttlMs: 50, maxEntries: 2, now: () => clock })
const first = cache.getOrCreate('same', () => { loads += 1; return sharedValue })
const second = cache.getOrCreate('same', () => { loads += 1; return Promise.resolve(99) })
assert.equal(loads, 1, 'Concurrent exact-key loads share one request')
releaseShared(7)
assert.deepEqual(await Promise.all([first, second]), [7, 7])
assert.equal(await cache.getOrCreate('same', () => { loads += 1; return Promise.resolve(8) }), 7, 'A successful value is reused within its TTL')
clock += 51
assert.equal(await cache.getOrCreate('same', () => { loads += 1; return Promise.resolve(8) }), 8, 'Expired values are refreshed')

const failureCache = new RequestCache<number>({ ttlMs: 50, maxEntries: 2 })
let failures = 0
for (let i = 0; i < 2; i++) {
  await assert.rejects(failureCache.getOrCreate('failure', async () => { failures += 1; throw new Error('failed') }), /failed/)
}
assert.equal(failures, 2, 'Failures are never cached')

const boundedCache = new RequestCache<number>({ ttlMs: 1_000, maxEntries: 2 })
let boundedLoads = 0
await boundedCache.getOrCreate('a', async () => { boundedLoads += 1; return 1 })
await boundedCache.getOrCreate('b', async () => { boundedLoads += 1; return 2 })
await boundedCache.getOrCreate('a', async () => { boundedLoads += 1; return 3 })
await boundedCache.getOrCreate('c', async () => { boundedLoads += 1; return 4 })
await boundedCache.getOrCreate('b', async () => { boundedLoads += 1; return 5 })
assert.equal(boundedLoads, 4, 'The least-recently-used value is evicted at the entry bound')

let releaseCancelled!: (value: number) => void
const cancellableValue = new Promise<number>((resolve) => { releaseCancelled = resolve })
const cancellationCache = new RequestCache<number>({ ttlMs: 50, maxEntries: 2 })
const callerController = new AbortController()
const cancelledCaller = cancellationCache.getOrCreate('shared', () => cancellableValue, callerController.signal)
const remainingCaller = cancellationCache.getOrCreate('shared', () => Promise.resolve(99))
callerController.abort()
await assert.rejects(cancelledCaller, (error: unknown) => error instanceof DOMException && error.name === 'AbortError')
releaseCancelled(12)
assert.equal(await remainingCaller, 12, 'Cancelling one caller does not cancel a shared request for another caller')

const originalFetch = globalThis.fetch
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
try {
  let boomiCalls = 0
  let releaseBoomi!: () => void
  const boomiGate = new Promise<void>((resolve) => { releaseBoomi = resolve })
  globalThis.fetch = (async () => {
    boomiCalls += 1
    await boomiGate
    return json({ text: 'Open the profile page.' })
  }) as typeof fetch
  const boomiBackend = { baseUrl: 'https://boomvoy.test/api', ready: true, fromEnv: false }
  const boomiA = askBoomi(boomiBackend, 'Where is my backend?', 'en', '/profile')
  const boomiB = askBoomi(boomiBackend, 'Where is my backend?', 'en', '/profile')
  assert.equal(boomiCalls, 1)
  releaseBoomi()
  assert.equal(await boomiA, await boomiB)
  await askBoomi(boomiBackend, 'Where is my backend?', 'en', '/profile')
  assert.equal(boomiCalls, 1, 'An exact successful Boomi answer is briefly reused')

  let geoCalls = 0
  let releaseGeo!: () => void
  const geoGate = new Promise<void>((resolve) => { releaseGeo = resolve })
  globalThis.fetch = (async () => {
    geoCalls += 1
    await geoGate
    return json({ features: [{ geometry: { coordinates: [151.2, -33.8] }, properties: { name: 'Concurrent Place', city: 'Sydney' } }] })
  }) as typeof fetch
  const geoA = geocodePlace('Concurrent Place 8fd8, Sydney')
  const geoB = geocodePlace('Concurrent Place 8fd8, Sydney')
  assert.equal(geoCalls, 1)
  releaseGeo()
  assert.deepEqual(await geoA, await geoB)

  let failedGeoCalls = 0
  globalThis.fetch = (async () => { failedGeoCalls += 1; return json({}, 503) }) as typeof fetch
  assert.equal(await geocodePlace('Missing Place 8fd8, Sydney'), null)
  assert.equal(await geocodePlace('Missing Place 8fd8, Sydney'), null)
  assert.equal(failedGeoCalls, 4, 'Failed primary and fallback geocoders are retried rather than cached')

  let active = 0
  let maximumActive = 0
  let batchCalls = 0
  globalThis.fetch = (async (input) => {
    batchCalls += 1
    active += 1
    maximumActive = Math.max(maximumActive, active)
    await new Promise((resolve) => setTimeout(resolve, 2))
    active -= 1
    const name = new URL(String(input)).searchParams.get('q') || ''
    return json({ features: [{ geometry: { coordinates: [151.2 + batchCalls / 100, -33.8] }, properties: { name, city: 'Worker City' } }] })
  }) as typeof fetch
  const unresolved = Array.from({ length: 5 }, (_, index) => ({ name: `Worker Place ${index} 8fd8` }))
  const located = await ensurePlacesGeo('Worker City', unresolved, 2)
  assert.equal(batchCalls, 5)
  assert.equal(maximumActive, 2, 'Bulk geocoding respects its concurrency limit')
  assert.deepEqual(located.map((place) => place.name), unresolved.map((place) => place.name), 'Bulk geocoding preserves input order')
  assert.ok(located.every((place) => place.coords))

  let searchCalls = 0
  let releaseSearch!: () => void
  const searchGate = new Promise<void>((resolve) => { releaseSearch = resolve })
  globalThis.fetch = (async () => {
    searchCalls += 1
    await searchGate
    return json([{ display_name: 'Test Museum, Sydney', lat: '-33.8', lon: '151.2' }])
  }) as typeof fetch
  const searchA = searchPlaces('Test Museum 8fd8', 'Sydney')
  const searchB = searchPlaces('Test Museum 8fd8', 'Sydney')
  assert.equal(searchCalls, 1)
  releaseSearch()
  assert.deepEqual(await searchA, await searchB)
  await searchPlaces('Test Museum 8fd8', 'Sydney')
  assert.equal(searchCalls, 1, 'Manual place search reuses a successful exact query')

  let routeCalls = 0
  let releaseRoute!: () => void
  const routeGate = new Promise<void>((resolve) => { releaseRoute = resolve })
  globalThis.fetch = (async () => {
    routeCalls += 1
    await routeGate
    return json({ routes: [{ duration: 600, distance: 2300, geometry: { coordinates: [[151.2, -33.8], [151.21, -33.81]] } }] })
  }) as typeof fetch
  const routeA = routeHop({ lat: -33.8, lng: 151.2 }, { lat: -33.81, lng: 151.21 }, 'walking')
  const routeB = routeHop({ lat: -33.8, lng: 151.2 }, { lat: -33.81, lng: 151.21 }, 'walking')
  assert.equal(routeCalls, 1)
  releaseRoute()
  assert.equal((await routeA).source, 'osrm')
  assert.equal((await routeB).source, 'osrm')
  await routeHop({ lat: -33.8, lng: 151.2 }, { lat: -33.81, lng: 151.21 }, 'walking')
  assert.equal(routeCalls, 1, 'A successful route is reused within its TTL')

  let equivalentRouteCalls = 0
  globalThis.fetch = (async () => {
    equivalentRouteCalls += 1
    return json({ routes: [{ duration: 600, distance: 2300, geometry: { coordinates: [[151.3, -33.9], [151.31, -33.91]] } }] })
  }) as typeof fetch
  const [publicRoute, taxiRoute, drivingRoute] = await Promise.all([
    routeHop({ lat: -33.9, lng: 151.3 }, { lat: -33.91, lng: 151.31 }, 'public'),
    routeHop({ lat: -33.9, lng: 151.3 }, { lat: -33.91, lng: 151.31 }, 'taxi'),
    routeHop({ lat: -33.9, lng: 151.3 }, { lat: -33.91, lng: 151.31 }, 'self-drive'),
  ])
  assert.equal(equivalentRouteCalls, 1, 'Modes sharing the same OSRM profile share one upstream request')
  assert.equal(publicRoute.minutes, 14)
  assert.equal(taxiRoute.minutes, 10)
  assert.equal(drivingRoute.minutes, 10)

  let failedRouteCalls = 0
  globalThis.fetch = (async () => { failedRouteCalls += 1; return json({}, 503) }) as typeof fetch
  assert.equal((await routeHop({ lat: -34.01, lng: 151.01 }, { lat: -34.02, lng: 151.02 }, 'cycling')).source, 'estimate')
  assert.equal((await routeHop({ lat: -34.01, lng: 151.01 }, { lat: -34.02, lng: 151.02 }, 'cycling')).source, 'estimate')
  assert.equal(failedRouteCalls, 2, 'Fallback estimates do not cache a failed provider response')

  const weatherCalls: string[] = []
  globalThis.fetch = (async (input) => {
    const url = String(input)
    weatherCalls.push(url)
    if (url.includes('geocoding-api.open-meteo.com')) return json({ results: [{ latitude: -33.8, longitude: 151.2 }] })
    const date = new URL(url).searchParams.get('start_date') || '2098-05-04'
    return json({ daily: { time: [date], weather_code: [1], temperature_2m_max: [23], temperature_2m_min: [14], precipitation_sum: [0] } })
  }) as typeof fetch
  const weatherA = weatherForCity('Weather City 8fd8', ['2099-05-04'], 'en')
  const weatherB = weatherForCity('Weather City 8fd8', ['2099-05-04'], 'en')
  assert.deepEqual(await weatherA, await weatherB)
  assert.equal(weatherCalls.length, 2, 'Concurrent weather loads share one city lookup and one range request')
  await weatherForCity('Weather City 8fd8', ['2099-05-04'], 'en', true)
  assert.equal(weatherCalls.length, 3, 'A manual refresh reuses city coordinates but bypasses settled weather data')

  let failedWeatherCalls = 0
  globalThis.fetch = (async (input) => {
    failedWeatherCalls += 1
    if (String(input).includes('geocoding-api.open-meteo.com')) return json({ results: [{ latitude: -34.2, longitude: 150.6 }] })
    return json({}, 503)
  }) as typeof fetch
  await assert.rejects(weatherForCity('Failed Weather City 8fd8', ['2099-06-04'], 'en'), /Weather archive API/)
  await assert.rejects(weatherForCity('Failed Weather City 8fd8', ['2099-06-04'], 'en'), /Weather archive API/)
  assert.equal(failedWeatherCalls, 3, 'A successful city lookup is cached while failed weather ranges are retried')
} finally {
  globalThis.fetch = originalFetch
}

console.log('core tests passed')
