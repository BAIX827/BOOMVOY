import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createBoomvoyServer, normalizeRecommendations } from '../server/decision-server.mjs'

// No environment files or real credentials: every upstream request uses this injected fake provider.
const servers = []
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const envelope = (content, choice = {}) => ({ choices: [{ finish_reason: 'stop', message: { content }, ...choice }] })
const place = (name = 'Tokyo National Museum', patch = {}) => ({
  name, category: 'sight', setting: 'indoor', time: '10:00', durationMin: 60,
  notes: 'Check opening hours before visiting.', ticketNeeded: true, priority: 'want', transportToNext: 'walking', ...patch,
})
const route = places => ({ suggestions: [{ title: 'Ueno museums', vibe: 'A compact culture visit', places }] })
const recommendationData = (places = [place()]) => envelope(JSON.stringify(route(places)))
const input = {
  city: 'Tokyo', date: '2026-09-08', locale: 'en', existing: [], planned: [],
  preferences: { pace: 'balanced', startTime: '09:00', endTime: '19:00', transportMode: 'public', indoorOnly: false },
}
const chat = { question: 'How do I add a day?', locale: 'en', page: '/trip/example/plan' }
const post = (base, path, body) => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const recommend = (base, body = input) => post(base, '/api/recommendations/day', body)

async function start(options = {}) {
  const server = createBoomvoyServer({
    apiKey: '', openaiApiKey: 'fake-ai-quality-test-key', syncToken: '',
    openaiApiUrl: 'https://api.openai.com/v1/chat/completions', openaiModel: 'gpt-4o-mini',
    openaiResponseFormat: 'auto', rateLimit: 1000, upstreamRateLimit: 1000,
    fetchImpl: async () => json(recommendationData()), ...options,
  })
  servers.push(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}

after(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => {
    server.closeAllConnections()
    server.close(resolve)
  })))
})

test('recommendation format selects strict schema for official supported models and allows explicit compatibility mode', async t => {
  const cases = [
    { label: 'official auto', options: {}, type: 'json_schema' },
    { label: 'custom provider auto', options: { openaiApiUrl: 'https://ai.example.test/v1/chat/completions' }, type: 'json_object' },
    { label: 'official compatibility override', options: { openaiResponseFormat: 'json_object' }, type: 'json_object' },
    { label: 'custom schema override', options: { openaiApiUrl: 'https://ai.example.test/v1/chat/completions', openaiResponseFormat: 'json_schema' }, type: 'json_schema' },
  ]
  for (const item of cases) await t.test(item.label, async () => {
    let observed, calls = 0
    const base = await start({ ...item.options, fetchImpl: async (_url, options) => {
      calls++
      observed = JSON.parse(options.body)
      return json(recommendationData())
    } })
    assert.equal((await recommend(base)).status, 200)
    assert.equal(calls, 1)
    assert.equal(observed.response_format.type, item.type)
    if (item.type === 'json_schema') {
      const schema = observed.response_format.json_schema
      assert.equal(schema.strict, true)
      assert.equal(schema.schema.additionalProperties, false)
      assert.ok(schema.schema.properties.suggestions)
      assert.deepEqual(schema.schema.required, ['suggestions'])
    }
  })
})

test('provider context compacts exclusion names to this city and omits redundant weather prose', async () => {
  let observed
  const base = await start({ fetchImpl: async (_url, options) => {
    observed = JSON.parse(options.body)
    return json(recommendationData())
  } })
  const body = {
    ...input, existing: ['Senso-ji', 'Senso-ji', '浅草寺', 'Meiji Jingu'],
    planned: [
      { name: 'Meiji Jingu', city: 'Tokyo', date: '2026-09-09' },
      { name: '明治神宮', city: 'Tokyo', date: '2026-09-09' },
      { name: 'Tokyo Tower', city: '东京', date: '2026-09-10' },
      { name: 'Imperial Palace', date: '2026-09-11' },
      { name: 'Osaka Castle', city: 'Osaka', date: '2026-09-12' },
    ],
    weather: { condition: 'rain', tMin: 18, tMax: 23, rainProb: 80, summary: 'VERBOSE_WEATHER_SENTINEL: rain prose not needed by the model.', source: 'forecast' },
  }
  assert.equal((await recommend(base, body)).status, 200)
  const context = JSON.parse(observed.messages.find(message => message.role === 'user').content)
  assert.deepEqual(new Set(context.alreadyHave), new Set(['Senso-ji', 'Meiji Jingu', 'Tokyo Tower', 'Imperial Palace']))
  assert.equal(context.alreadyHave.length, 4)
  assert.ok(context.alreadyHave.every(value => typeof value === 'string'))
  assert.equal(context.weather.summary, undefined)
  assert.equal(context.weather.condition, 'rain')
  assert.equal(context.weather.rainProb, 80)
  const serialized = JSON.stringify(context)
  assert.equal((serialized.match(/"city"/g) || []).length, 1)
  assert.equal((serialized.match(/"date"/g) || []).length, 1)
  assert.doesNotMatch(serialized, /Osaka Castle|VERBOSE_WEATHER_SENTINEL|2026-09-09/)
})

