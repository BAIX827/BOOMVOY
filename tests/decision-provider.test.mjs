import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import http from 'node:http'
import { build } from 'esbuild'
import { createDecisionServer, mapGooglePlace, matchesRequestedGeography, validateDecisionRequest, validateRecommendationRequest } from '../server/decision-server.mjs'

// This suite always injects a fake key and fetch. It never reads .env or calls Google.
const preferences = { kind: 'restaurant', city: 'Melbourne, Australia', currency: 'AUD', budgetMax: 70, seaView: false,
  parking: false, freeParking: false, cuisine: 'mexican', variety: true, minRating: 4.3, minReviews: 100,
  checkin: '', checkout: '', travellers: 2 }
const fetchedAt = '2026-09-07T00:00:00.000Z'
const place = { id: 'test_place', displayName: { text: 'Example Mexican Restaurant' }, types: ['mexican_restaurant', 'restaurant'],
  addressComponents: [{ longText: 'Melbourne', types: ['locality'] }, { longText: 'Victoria', shortText: 'VIC', types: ['administrative_area_level_1'] }, { longText: 'Australia', shortText: 'AU', types: ['country'] }],
  businessStatus: 'OPERATIONAL', formattedAddress: '1 Test Street, Melbourne', googleMapsUri: 'https://maps.google.com/?cid=123',
  websiteUri: 'https://example.com/menu', rating: 4.6, userRatingCount: 832,
  parkingOptions: { freeParkingLot: true }, priceRange: { startPrice: { currencyCode: 'AUD', units: '30' }, endPrice: { currencyCode: 'AUD', units: '60', nanos: 500000000 } },
  attributions: [{ provider: 'Example data partner', providerUri: 'https://example.com/attribution' }] }
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const servers = []
async function start(options = {}) {
  const server = createDecisionServer({ apiKey: 'fake-test-key', fetchImpl: async () => json({ places: [place] }), ...options })
  servers.push(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}
after(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })))
})
const request = (base, body = { preferences, locale: 'en' }, headers = {}) => fetch(`${base}/api/decisions/search`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
})
const post = (base, path, body, headers = {}) => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
})
const chat = { question: 'How do I plan a day?', locale: 'en', page: '/trip/test/plan' }
const recommendation = {
  city: 'Tokyo', date: '2026-09-08', locale: 'en', existing: ['Senso-ji'],
  planned: [{ name: 'Meiji Jingu', date: '2026-09-09', city: 'Tokyo' }],
  preferences: { pace: 'balanced', startTime: '09:00', endTime: '19:00', transportMode: 'public', indoorOnly: false },
  anchor: { name: 'Tokyo Station', time: '08:00', durationMin: 30 },
}

test('recommendation requests accept the full persisted weather enum', () => {
  const result = validateRecommendationRequest({
    ...recommendation,
    weather: { condition: 'wind', tMin: 12, tMax: 19, rainProb: 20, summary: 'Windy', source: 'forecast' },
  })
  assert.equal(result.weather.condition, 'wind')
})

test('validates city, budget, dates, enums and numbers without forwarding extra fields', () => {
  const valid = validateDecisionRequest({ preferences: { ...preferences, apiKey: 'ignored', url: 'http://localhost/admin' }, locale: 'zh' })
  assert.equal(valid.preferences.apiKey, undefined)
  assert.equal(valid.preferences.url, undefined)
  for (const patch of [{ city: '' }, { city: 'a\nb' }, { kind: 'flight' }, { budgetMax: -1 }, { currency: 'aud' },
    { minRating: 6 }, { minReviews: 3.5 }, { travellers: 0 }, { seaView: 'yes' }, { cuisine: 'invented' },
    { checkin: '2026-02-30', checkout: '2026-03-04' }, { kind: 'hotel', checkin: '2026-09-07', checkout: '' },
    { kind: 'hotel', checkin: '2026-09-07', checkout: '2026-09-06' }, { excludedCuisines: ['invented'] }]) {
    assert.throws(() => validateDecisionRequest({ preferences: { ...preferences, ...patch }, locale: 'en' }), /invalid_request/)
  }
})

