import assert from 'node:assert/strict'
import { advanceProviderConfiguration } from '../src/providerGeneration'
import { DEFAULT_RECOMMENDATION_PREFERENCES, normalizePlaceName, recommendationTravelMinutes, samePlace, scheduleSuggestion } from '../src/recommendation'
import { enrichSuggestedPlaces, suggestionContextKey, suggestionRequest, suggestDays } from '../src/suggestions'
import type { PlaceStop, WeatherSnap } from '../src/types'

const preferences = { ...DEFAULT_RECOMMENDATION_PREFERENCES }
const stop = (name: string, overrides: Partial<Omit<PlaceStop, 'id'>> = {}): Omit<PlaceStop, 'id'> => ({ name, category: '景点', setting: 'indoor', durationMin: 60, ...overrides })
const fixture = (places: unknown[], title = 'Tokyo route') => ({ choices: [{ message: { content: JSON.stringify({ suggestions: [{ title, vibe: 'A nearby route.', places }] }) } }] })
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const api = { city: 'Tokyo', apiUrl: 'https://example.test/api/recommendations/day', locale: 'en' as const }
const originalFetch = globalThis.fetch
const originalSetTimeout = globalThis.setTimeout
let calls: { url: string; init?: RequestInit }[] = []
let scenario = 0
const mock = (handler: (url: string, init?: RequestInit) => Promise<Response> | Response) => {
  calls = []
  api.apiUrl = `https://example.test/api/recommendations/day/scenario-${++scenario}`
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    return handler(url, init)
  }) as typeof fetch
}