test('normalization enforces indoor-only, exclusions, duplicate names and the requested time window', () => {
  const requested = { ...input, existing: ['Senso-ji'], planned: [{ name: 'Meiji Jingu', city: 'Tokyo', date: '2026-09-09' }],
    preferences: { ...input.preferences, indoorOnly: true, endTime: '12:00', transportMode: 'walking' } }
  const result = normalizeRecommendations(recommendationData([
    place('Senso-ji'), place('Meiji Jingu'), place('Ueno Park', { setting: 'outdoor' }),
    place('Tokyo National Museum'), place('tokyo national museum'),
    place('National Museum of Nature and Science', { time: '11:45', durationMin: 60 }),
    place('Tokyo Metropolitan Art Museum', { time: '08:00', durationMin: 30 }),
    place('Ameyoko', { setting: 'mixed' }),
  ]), requested)
  assert.equal(result.length, 1)
  assert.deepEqual(result[0].places.map(value => value.name), ['Tokyo National Museum'])
  assert.equal(result[0].places[0].transportToNext, 'walking')
})

test('normalization respects transport preference and permits a valid single-stop route', () => {
  for (const mode of ['walking', 'public', 'taxi', 'self-drive', 'cycling']) {
    const result = normalizeRecommendations(recommendationData([place()]), { ...input,
      preferences: { ...input.preferences, transportMode: mode } })
    assert.equal(result.length, 1)
    assert.equal(result[0].places.length, 1)
    assert.equal(result[0].places[0].transportToNext, mode)
  }
})

test('same-named places planned in another city do not remove a valid local suggestion', () => {
  const result = normalizeRecommendations(recommendationData([place('Central Museum')]), { ...input,
    planned: [{ name: 'Central Museum', city: 'Osaka', date: '2026-09-09' }] })
  assert.equal(result[0].places[0].name, 'Central Museum')
})

test('shared place identities exclude translated planned places and collapse translated duplicates', () => {
  const result = normalizeRecommendations(recommendationData([
    place('Senso-ji'), place('Meiji Jingu'), place('Tokyo National Museum'), place('東京國立博物館'),
  ]), { ...input, existing: ['浅草寺'], planned: [{ name: '明治神宮', city: '东京', date: '2026-09-09' }] })
  assert.equal(result.length, 1)
  assert.deepEqual(result[0].places.map(value => value.name), ['Tokyo National Museum'])
})

test('translated copies of an entire route are not presented as distinct alternatives', () => {
  const data = envelope(JSON.stringify({ suggestions: [
    { title: 'Ueno museums', places: [place('Tokyo National Museum'), place('National Museum of Nature and Science')] },
    { title: '上野博物馆', places: [place('东京国立博物馆'), place('国立科学博物馆')] },
  ] }))
  assert.equal(normalizeRecommendations(data, input).length, 1)
})