test('restaurant date changes do not depend on a hidden hotel checkout date', () => {
  for (const checkout of ['', '2026-09-06', '2026-09-07']) {
    assert.equal(validateDecisionRequest({ preferences: { ...preferences, checkin: '2026-09-09', checkout }, locale: 'en' }).preferences.checkin, '2026-09-09')
  }
  assert.deepEqual(validateDecisionRequest({ preferences: { ...preferences, excludedCuisines: ['mexican', 'mexican', 'indian'] }, locale: 'en' }).preferences.excludedCuisines, ['mexican', 'indian'])
})

test('maps verified rating, review count, cuisines, parking, attribution and matching-currency price', () => {
  const candidate = mapGooglePlace(place, preferences, fetchedAt)
  assert.equal(candidate.id, 'google:test_place')
  assert.deepEqual(candidate.rating, { value: 4.6, count: 832, sourceUrl: place.googleMapsUri })
  assert.equal(candidate.checkedAt, fetchedAt)
  assert.deepEqual(candidate.cuisines, ['mexican'])
  assert.equal(candidate.parking, 'free')
  assert.equal(candidate.seaView, 'unknown')
  assert.deepEqual(candidate.price, { min: 30, max: 60.5, currency: 'AUD', basis: 'person' })
  assert.equal(candidate.bookingUrl, undefined)
  assert.deepEqual(candidate.attributions, [{ name: 'Example data partner', url: 'https://example.com/attribution' }])
})

test('verifies full city/region components and rejects unrelated or same-named foreign locations', () => {
  assert.equal(matchesRequestedGeography(place.addressComponents, 'Melbourne, Australia'), true)
  assert.equal(matchesRequestedGeography(place.addressComponents, '墨尔本'), true)
  assert.equal(matchesRequestedGeography(place.addressComponents, 'Melbourne, VIC, Australia'), true)
  assert.equal(matchesRequestedGeography(place.addressComponents, 'Melbourne, Canada'), false)
  assert.equal(matchesRequestedGeography(place.addressComponents, 'Mel'), false)
  assert.equal(matchesRequestedGeography(place.addressComponents, 'Sydney'), false)
  assert.equal(matchesRequestedGeography([], 'Melbourne'), false)
  assert.equal(mapGooglePlace({ ...place, addressComponents: [] }, preferences, fetchedAt), undefined)
  assert.equal(mapGooglePlace({ ...place, addressComponents: [{ longText: 'Melbourne', types: ['locality'] }, { longText: 'United States', shortText: 'US', types: ['country'] }] }, preferences, fetchedAt), undefined)
  const tokyo = [{ longText: 'Shinjuku City', types: ['locality'] }, { longText: '東京都', shortText: '東京都', types: ['administrative_area_level_1'] }, { longText: '日本', shortText: 'JP', types: ['country'] }]
  assert.equal(matchesRequestedGeography(tokyo, 'Tokyo'), true)
  assert.equal(matchesRequestedGeography(tokyo, '东京/日本'), true)
  assert.equal(matchesRequestedGeography(tokyo, 'Osaka'), false)
  const canggu = [{ longText: 'Canggu', types: ['administrative_area_level_4'] }, { longText: 'Kuta Utara', types: ['administrative_area_level_3'] }, { longText: 'Bali', types: ['administrative_area_level_1'] }, { longText: 'Indonesia', shortText: 'ID', types: ['country'] }]
  for (const query of ['Canggu', 'Bali', '巴厘岛', 'Canggu/Bali', '仓古, 印尼']) assert.equal(matchesRequestedGeography(canggu, query), true)
  assert.equal(matchesRequestedGeography(canggu, 'Ubud'), false)
  assert.equal(matchesRequestedGeography([{ longText: 'Canggu Hotel', types: ['premise'] }], 'Canggu'), false)
  const berlin = [{ longText: 'Berlin', types: ['locality'] }, { longText: 'Germany', shortText: 'DE', types: ['country'] }]
  assert.equal(matchesRequestedGeography(berlin, 'Berlin, Germany'), true)
  assert.equal(matchesRequestedGeography(berlin, 'Berlin, DE'), true)
})