try {
  assert.equal(normalizePlaceName(' SENSO–JI Temple '), normalizePlaceName('浅草寺'))
  assert.ok(samePlace({ name: 'Meiji Shrine' }, { name: '明治神宫' }))
  assert.ok(samePlace({ name: 'Shibuya Crossing' }, { name: '涩谷十字路口' }))
  assert.equal(samePlace({ name: 'Kyoto National Museum' }, { name: 'Tokyo National Museum' }), false)
  assert.equal(samePlace({ name: 'Shibuya' }, { name: 'Shibuya Sky' }), false)
  assert.equal(samePlace({ name: '' }, { name: '' }), false)
  assert.equal(samePlace({ name: 'Coffee House', coords: { lat: 35, lng: 139 } }, { name: 'Coffee House', coords: { lat: 36, lng: 139 } }), false)
  assert.equal(samePlace({ name: 'Museum A', coords: { lat: 35, lng: 139 } }, { name: 'Museum B', coords: { lat: 35, lng: 139 } }), false, 'Adjacent venues remain separate')

  const morning = scheduleSuggestion([stop('A'), stop('B'), stop('C')], { ...preferences, endTime: '12:00' })
  assert.deepEqual(morning.places.map((p) => p.time), ['09:00', '10:40'])
  assert.equal(morning.omitted, 1)
  assert.equal(morning.travelMinutes, 30)
  assert.equal(morning.totalMinutes, 160)
  assert.equal(morning.unlocated, 2)
  assert.equal(morning.distanceKm, 0)
  const anchor: PlaceStop = { id: 'existing', ...stop('Existing', { time: '11:00' }) }
  const appended = scheduleSuggestion([stop('A', { time: '09:00' })], preferences, anchor)
  assert.equal(appended.places[0].time, '12:40', 'Append includes the previous visit, travel and buffer')
  assert.equal(appended.totalMinutes, 100)
  const unsizedAnchor = { ...anchor, durationMin: undefined }
  assert.equal(scheduleSuggestion([stop('A')], { ...preferences, pace: 'full' }, unsizedAnchor).places[0].time, '12:35', 'An existing stop without duration always occupies 60 minutes')
  assert.equal(scheduleSuggestion([stop('Sunset', { time: '17:30' })], preferences).places[0].time, '17:30')
  assert.equal(scheduleSuggestion([stop('Afternoon museum', { time: '13:00', durationMin: 75 })], preferences).totalMinutes, 75, 'A fresh route starts its elapsed time at the first visit')
  assert.deepEqual(scheduleSuggestion([stop('A', { time: '23:30' })], { ...preferences, startTime: '23:00', endTime: '23:59' }).places, [])
  assert.deepEqual(scheduleSuggestion([stop('A')], { ...preferences, startTime: '20:00', endTime: '09:00' }).places, [])
  assert.deepEqual(scheduleSuggestion([stop('A')], { ...preferences, startTime: '25:00' }).places, [])
  assert.equal(scheduleSuggestion([stop('Late A', { time: '11:00', durationMin: 100 }), stop('Short B', { time: '10:00', durationMin: 20 })], { ...preferences, endTime: '11:30' }).places[0].name, 'Short B', 'A stop that cannot fit must not block a later suitable candidate')
  assert.equal(scheduleSuggestion(Array.from({ length: 7 }, (_, i) => stop(`Place ${i}`, { durationMin: 15 })), { ...preferences, pace: 'relaxed' }).places.length, 3)
  assert.equal(scheduleSuggestion([stop('A', { setting: 'outdoor' }), stop('B'), stop('C', { setting: 'mixed' })], { ...preferences, indoorOnly: true }).places.length, 1)
  assert.equal(scheduleSuggestion([stop('Meiji Shrine'), stop('明治神宫')], preferences).places.length, 1)
  const invalidCoordinates = scheduleSuggestion([stop('A', { coords: { lat: NaN, lng: 100 } }), stop('B')], preferences)
  assert.equal(invalidCoordinates.travelMinutes, 30)
  const a = { coords: { lat: 35, lng: 139 } }
  const b = { coords: { lat: 35.02, lng: 139.02 } }
  assert.ok(recommendationTravelMinutes(a, b, 'walking') > recommendationTravelMinutes(a, b, 'taxi'))
  assert.equal(recommendationTravelMinutes({}, {}, 'walking'), 35)

  mock(() => { throw new Error('Local recommendations must not use the network') })
  const local = await suggestDays({ city: 'Tokyo', locale: 'en' })
  assert.equal(local.source, 'local')
  assert.equal(local.items.length, 3)
  assert.equal(calls.length, 0)
  assert.ok(local.items.every((s) => !/[\u4e00-\u9fff]/.test(s.title + s.vibe)))
  assert.ok(local.items.flatMap((s) => s.places).every((p) => p.coords && !p.socialBuzz && !/[\u4e00-\u9fff]/.test(p.name)))
  const emptyCity = await suggestDays({ city: 'A city without a local pack' })
  assert.deepEqual(emptyCity, { source: 'local', items: [], error: 'unavailable' })
  const exhausted = await suggestDays({ city: 'Tokyo', existing: local.items.flatMap((s) => s.places.map((p) => p.name)) })
  assert.equal(exhausted.error, 'empty')
  const deduped = await suggestDays({ city: 'Tokyo', existing: ['Meiji Shrine'], planned: [{ name: 'Senso-ji Temple', date: '2026-10-01', city: '东京' }] })
  assert.ok(deduped.items.flatMap((s) => s.places).every((p) => !['明治神宫', '浅草寺'].includes(p.name)), 'Existing and other-day names both exclude translated duplicates')
  const anotherCity = await suggestDays({ city: 'Tokyo', planned: [{ name: '浅草寺', date: '2026-10-01', city: 'Kyoto' }] })
  assert.ok(anotherCity.items.some((s) => s.places.some((p) => p.name === '浅草寺')))
  const indoor = await suggestDays({ city: 'Tokyo', locale: 'en', preferences: { ...preferences, indoorOnly: true } })
  assert.ok(indoor.items.every((s) => s.rainFriendly && s.places.every((p) => p.setting === 'indoor')))
  assert.equal(indoor.items[0].places.length, 3, 'A complete indoor route ranks ahead of an isolated remaining shop')
  const indoorHarajuku = indoor.items.find((s) => s.title.startsWith('Harajuku'))!
  assert.equal(indoorHarajuku.places.length, 1)
  assert.equal(indoorHarajuku.vibe, 'Shibuya PARCO', 'Filtered route copy describes only the remaining stops')
  assert.deepEqual((await suggestDays({ city: 'Canggu', preferences: { ...preferences, indoorOnly: true } })).items, [])
  const rain: WeatherSnap = { condition: 'rain', tMin: 10, tMax: 20, rainProb: 80, summary: 'Rain', source: 'forecast' }
  assert.equal((await suggestDays({ city: 'Tokyo', weather: rain })).items[0].rainFriendly, true)
  const latePreferences = { ...preferences, startTime: '18:00', endTime: '19:00' }
  const lateRecommendations = await suggestDays({ city: 'Tokyo', weather: rain, preferences: latePreferences })
  assert.ok(scheduleSuggestion(lateRecommendations.items[0].places, latePreferences).places.length > 0, 'A usable route ranks ahead of a weather-preferred route that cannot fit')
  assert.equal((await suggestDays({ city: 'Tokyo', weather: { ...rain, source: 'placeholder' } })).items[0].rainFriendly, false)
  assert.equal((await suggestDays({ city: 'Tokyo', weather: { ...rain, source: 'seasonal' } })).items[0].rainFriendly, false)
  const noTime = await suggestDays({ city: 'Tokyo', preferences: { ...preferences, startTime: '08:00', endTime: '08:15' } })
  assert.deepEqual(noTime.items, [], 'Local fallback cannot present a route with no schedulable stop')
  assert.equal(noTime.error, 'empty')
  assert.ok(local.items.flatMap((s) => s.places).some((p) => p.time === '15:00'), 'Returned candidates keep original recommended times')
  const baliPlanned = [
    { name: 'Neka Art Museum', city: 'Ubud', date: '2026-10-01' },
    { name: 'Blanco Renaissance Museum', city: 'Ubud', date: '2026-10-02' },
    { name: 'Echo Beach', city: 'Canggu', date: '2026-10-03' },
  ]
  const bali = await suggestDays({ city: 'Bali', planned: baliPlanned })
  assert.ok(bali.items.flatMap((item) => item.places).every((place) => !baliPlanned.some((planned) => samePlace(place, planned))), 'Bali exclusions include its Ubud and Canggu districts')
  assert.equal(suggestionRequest({ city: 'Bali', planned: baliPlanned }).planned.length, 3)
  assert.notEqual(suggestionContextKey({ city: 'Bali' }), suggestionContextKey({ city: 'Bali', planned: baliPlanned }), 'Changing a relevant district invalidates the wider-area cache')

  mock(() => json(fixture([stop('Shibuya Crossing')])))
  await suggestDays({ ...api, existing: ['Meiji Shrine', '明治神宫'], planned: [
    { name: 'Senso-ji Temple', date: '2026-10-01', city: 'Tokyo' },
    { name: '浅草寺', date: '2026-10-02', city: '东京' },
    { name: 'Kiyomizu-dera', date: '2026-10-03', city: 'Kyoto' },
  ] })
  const compact = JSON.parse(String(calls[0].init?.body))
  assert.deepEqual(compact.existing, ['Meiji Shrine'])
  assert.deepEqual(compact.planned, [{ name: 'Senso-ji Temple', date: '2026-10-01', city: 'Tokyo' }], 'The model receives only unique places relevant to the current city')
  const requestContext = { ...api, weather: rain, preferences, anchor, planned: [{ name: 'Museum', date: '2026-10-01', city: 'Tokyo', coords: { lat: 35, lng: 139 } }] }
  const trimmedContext = suggestionRequest(requestContext)
  assert.deepEqual(trimmedContext.anchor, { name: anchor.name, time: anchor.time, durationMin: anchor.durationMin })
  assert.equal(trimmedContext.planned[0].coords, undefined, 'Coordinates never enter paid model context')
  assert.deepEqual(trimmedContext.preferences, preferences, 'Every selected preference survives context compaction')
  assert.equal(suggestionContextKey(requestContext), suggestionContextKey({ ...requestContext, planned: [...requestContext.planned, { name: 'Kyoto visit', city: 'Kyoto', date: '2026-10-02' }] }), 'Unrelated city changes do not invalidate a successful recommendation')
  assert.notEqual(suggestionContextKey(requestContext), suggestionContextKey({ ...requestContext, locale: 'zh' }), 'Language changes invalidate prior results')
  assert.notEqual(suggestionContextKey(requestContext), suggestionContextKey({ ...requestContext, preferences: { ...preferences, indoorOnly: true } }))
  assert.notEqual(suggestionContextKey(requestContext), suggestionContextKey({ ...requestContext, anchor: { ...anchor, coords: { lat: 35, lng: 139 } } }), 'Travel feasibility depends on anchor coordinates')

  mock(() => json(fixture([stop('Meiji Shrine'), stop('明治神宫'), stop('Shibuya Crossing')])))
  const successful = await suggestDays(api)
  assert.equal(successful.source, 'api')
  assert.equal(calls.length, 1, 'Generating recommendations makes exactly one backend request')
  assert.equal(successful.items[0].places.length, 2)
  assert.ok(successful.items[0].places.every((p) => p.coords), 'Known catalog coordinates improve route feasibility without another network request')
  assert.equal(successful.cached, false)
  successful.items[0].title = 'User edit'
  const reused = await suggestDays(api)
  assert.equal(reused.cached, true)
  assert.notEqual(reused.items[0].title, 'User edit', 'Returned objects cannot mutate shared cache entries')
  assert.equal(calls.length, 1, 'Repeated identical requests reuse a successful recommendation')
  const request = JSON.parse(String(calls[0].init?.body))
  assert.equal(request.locale, 'en')
  assert.equal(request.city, 'Tokyo')
  assert.equal(request.llmKey, undefined)
  assert.equal(request.messages, undefined)
  const known = await enrichSuggestedPlaces(successful.items[0].places, { city: 'Tokyo' })
  assert.ok(known.every((place) => place.coords))
  assert.equal(calls.length, 1, 'Known catalog coordinates require no extra request when the route is selected')

  const beforeConfigurationChange = suggestionContextKey(api)
  advanceProviderConfiguration()
  assert.notEqual(suggestionContextKey(api), beforeConfigurationChange)
  const afterConfigurationChange = await suggestDays(api)
  assert.equal(afterConfigurationChange.cached, false)
  assert.equal(calls.length, 2, 'A successful provider configuration change invalidates the prior recommendation cache')

  mock(() => json(fixture([
    { name: { unsafe: true }, setting: 'indoor' },
    { name: 'Tokyo 主景点' },
    { name: 'Meiji Shrine', category: '__proto__', setting: 'invalid', time: '99:99', durationMin: -10, ticketNeeded: true, ticketUrl: 'javascript:alert(1)', socialBuzz: 'Instagram viral', coords: { lat: 0, lng: 0 }, notes: 'Instagram viral. Quiet courtyard.' },
  ])))
  const sanitized = (await suggestDays(api)).items[0].places
  assert.equal(sanitized.length, 1)
  assert.equal(sanitized[0].category, '景点')
  assert.equal(sanitized[0].setting, 'outdoor', 'Catalog facts override contradictory model setting claims')
  assert.equal(sanitized[0].time, undefined)
  assert.equal(sanitized[0].durationMin, 60)
  assert.match(sanitized[0].ticketUrl || '', /^https:\/\/www\.klook\.com\//)
  assert.doesNotMatch(sanitized[0].ticketUrl || '', /javascript|evil/i)
  assert.equal(sanitized[0].socialBuzz, undefined)
  assert.equal(sanitized[0].notes, 'Quiet courtyard.')
  assert.notEqual(sanitized[0].coords?.lat, 0, 'Discard model-supplied coordinates')
  mock(() => json(fixture([stop('Tokyo National Museum', { ticketNeeded: true, ticketUrl: 'https://www.tnm.jp/' })])))
  assert.match((await suggestDays(api)).items[0].places[0].ticketUrl || '', /^https:\/\/www\.klook\.com\//)
  mock(() => json(fixture([stop('Meiji Shrine', { setting: 'outdoor' }), stop('Tokyo National Museum', { setting: 'indoor' })])))
  const apiIndoor = await suggestDays({ ...api, preferences: { ...preferences, indoorOnly: true } })
  assert.equal(apiIndoor.items[0].places.length, 1)
  assert.equal(apiIndoor.items[0].places[0].name, 'Tokyo National Museum')

  mock(() => json(fixture([stop('Meiji Shrine', { setting: 'indoor' })])))
  const falseIndoor = await suggestDays({ ...api, preferences: { ...preferences, indoorOnly: true } })
  assert.equal(falseIndoor.source, 'local')
  assert.equal(falseIndoor.error, 'quality')
  assert.ok(falseIndoor.items.every((item) => item.places.every((p) => p.setting === 'indoor')))
  mock(() => json(fixture([stop('Kiyomizu-dera'), { ...stop('A remote museum'), city: 'Kyoto' }])))
  const wrongCity = await suggestDays(api)
  assert.equal(wrongCity.source, 'local')
  assert.equal(wrongCity.error, 'quality', 'Known and explicitly stated cross-city results fail validation')
  mock(() => json(fixture([stop('Meiji Shrine')])))
  const allExcluded = await suggestDays({ ...api, existing: ['明治神宫'] })
  assert.equal(allExcluded.error, 'quality', 'A successful HTTP response containing only planned places is unusable')
  mock(() => json(fixture([stop('Late Museum', { time: '22:00' })])))
  assert.equal((await suggestDays(api)).error, 'quality', 'A route with no schedulable stop cannot be an API success')
  mock(() => new Response(JSON.stringify({ error: 'provider_quality_failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } }))
  assert.equal((await suggestDays(api)).error, 'quality', 'Backend quality failures retain their reason')
  assert.equal(calls.length, 1, 'Quality failure never triggers another paid request')
  mock(() => { throw new Error('Oversized exclusions must not be truncated or sent') })
  assert.equal((await suggestDays({ ...api, existing: Array.from({ length: 101 }, (_, i) => `Existing ${i}`) })).error, 'quality')
  assert.equal(calls.length, 0)

  mock(() => json({ choices: [{ message: { content: '{bad JSON' } }] }))
  assert.equal((await suggestDays(api)).error, 'failed')
  mock(() => json({ choices: [{ message: { content: '{"suggestions":42}' } }] }))
  assert.equal((await suggestDays(api)).error, 'empty')
  mock(() => new Response('Unavailable', { status: 503 }))
  const failed = await suggestDays(api)
  assert.equal(failed.source, 'local')
  assert.equal(failed.error, 'failed')
  assert.ok(failed.items.length)
  await suggestDays(api)
  assert.equal(calls.length, 2, 'Failures and local fallbacks are never cached; only another manual request retries')
  mock(() => { throw new TypeError('Failed to fetch') })
  assert.equal((await suggestDays(api)).error, 'offline')

  // Accelerate deadlines while retaining the real cancellation/timer behavior.
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => originalSetTimeout(handler as (...args: unknown[]) => void, timeout === 35_000 || timeout === 3_500 ? 5 : timeout, ...args)) as typeof setTimeout
  mock(() => new Promise<Response>(() => {}))
  const timedOut = await suggestDays(api)
  assert.equal(timedOut.error, 'timeout')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init?.signal?.aborted, true)
  mock((url) => url === api.apiUrl ? json(fixture(Array.from({ length: 30 }, (_, i) => stop(`Museum ${i}`)))) : new Promise<Response>(() => {}))
  const bounded = await suggestDays(api)
  assert.equal(bounded.source, 'api')
  assert.equal(bounded.items[0].places.length, 8)
  assert.equal(calls.length, 1, 'Unselected recommendation options do not trigger geocoding')
  assert.ok(bounded.items[0].places.every((p) => !p.coords))
  assert.ok(bounded.items[0].places.every((p) => !p.locationPending))
  globalThis.setTimeout = originalSetTimeout

  const controller = new AbortController()
  let releaseShared!: (value: Response) => void
  mock(() => new Promise<Response>((resolve) => { releaseShared = resolve }))
  const pending = suggestDays({ ...api, signal: controller.signal })
  const sharedPending = suggestDays(api)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(calls[0].init?.signal?.aborted, false, 'Cancelling one waiter must preserve a shared request')
  const resumedPending = suggestDays(api)
  releaseShared(json(fixture([stop('Tokyo National Museum')])))
  assert.equal((await sharedPending).source, 'api')
  assert.equal((await resumedPending).source, 'api')
  assert.equal(calls.length, 1, 'Cancellation cannot start a fallback or geocoder request')
  mock(() => { throw new Error('Pre-cancelled requests must not reach fetch') })
  await assert.rejects(suggestDays({ ...api, signal: controller.signal }), { name: 'AbortError' })
  assert.equal(calls.length, 0)
  const geoController = new AbortController()
  mock(() => json(fixture([stop('Cancellation Museum')])))
  const cancellationRoute = await suggestDays(api)
  mock(() => {
    queueMicrotask(() => geoController.abort())
    return new Promise<Response>(() => {})
  })
  await assert.rejects(enrichSuggestedPlaces(cancellationRoute.items[0].places, { city: 'Tokyo', signal: geoController.signal }), { name: 'AbortError' })

  mock(() => json(fixture([stop('Verified Test Museum')])))
  const verifiedRoute = await suggestDays(api)
  mock(() => json({ features: [
    { geometry: { coordinates: [139, 91] }, properties: { name: 'Verified Test Museum', city: 'Tokyo' } },
    { geometry: { coordinates: [135, 35] }, properties: { name: 'Verified Test Museum', city: 'Kyoto' } },
    { geometry: { coordinates: [139.77, 35.71] }, properties: { name: 'Verified Test Museum', city: 'Tokyo', country: 'Japan' } },
  ] }))
  assert.deepEqual((await enrichSuggestedPlaces(verifiedRoute.items[0].places, { city: 'Tokyo' }))[0].coords, { lat: 35.71, lng: 139.77 })
  mock(() => json(fixture([stop('Mismatched Test Museum')])))
  const mismatchedRoute = await suggestDays(api)
  mock(() => json({ features: [{ geometry: { coordinates: [139.77, 35.71] }, properties: { name: 'Unrelated Museum', city: 'Tokyo' } }] }))
  assert.equal((await enrichSuggestedPlaces(mismatchedRoute.items[0].places, { city: 'Tokyo' }))[0].coords, undefined, 'A result in the right city still needs to match the place name')

  console.log('recommendation tests passed')
} finally {
  globalThis.fetch = originalFetch
  globalThis.setTimeout = originalSetTimeout
}