test('recommendations honor the anchor, visit duration and travel buffers while preserving an evening visit', () => {
  const requested = { ...input, preferences: { ...input.preferences, endTime: '21:00' },
    anchor: { name: 'Tokyo Station', time: '10:00', durationMin: 60 } }
  const result = normalizeRecommendations(recommendationData([
    place('Tokyo Station', { time: '09:00' }),
    place('Tokyo National Museum', { time: '10:00', durationMin: 60 }),
    place('National Museum of Nature and Science', { time: '11:00', durationMin: 60 }),
    place('Tokyo Skytree', { time: '18:00', durationMin: 60 }),
  ]), requested)
  const places = result[0].places
  assert.deepEqual(places.map(value => value.name), ['Tokyo National Museum', 'National Museum of Nature and Science', 'Tokyo Skytree'])
  assert.ok(places[0].time > '11:00', 'the first stop must leave time to travel after the anchor ends')
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  assert.ok(minutes(places[1].time) > minutes(places[0].time) + places[0].durationMin,
    'successive visits require travel time and may not overlap')
  assert.equal(places[2].time, '18:00', 'an intentional evening visit may not be moved into the morning')
})

test('an anchor that leaves no usable time is rejected before spending an upstream request', async () => {
  let calls = 0
  const base = await start({ fetchImpl: async () => { calls++; return json(recommendationData()) } })
  const response = await recommend(base, { ...input, anchor: { name: 'Tokyo Station', time: '18:00', durationMin: 60 } })
  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), { error: 'no_time_available' })
  assert.equal(calls, 0)
})

test('normalized alternatives must be distinct and a relaxed route may not exceed its pace limit', () => {
  const places = [place(), place('National Museum of Nature and Science'), place('Tokyo Metropolitan Art Museum'), place('National Museum of Western Art')]
  const data = envelope(JSON.stringify({ suggestions: [
    { title: 'Museums', places }, { title: 'The same museums', places },
  ] }))
  const result = normalizeRecommendations(data, { ...input, preferences: { ...input.preferences, pace: 'relaxed' } })
  assert.equal(result.length, 1)
  assert.equal(result[0].places.length, 3)
})

test('empty or wholly unsuitable provider results fail quality checks without retry or caching', async t => {
  for (const [label, data] of [
    ['empty routes', envelope(JSON.stringify({ suggestions: [] }))],
    ['outdoor only', recommendationData([place('Ueno Park', { setting: 'outdoor' })])],
    ['already planned', recommendationData([place('Senso-ji')])],
    ['translated planned place', recommendationData([place('浅草寺')])],
    ['outside the time window', recommendationData([place('Tokyo National Museum', { time: '20:00' })])],
  ]) await t.test(label, async () => {
    let calls = 0
    const base = await start({ fetchImpl: async () => { calls++; return json(data) } })
    const request = { ...input, existing: ['Senso-ji'], preferences: { ...input.preferences, indoorOnly: true } }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await recommend(base, request)
      assert.equal(response.status, 502)
      assert.deepEqual(await response.json(), { error: 'provider_quality_failed' })
      assert.equal(calls, attempt, 'one provider call per manual attempt; failed results are not cached')
    }
  })
})

test('truncation, filtering and refusal fail both AI endpoints without retry or cache', async t => {
  const cases = [
    ['length', { finish_reason: 'length' }],
    ['content filter', { finish_reason: 'content_filter' }],
    ['refusal', { message: { content: JSON.stringify(route([place()])), refusal: 'Unable to comply.' } }],
  ]
  for (const [label, choice] of cases) await t.test(label, async () => {
    let calls = 0
    const base = await start({ fetchImpl: async () => {
      calls++
      return json(envelope(JSON.stringify(route([place()])), choice))
    } })
    for (const [path, body] of [['/api/recommendations/day', input], ['/api/ai/chat', chat]]) {
      const before = calls
      for (let attempt = 1; attempt <= 2; attempt++) {
        const response = await post(base, path, body)
        assert.equal(response.status, 502)
        assert.deepEqual(await response.json(), { error: 'provider_invalid_response' })
        assert.equal(calls, before + attempt)
      }
    }
  })
})