test('keeps unsupported hotel room view/rate, street parking and inferred cuisines unknown', () => {
  const hotel = mapGooglePlace({ ...place, types: ['hotel', 'lodging'], parkingOptions: { freeStreetParking: true } }, { ...preferences, kind: 'hotel', seaView: true }, fetchedAt)
  assert.equal(hotel.price, undefined)
  assert.equal(hotel.seaView, 'unknown')
  assert.equal(hotel.parking, 'unknown')
  assert.deepEqual(hotel.cuisines, [])
  const restaurant = mapGooglePlace({ ...place, types: ['restaurant'], parkingOptions: { valetParking: true } }, preferences, fetchedAt)
  assert.deepEqual(restaurant.cuisines, [])
  assert.equal(restaurant.parking, 'unknown')
  assert.equal(mapGooglePlace({ ...place, parkingOptions: { paidGarageParking: true } }, preferences, fetchedAt).parking, 'paid')
  assert.equal(mapGooglePlace({ ...place, parkingOptions: { freeParkingLot: false, paidParkingLot: false, freeGarageParking: false, paidGarageParking: false } }, preferences, fetchedAt).parking, 'none')
})

test('rejects closed places, bad categories and unsafe links; preserves unknown/open-ended prices', () => {
  for (const businessStatus of ['CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'FUTURE_OPENING', undefined]) {
    assert.equal(mapGooglePlace({ ...place, businessStatus }, preferences, fetchedAt), undefined)
  }
  assert.equal(mapGooglePlace({ ...place, types: ['parking'] }, preferences, fetchedAt), undefined)
  const unsafe = mapGooglePlace({ ...place, googleMapsUri: 'https://evil.example/maps', websiteUri: 'javascript:alert(1)', rating: 6, userRatingCount: -1,
    attributions: [{ provider: 'Attribution', providerUri: 'data:text/html,test' }], priceRange: { startPrice: { currencyCode: 'AUD', units: '100' } } }, preferences, fetchedAt)
  assert.equal(unsafe.websiteUrl, undefined)
  assert.equal(unsafe.rating, undefined)
  assert.equal(unsafe.price, undefined)
  assert.equal(unsafe.attributions[0].url, undefined)
  assert.match(unsafe.sourceUrl, /^https:\/\/www\.google\.com\/maps\/search/)
  assert.equal(mapGooglePlace({ ...place, priceRange: { ...place.priceRange, endPrice: { currencyCode: 'USD', units: '80' } } }, preferences, fetchedAt).price, undefined)
})

test('searches only the fixed Google URL, uses pageSize 12 and a minimal dynamic field mask', async () => {
  let observed
  const base = await start({ now: () => Date.parse(fetchedAt), fetchImpl: async (url, options) => {
    observed = { url, options, body: JSON.parse(options.body) }
    return json({ places: [place, place, { ...place, id: 'closed', businessStatus: 'CLOSED_PERMANENTLY' }] })
  } })
  const response = await request(base)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.source, 'google')
  assert.equal(body.candidates.length, 1)
  assert.equal(body.fetchedAt, fetchedAt)
  assert.equal(observed.url, 'https://places.googleapis.com/v1/places:searchText')
  assert.equal(observed.options.headers['X-Goog-Api-Key'], 'fake-test-key')
  assert.equal(observed.options.redirect, 'error')
  assert.equal(observed.body.pageSize, 12)
  assert.equal(observed.body.maxResultCount, undefined)
  assert.equal(observed.body.strictTypeFiltering, true)
  assert.doesNotMatch(observed.options.headers['X-Goog-FieldMask'], /places\.parkingOptions/)
  assert.match(observed.options.headers['X-Goog-FieldMask'], /places\.priceRange/)
  await request(base, { preferences: { ...preferences, kind: 'hotel', seaView: true }, locale: 'zh' })
  assert.equal(observed.body.strictTypeFiltering, undefined)
  assert.equal(observed.body.minRating, undefined)
  assert.equal(observed.body.languageCode, 'zh-CN')
  assert.match(observed.body.textQuery, /sea view hotels/)
  assert.doesNotMatch(observed.options.headers['X-Goog-FieldMask'], /places\.(?:parkingOptions|priceRange)/)
  await request(base, { preferences: { ...preferences, budgetMax: undefined, parking: true }, locale: 'en' })
  assert.match(observed.options.headers['X-Goog-FieldMask'], /places\.parkingOptions/)
  assert.doesNotMatch(observed.options.headers['X-Goog-FieldMask'], /places\.priceRange/)
})

test('missing configuration makes zero upstream requests and returns explicit unavailable', async () => {
  let calls = 0
  const base = await start({ apiKey: '', fetchImpl: async () => { calls++; throw new Error('must not call') } })
  const response = await request(base)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'provider_not_configured' })
  assert.equal(calls, 0)
})

test('rejects unknown hosts/origins, wrong content types and oversized bodies', async () => {
  let calls = 0
  const base = await start({ fetchImpl: async () => { calls++; return json({ places: [] }) } })
  assert.equal((await request(base, undefined, { Origin: 'https://evil.example' })).status, 403)
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/decisions/search`, { method: 'POST', headers: { Host: 'evil.example', 'Content-Type': 'application/json' } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', reject); req.end(JSON.stringify({ preferences, locale: 'en' }))
  })
  assert.equal(wrongHostStatus, 403)
  assert.equal((await request(base, undefined, { 'Content-Type': 'text/plain' })).status, 415)
  assert.equal((await request(base, { padding: 'x'.repeat(17000) })).status, 413)
  assert.equal((await fetch(`${base}/api/decisions/search`)).status, 405)
  assert.equal((await fetch(`${base}/not-a-proxy`)).status, 404)
  assert.equal(calls, 0)
  const allowed = await request(base, undefined, { Origin: 'http://localhost:5173' })
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  const preflight = await fetch(`${base}/api/decisions/search`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type' } })
  assert.equal(preflight.status, 204)
})

test('rate limit and upstream failures reveal no secrets', async () => {
  const base = await start({ rateLimit: 1 })
  assert.equal((await request(base)).status, 200)
  const limited = await request(base)
  assert.equal(limited.status, 429)
  assert.ok(limited.headers.get('retry-after'))
  const failed = await start({ fetchImpl: async () => new Response('upstream error fake-test-key private detail', { status: 403 }) })
  const response = await request(failed)
  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: 'provider_failed' })
  const malformed = await start({ fetchImpl: async () => json({ places: {} }) })
  assert.equal((await request(malformed)).status, 502)
})

test('upstream is aborted on timeout and an explicit retryable error is returned', async () => {
  let aborted = false
  const base = await start({ timeoutMs: 15, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('cancelled', 'AbortError')) }, { once: true })
  }) })
  const response = await request(base)
  assert.equal(response.status, 504)
  assert.deepEqual(await response.json(), { error: 'provider_timeout' })
  assert.equal(aborted, true)
})

test('health is key-free and never calls a provider', async () => {
  let calls = 0
  const base = await start({ apiKey: '', openaiApiKey: '', fetchImpl: async () => { calls++; throw new Error('must not call') } })
  const response = await fetch(`${base}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(calls, 0)
  assert.equal((await post(base, '/api/health', {})).status, 405)
})