test('recommendation successes cache for ten minutes, with locale and preferences kept distinct', async () => {
  let time = Date.parse('2026-09-08T00:00:00Z'), calls = 0
  const base = await start({ now: () => time, fetchImpl: async () => { calls++; return json(recommendationData()) } })
  const first = await recommend(base)
  assert.equal(first.status, 200)
  const expected = await first.json()
  time += 599_999
  const cached = await recommend(base, { preferences: { ...input.preferences }, planned: [], existing: [], locale: 'en', date: input.date, city: 'Tokyo' })
  assert.equal(cached.status, 200)
  assert.deepEqual(await cached.json(), expected)
  assert.equal(calls, 1)
  assert.equal((await recommend(base, { ...input, locale: 'zh' })).status, 200)
  assert.equal(calls, 2, 'language changes require a fresh localized answer')
  assert.equal((await recommend(base, { ...input, preferences: { ...input.preferences, startTime: '09:30' } })).status, 200)
  assert.equal(calls, 3, 'time-window changes require a fresh plan')
  assert.equal((await recommend(base, { ...input, preferences: { ...input.preferences, indoorOnly: true } })).status, 200)
  assert.equal(calls, 4, 'indoor-only constraints have their own cache entry')
  time += 1
  assert.equal((await recommend(base)).status, 200)
  assert.equal(calls, 5, 'cache expires at ten minutes and reads do not extend its lifetime')
})

test('AI cache TTL is configurable and a zero TTL disables settled-result reuse', async t => {
  for (const ttl of [0, 50]) await t.test(`TTL ${ttl}`, async () => {
    let time = 10_000, calls = 0
    const base = await start({ aiCacheTtlMs: ttl, now: () => time, fetchImpl: async () => { calls++; return json(recommendationData()) } })
    assert.equal((await recommend(base)).status, 200)
    assert.equal((await recommend(base)).status, 200)
    assert.equal(calls, ttl === 0 ? 2 : 1)
    time += 50
    assert.equal((await recommend(base)).status, 200)
    assert.equal(calls, ttl === 0 ? 3 : 2)
  })
})

test('successful helper replies share a bounded 80-entry AI cache', async () => {
  let calls = 0
  const base = await start({ fetchImpl: async () => { calls++; return json(envelope('Open Plan and tap Recommend a day.')) } })
  const message = index => ({ ...chat, question: `How do I plan day ${index}?` })
  for (let index = 0; index < 81; index++) {
    const response = await post(base, '/api/ai/chat', message(index))
    assert.equal(response.status, 200)
    await response.json()
  }
  assert.equal(calls, 81)
  assert.equal((await post(base, '/api/ai/chat', message(80))).status, 200)
  assert.equal(calls, 81, 'a recent helper result should be reused')
  assert.equal((await post(base, '/api/ai/chat', message(0))).status, 200)
  assert.equal(calls, 82, 'the oldest entry must be evicted when the cache exceeds 80 results')
})

test('equivalent concurrent recommendation requests share one upstream call even without a result cache', async () => {
  let calls = 0, release, started
  const gate = new Promise(resolve => { release = resolve })
  const providerStarted = new Promise(resolve => { started = resolve })
  const base = await start({ aiCacheTtlMs: 0, fetchImpl: async () => {
    calls++
    started()
    await gate
    return json(recommendationData())
  } })
  const first = recommend(base)
  const second = recommend(base, { ...input, preferences: {
    indoorOnly: false, transportMode: 'public', endTime: '19:00', startTime: '09:00', pace: 'balanced',
  } })
  await providerStarted
  // Allow both local HTTP requests to enter the server while the injected provider is blocked.
  await new Promise(resolve => setTimeout(resolve, 25))
  release()
  const responses = await Promise.all([first, second])
  assert.equal(calls, 1)
  const bodies = await Promise.all(responses.map(async response => {
    assert.equal(response.status, 200)
    return response.json()
  }))
  assert.deepEqual(bodies[0], bodies[1])
})

test('provider HTTP failures never trigger a hidden retry and a later manual attempt can recover', async () => {
  let calls = 0
  const base = await start({ fetchImpl: async () => {
    calls++
    return calls === 1 ? new Response('unavailable', { status: 503 }) : json(recommendationData())
  } })
  const failed = await recommend(base)
  assert.equal(failed.status, 502)
  assert.deepEqual(await failed.json(), { error: 'provider_failed' })
  assert.equal(calls, 1)
  assert.equal((await recommend(base)).status, 200)
  assert.equal(calls, 2)
  assert.equal((await recommend(base)).status, 200)
  assert.equal(calls, 2)
})