test('equivalent concurrent Google requests share one call and settled results are not cached', async () => {
  let calls = 0, release, started
  const gate = new Promise(resolve => { release = resolve })
  const providerStarted = new Promise(resolve => { started = resolve })
  const base = await start({ fetchImpl: async () => {
    calls += 1
    started()
    await gate
    return json({ places: [place] })
  } })
  const first = request(base, { preferences: { ...preferences, minRating: 4.1, travellers: 2 }, locale: 'en' })
  const second = request(base, { preferences: { ...preferences, minRating: 4.9, travellers: 5 }, locale: 'en' })
  await providerStarted
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 1, 'only provider-affecting fields participate in the single-flight key')
  release()
  assert.deepEqual(await Promise.all([first.then(r => r.status), second.then(r => r.status)]), [200, 200])
  assert.equal((await request(base)).status, 200)
  assert.equal(calls, 2, 'Google results are removed from single-flight storage when settled')
})

test('process concurrency and minute budget reject excess work before fetch', async () => {
  let concurrentCalls = 0, release
  const gate = new Promise(resolve => { release = resolve })
  const concurrent = await start({ upstreamConcurrency: 1, fetchImpl: async () => {
    concurrentCalls += 1
    await gate
    return json({ places: [place] })
  } })
  const first = request(concurrent)
  await new Promise(resolve => setImmediate(resolve))
  const busy = await request(concurrent, { preferences, locale: 'zh' })
  assert.equal(busy.status, 429)
  assert.deepEqual(await busy.json(), { error: 'upstream_busy' })
  assert.equal(concurrentCalls, 1)
  release()
  assert.equal((await first).status, 200)

  let time = Date.parse(fetchedAt), budgetCalls = 0
  const budgeted = await start({ now: () => time, upstreamRateLimit: 1, upstreamRateWindowMs: 60000, fetchImpl: async () => {
    budgetCalls += 1
    return json({ places: [place] })
  } })
  assert.equal((await request(budgeted)).status, 200)
  const exhausted = await request(budgeted, { preferences, locale: 'zh' })
  assert.equal(exhausted.status, 429)
  assert.deepEqual(await exhausted.json(), { error: 'budget_exhausted' })
  assert.ok(exhausted.headers.get('retry-after'))
  assert.equal(budgetCalls, 1)
  time += 60000
  assert.equal((await request(budgeted, { preferences, locale: 'zh' })).status, 200)
  assert.equal(budgetCalls, 2)
})

test('AI routes use fixed server configuration, exact-body single-flight and normalized output', async () => {
  let calls = 0, release, started, observed
  const gate = new Promise(resolve => { release = resolve })
  const providerStarted = new Promise(resolve => { started = resolve })
  const recommendationContent = JSON.stringify({ suggestions: [{ title: 'Ueno route', vibe: 'Museums nearby', places: [
    { name: 'Tokyo National Museum', category: 'sight', setting: 'indoor', time: '10:00', durationMin: 75,
      ticketNeeded: true, ticketUrl: 'https://evil.example/phish', priority: 'must', transportToNext: 'walking', coords: { lat: 0, lng: 0 } },
  ] }] })
  const base = await start({ openaiApiKey: 'server-only-secret', openaiApiUrl: 'https://ai.example.test/v1/chat/completions', openaiModel: 'fixed-test-model',
    fetchImpl: async (url, options) => {
      calls += 1
      observed = { url, options, body: JSON.parse(options.body) }
      if (calls === 1) { started(); await gate }
      const system = observed.body.messages?.[0]?.content || ''
      return json({ choices: [{ message: { content: system.includes('geographically coherent') ? recommendationContent : 'Open the Plan page and tap Recommend a day.' } }] })
    } })
  const first = post(base, '/api/ai/chat', chat)
  const second = post(base, '/api/ai/chat', { page: chat.page, locale: chat.locale, question: chat.question })
  await providerStarted
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 1)
  release()
  for (const response of await Promise.all([first, second])) {
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { text: 'Open the Plan page and tap Recommend a day. 喵' })
  }
  assert.equal(observed.url, 'https://ai.example.test/v1/chat/completions')
  assert.equal(observed.options.headers.Authorization, 'Bearer server-only-secret')
  assert.equal(observed.body.model, 'fixed-test-model')
  assert.match(observed.body.messages[0].content, /Do not invent features/)

  const response = await post(base, '/api/recommendations/day', recommendation)
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(calls, 2, 'one recommendation action makes one OpenAI request')
  assert.equal(result.suggestions.length, 1)
  assert.deepEqual(result.suggestions[0].places[0], {
    name: 'Tokyo National Museum', category: '景点', setting: 'indoor', time: '10:00', durationMin: 75,
    ticketNeeded: true, priority: 'must', transportToNext: recommendation.preferences.transportMode,
  })
  assert.match(observed.body.messages[0].content, /Never invent coordinates/)
  assert.doesNotMatch(observed.body.messages[0].content, /ticketUrl/)
  assert.equal(JSON.stringify(observed.body).includes('server-only-secret'), false)
})

test('recommendations use their 256 KiB body limit and make one upstream call for valid large input', async () => {
  let calls = 0
  const content = JSON.stringify({ suggestions: [{ title: 'Large-context route', vibe: '', places: [
    { name: 'Tokyo National Museum', category: 'sight', setting: 'indoor', durationMin: 60, ticketNeeded: false },
  ] }] })
  const base = await start({ openaiApiKey: 'server-only-secret', fetchImpl: async () => {
    calls += 1
    return json({ choices: [{ message: { content } }] })
  } })
  const large = {
    ...recommendation,
    existing: Array.from({ length: 100 }, (_, index) => `Existing place ${index} ${'x'.repeat(85)}`),
    planned: Array.from({ length: 150 }, (_, index) => ({
      name: `Planned place ${index} ${'y'.repeat(85)}`,
      date: '2026-09-09',
      city: 'Tokyo',
    })),
  }
  const bytes = Buffer.byteLength(JSON.stringify(large), 'utf8')
  assert.ok(bytes > 16 * 1024)
  assert.ok(bytes < 256 * 1024)

  const response = await post(base, '/api/recommendations/day', large)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).suggestions.length, 1)
  assert.equal(calls, 1)

  const oversized = await post(base, '/api/recommendations/day', { padding: 'z'.repeat(256 * 1024) })
  assert.equal(oversized.status, 413)
  assert.deepEqual(await oversized.json(), { error: 'request_too_large' })
  assert.equal(calls, 1)
})

test('AI validation and missing keys make zero upstream calls', async () => {
  let calls = 0
  const missing = await start({ apiKey: '', openaiApiKey: '', fetchImpl: async () => { calls++; throw new Error('must not call') } })
  for (const [path, body] of [['/api/ai/chat', chat], ['/api/recommendations/day', recommendation]]) {
    const response = await post(missing, path, body)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'provider_not_configured' })
  }
  assert.equal(calls, 0)

  const strict = await start({ openaiApiKey: 'fake-ai-key', fetchImpl: async () => { calls++; return json({}) } })
  const invalid = [
    ['/api/ai/chat', { ...chat, llmKey: 'client-secret' }],
    ['/api/ai/chat', { ...chat, page: 'https://evil.example/' }],
    ['/api/recommendations/day', { ...recommendation, llmModel: 'client-model' }],
    ['/api/recommendations/day', { ...recommendation, planned: [{ ...recommendation.planned[0], coords: { lat: 1, lng: 2 } }] }],
    ['/api/recommendations/day', { ...recommendation, preferences: { ...recommendation.preferences, startTime: '20:00', endTime: '09:00' } }],
  ]
  for (const [path, body] of invalid) {
    const response = await post(strict, path, body)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'invalid_request' })
  }
  assert.equal(calls, 0)
})

const bundle = await build({ entryPoints: ['src/decisionClient.ts'], bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20' })
const client = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

test('client restricts endpoint schemes, validates response data and blocks invented hotel facts', async () => {
  assert.equal(client.decisionSearchEndpoint(), '/api/decisions/search')
  assert.equal(client.decisionSearchEndpoint('https://api.example.com/decisions'), 'https://api.example.com/decisions')
  assert.equal(client.decisionSearchEndpoint('http://127.0.0.1:8787/api/decisions/search'), 'http://127.0.0.1:8787/api/decisions/search')
  for (const endpoint of ['//evil.example/path', '/\\evil.example/path', 'http://api.example.com/', 'javascript:alert(1)', 'https://user:secret@api.example.com/']) {
    assert.throws(() => client.decisionSearchEndpoint(endpoint), error => error.code === 'invalid')
  }
  const candidate = mapGooglePlace(place, preferences, fetchedAt)
  const safe = client.validateDecisionCandidate({ ...candidate, websiteUrl: 'javascript:alert(1)', rating: { ...candidate.rating, value: 9 } }, preferences, fetchedAt)
  assert.equal(safe.websiteUrl, undefined)
  assert.equal(safe.rating, undefined)
  assert.equal(client.validateDecisionCandidate({ ...candidate, sourceUrl: 'https://evil.example' }, preferences, fetchedAt), undefined)
  const hotel = client.validateDecisionCandidate({ ...candidate, kind: 'hotel', seaView: 'room', price: { max: 200, currency: 'AUD', basis: 'night' } }, { ...preferences, kind: 'hotel' }, fetchedAt)
  assert.equal(hotel.seaView, 'unknown')
  assert.equal(hotel.price, undefined)
  const base = await start()
  const candidates = await client.fetchDecisionCandidates(preferences, 'en', `${base}/api/decisions/search`)
  assert.equal(candidates[0].rating.count, 832)
  const disabled = await start({ apiKey: '' })
  await assert.rejects(client.fetchDecisionCandidates(preferences, 'en', `${disabled}/api/decisions/search`), error => error.code === 'unavailable')
  const controller = new AbortController(); controller.abort()
  await assert.rejects(client.fetchDecisionCandidates(preferences, 'en', `${base}/api/decisions/search`, controller.signal), error => error.name === 'AbortError')
})

test('client distinguishes non-API pages, malformed payloads, rate limits and in-flight cancellation', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('<html>Vite fallback</html>', { headers: { 'Content-Type': 'text/html' } })
    await assert.rejects(client.fetchDecisionCandidates(preferences, 'en'), error => error.code === 'unavailable')
    for (const payload of [{ source: 'google', candidates: {}, fetchedAt }, { source: 'invented', candidates: [], fetchedAt },
      { source: 'google', candidates: [], fetchedAt: 'invalid date' },
      { source: 'google', candidates: [{ name: 'Fake', source: 'google' }], fetchedAt }]) {
      globalThis.fetch = async () => json(payload)
      await assert.rejects(client.fetchDecisionCandidates(preferences, 'en'), error => error.code === 'invalid')
    }
    globalThis.fetch = async () => new Response('private upstream detail', { status: 429 })
    await assert.rejects(client.fetchDecisionCandidates(preferences, 'en'), error => error.code === 'rate_limited' && !error.message.includes('private'))
    let requestOptions, aborted = false
    globalThis.fetch = async (_url, options) => {
      requestOptions = options
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
        aborted = true; reject(new DOMException('cancelled', 'AbortError'))
      }, { once: true }))
    }
    const controller = new AbortController()
    const pending = client.fetchDecisionCandidates(preferences, 'en', '/api/decisions/search', controller.signal)
    controller.abort()
    await assert.rejects(pending, error => error.name === 'AbortError')
    assert.equal(aborted, true)
    assert.deepEqual(Object.keys(requestOptions.headers), ['Content-Type'])
    assert.equal(requestOptions.cache, 'no-store')
    assert.equal(requestOptions.redirect, 'error')
  } finally { globalThis.fetch = originalFetch }
})
