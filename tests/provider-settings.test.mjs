import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import { createBoomvoyServer } from '../server/decision-server.mjs'
import { createProviderSettingsStore, validateProviderSettingsPatch } from '../server/provider-settings.mjs'

// All keys and provider responses in this suite are inert fixtures. No .env or real provider is read.
const OPENAI = `sk-test-${'a'.repeat(42)}`, OPENAI_NEXT = `sk-proj-${'b'.repeat(52)}`
const GOOGLE = `AIza${'c'.repeat(35)}`, GOOGLE_NEXT = `AIza${'d'.repeat(35)}`
const OFFICIAL_URL = 'https://api.openai.com/v1/chat/completions'
const settingsPath = '/api/settings/providers'
const origin = 'http://127.0.0.1:5173'
const servers = [], directories = []
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const aiJson = content => json({ choices: [{ message: { content } }] })
const chatBody = { question: 'What is my next step?', locale: 'en', page: '/trip/example/plan' }
const recommendationBody = { city: 'Tokyo', locale: 'en', preferences: { pace: 'balanced', startTime: '09:00', endTime: '18:00', transportMode: 'public', indoorOnly: false } }
const decisionBody = { locale: 'en', preferences: { kind: 'hotel', city: 'Tokyo', currency: 'JPY', cuisine: 'any', minRating: 4, minReviews: 20,
  travellers: 2, seaView: false, parking: false, freeParking: false, variety: false, checkin: '', checkout: '' } }

async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'boomvoy-provider-settings-'))
  directories.push(path)
  return path
}
async function start(options = {}) {
  const server = createBoomvoyServer({ apiKey: '', openaiApiKey: '', openaiApiUrl: OFFICIAL_URL,
    rateLimit: 1000, fetchImpl: async () => { throw new Error('unexpected provider call') }, ...options })
  servers.push(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { server, base: `http://127.0.0.1:${server.address().port}` }
}
after(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })))
  await Promise.all(directories.map(path => rm(path, { recursive: true, force: true })))
})
const get = (base, headers = {}) => fetch(`${base}${settingsPath}`, { headers: { Origin: origin, ...headers } })
const rawGet = (base, headers) => new Promise((resolve, reject) => {
  const request = http.get(`${base}${settingsPath}`, { headers }, response => {
    const chunks = []
    response.on('data', chunk => chunks.push(chunk))
    response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })))
  })
  request.on('error', reject)
})
const put = (base, csrfToken, patch, headers = {}) => fetch(`${base}${settingsPath}`, { method: 'PUT',
  headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Boomvoy-Settings-Token': csrfToken, ...headers }, body: JSON.stringify(patch) })
const post = (base, path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const readStatus = async base => { const response = await get(base); assert.equal(response.status, 200); return response.json() }
function noKeys(value) {
  const text = JSON.stringify(value)
  for (const key of [OPENAI, OPENAI_NEXT, GOOGLE, GOOGLE_NEXT]) assert.equal(text.includes(key), false)
}

test('settings expose only configuration and nonce; saving trims keys, persists and survives restart', async () => {
  const filePath = join(await directory(), 'private', 'provider-keys.json')
  const { base } = await start({ settingsFilePath: filePath })
  const response = await get(base)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const initial = await response.json()
  assert.deepEqual({ ...initial, csrfToken: 'nonce' }, { editable: true, csrfToken: 'nonce', openai: { configured: false, source: 'none' }, google: { configured: false, source: 'none' } })
  assert.match(initial.csrfToken, /^[A-Za-z0-9_-]{43}$/)
  assert.equal((await put(base, initial.csrfToken, { openaiApiKey: ` \n${OPENAI}\n`, googleApiKey: GOOGLE })).status, 200)
  const saved = await readStatus(base)
  assert.deepEqual(saved.openai, { configured: true, source: 'saved' })
  assert.deepEqual(saved.google, { configured: true, source: 'saved' })
  noKeys(saved)
  assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), { version: 1, openaiApiKey: OPENAI, googleApiKey: GOOGLE })
  assert.deepEqual(await readdir(join(filePath, '..')), ['provider-keys.json'])
  if (process.platform !== 'win32') {
    assert.equal((await stat(filePath)).mode & 0o777, 0o600)
    assert.equal((await stat(join(filePath, '..'))).mode & 0o777, 0o700)
  }
  const restarted = await start({ settingsFilePath: filePath })
  const restored = await readStatus(restarted.base)
  assert.deepEqual(restored.openai, saved.openai)
  assert.deepEqual(restored.google, saved.google)
  assert.notEqual(restored.csrfToken, saved.csrfToken)
  noKeys(restored)
})

test('one-provider updates preserve the other; remove falls back to environment without editing it', async () => {
  const filePath = join(await directory(), 'provider-keys.json')
  const { base } = await start({ settingsFilePath: filePath, openaiApiKey: OPENAI, apiKey: GOOGLE })
  const initial = await readStatus(base)
  assert.equal(initial.openai.source, 'environment')
  assert.equal(initial.google.source, 'environment')
  assert.equal((await put(base, initial.csrfToken, { openaiApiKey: OPENAI_NEXT, googleApiKey: GOOGLE_NEXT })).status, 200)
  const removed = await (await put(base, initial.csrfToken, { openaiApiKey: null })).json()
  assert.deepEqual(removed.openai, { configured: true, source: 'environment' })
  assert.deepEqual(removed.google, { configured: true, source: 'saved' })
  assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), { version: 1, googleApiKey: GOOGLE_NEXT })
  const noEnvironment = await start({ settingsFilePath: filePath })
  const status = await readStatus(noEnvironment.base)
  assert.deepEqual(status.openai, { configured: false, source: 'none' })
  noKeys(removed)
})

test('invalid key formats, unknown fields, control characters and large bodies never change settings', async () => {
  const { base } = await start()
  const initial = await readStatus(base)
  for (const patch of [{}, [], null, { apiKey: OPENAI }, { openaiApiKey: '' }, { openaiApiKey: ' ' },
    { openaiApiKey: 'Bearer ' + OPENAI }, { openaiApiKey: OPENAI + '\ninside' }, { openaiApiKey: OPENAI + '\0' },
    { googleApiKey: 'sk-' + 'x'.repeat(40) }, { googleApiKey: 42 }, { openaiApiKey: 'sk-' + 'x'.repeat(510) }]) {
    const response = await put(base, initial.csrfToken, patch)
    assert.equal(response.status, 400)
    noKeys(await response.json())
  }
  const large = await put(base, initial.csrfToken, { openaiApiKey: 'x'.repeat(5000) })
  assert.equal(large.status, 413)
  assert.deepEqual(await readStatus(base), initial)
  assert.deepEqual(validateProviderSettingsPatch({ openaiApiKey: OPENAI_NEXT }), { openaiApiKey: OPENAI_NEXT })
})

test('settings require nonce and strict JSON; preflights allow only the settings contract', async () => {
  const { base } = await start()
  const initial = await readStatus(base)
  for (const token of ['', 'wrong', initial.csrfToken + 'x']) {
    const response = await put(base, token, { openaiApiKey: OPENAI })
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'settings_token_invalid' })
  }
  for (const headers of [{ 'Content-Type': 'text/plain' }, { 'Content-Type': 'application/json; arbitrary=true' }, { 'Content-Encoding': 'gzip' }]) {
    assert.equal((await put(base, initial.csrfToken, { openaiApiKey: OPENAI }, headers)).status, 415)
  }
  const preflight = async headers => fetch(`${base}${settingsPath}`, { method: 'OPTIONS', headers: { Origin: origin,
    'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type, x-boomvoy-settings-token', ...headers } })
  const allowed = await preflight({})
  assert.equal(allowed.status, 204)
  assert.equal(allowed.headers.get('access-control-allow-origin'), origin)
  assert.equal((await preflight({ 'Access-Control-Request-Method': 'POST' })).status, 403)
  assert.equal((await preflight({ 'Access-Control-Request-Headers': 'authorization' })).status, 403)
  assert.equal((await fetch(`${base}${settingsPath}`, { method: 'POST' })).status, 405)
  assert.deepEqual(await readStatus(base), initial)
})

test('settings reject public hosts, public origins and remote sockets even if general API permits them', async () => {
  const { base, server } = await start({ allowedHosts: ['127.0.0.1', 'app.example'], allowedOrigins: ['https://app.example', origin] })
  for (const headers of [{ Origin: 'https://app.example' }, { Host: 'app.example' }, { Host: 'user@127.0.0.1' },
    { Origin: 'null' }, { Origin: 'http://127.0.0.1:5173/path' }, { Origin: 'http://localhost.evil.example:5173' }]) {
    const response = await rawGet(base, { Origin: origin, ...headers })
    assert.equal(response.status, 403)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
    assert.deepEqual(await response.json(), { error: 'settings_local_only' })
  }
  assert.equal((await fetch(`${base}${settingsPath}`)).status, 200, 'direct local same-origin clients need no Origin')
  assert.equal((await fetch(`${base}${settingsPath}`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
  const remote = await new Promise(resolve => {
    const response = { setHeader() {}, writeHead(status) { this.status = status }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }) } }
    server.emit('request', { url: settingsPath, method: 'GET', headers: { host: '127.0.0.1:8787' }, socket: { remoteAddress: '192.0.2.10' } }, response)
  })
  assert.deepEqual(remote, { status: 403, body: { error: 'settings_local_only' } })
})

test('persistence and malformed-file failures are safe and never publish unsuccessful updates', async () => {
  const unavailable = { get: async () => ({}), put: async () => { throw new Error(`private detail ${OPENAI_NEXT}`) } }
  let observed
  const { base } = await start({ openaiApiKey: OPENAI, settingsStore: unavailable, fetchImpl: async (_url, options) => {
    observed = options.headers.Authorization; return aiJson('Use Plan.')
  } })
  const initial = await readStatus(base)
  const failed = await put(base, initial.csrfToken, { openaiApiKey: OPENAI_NEXT })
  assert.equal(failed.status, 503)
  assert.deepEqual(await failed.json(), { error: 'settings_unavailable' })
  assert.deepEqual(await readStatus(base), initial)
  assert.equal((await post(base, '/api/ai/chat', chatBody)).status, 200)
  assert.equal(observed, `Bearer ${OPENAI}`)
  const filePath = join(await directory(), 'provider-keys.json')
  for (const text of ['{broken', JSON.stringify({ version: 1, openaiApiKey: OPENAI, unexpected: true }), 'x'.repeat(5000)]) {
    await writeFile(filePath, text)
    const malformed = await start({ settingsFilePath: filePath })
    const response = await get(malformed.base)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'settings_unavailable' })
  }
})

test('atomic store writes serialize concurrent independent patches and leave no temporary secret files', async () => {
  const filePath = join(await directory(), 'provider-keys.json')
  const store = createProviderSettingsStore({ filePath })
  await Promise.all([store.put({ openaiApiKey: OPENAI }), store.put({ googleApiKey: GOOGLE })])
  assert.deepEqual(await store.get(), { openaiApiKey: OPENAI, googleApiKey: GOOGLE })
  assert.deepEqual(await createProviderSettingsStore({ filePath }).get(), await store.get())
  assert.deepEqual(await readdir(join(filePath, '..')), ['provider-keys.json'])
})

test('failed atomic replacement preserves the previously loaded runtime state and removes its temporary file', async () => {
  const directoryPath = await directory(), filePath = join(directoryPath, 'provider-keys.json')
  const store = createProviderSettingsStore({ filePath })
  assert.deepEqual(await store.get(), {})
  await mkdir(filePath)
  await assert.rejects(store.put({ openaiApiKey: OPENAI }), error => error.code === 'settings_unavailable')
  assert.deepEqual(await store.get(), {})
  assert.deepEqual(await readdir(directoryPath), ['provider-keys.json'])
})

test('new saved keys are used immediately by chat, recommendations and Google search; save does not call providers', async () => {
  const calls = []
  const { base } = await start({ fetchImpl: async (url, options) => {
    calls.push({ url, options })
    if (url.includes('places.googleapis.com')) return json({ places: [] })
    if (JSON.parse(options.body).messages[0].content.includes('geographically coherent')) {
      return aiJson(JSON.stringify({ suggestions: [{ title: 'Ueno', vibe: '', places: [{ name: 'Tokyo National Museum', category: 'sight', setting: 'indoor', durationMin: 60 }] }] }))
    }
    return aiJson('Open Plan.')
  } })
  const initial = await readStatus(base)
  assert.equal((await put(base, initial.csrfToken, { openaiApiKey: OPENAI, googleApiKey: GOOGLE })).status, 200)
  assert.equal(calls.length, 0)
  assert.equal((await post(base, '/api/ai/chat', chatBody)).status, 200)
  assert.equal((await post(base, '/api/recommendations/day', recommendationBody)).status, 200)
  assert.equal((await post(base, '/api/decisions/search', decisionBody)).status, 200)
  assert.equal(calls.length, 3)
  for (const call of calls.slice(0, 2)) { assert.equal(call.url, OFFICIAL_URL); assert.equal(call.options.headers.Authorization, `Bearer ${OPENAI}`) }
  assert.equal(calls[2].options.headers['X-Goog-Api-Key'], GOOGLE)
  assert.equal(calls.some(call => call.options.body.includes(OPENAI) || call.options.body.includes(GOOGLE)), false)
})

test('changing OpenAI keys isolates in-flight and cached results, including late replies from the old key', async () => {
  let release, started
  const gate = new Promise(resolve => { release = resolve }), entered = new Promise(resolve => { started = resolve })
  const calls = []
  const { base } = await start({ openaiApiKey: OPENAI, fetchImpl: async (_url, options) => {
    const key = options.headers.Authorization
    calls.push(key)
    if (key === `Bearer ${OPENAI}`) { started(); await gate; return aiJson('Old reply.') }
    return aiJson('New reply.')
  } })
  const initial = await readStatus(base)
  const old = post(base, '/api/ai/chat', chatBody)
  await entered
  assert.equal((await put(base, initial.csrfToken, { openaiApiKey: OPENAI_NEXT })).status, 200)
  const current = await post(base, '/api/ai/chat', chatBody)
  assert.deepEqual(await current.json(), { text: 'New reply. 喵' })
  release()
  assert.deepEqual(await (await old).json(), { text: 'Old reply. 喵' })
  assert.deepEqual(await (await post(base, '/api/ai/chat', chatBody)).json(), { text: 'New reply. 喵' })
  assert.deepEqual(calls, [`Bearer ${OPENAI}`, `Bearer ${OPENAI_NEXT}`])
})

test('changing Google keys never joins work running under the old key', async () => {
  let release, started
  const gate = new Promise(resolve => { release = resolve }), entered = new Promise(resolve => { started = resolve })
  const calls = []
  const { base } = await start({ apiKey: GOOGLE, fetchImpl: async (_url, options) => {
    calls.push(options.headers['X-Goog-Api-Key'])
    if (calls.length === 1) { started(); await gate }
    return json({ places: [] })
  } })
  const initial = await readStatus(base)
  const old = post(base, '/api/decisions/search', decisionBody)
  await entered
  assert.equal((await put(base, initial.csrfToken, { googleApiKey: GOOGLE_NEXT })).status, 200)
  assert.equal((await post(base, '/api/decisions/search', decisionBody)).status, 200)
  release()
  assert.equal((await old).status, 200)
  assert.deepEqual(calls, [GOOGLE, GOOGLE_NEXT])
})

test('concurrent save then removal each publish a fresh cache generation', async () => {
  const memory = createProviderSettingsStore()
  let releaseSave, releaseRemove, beganSave, beganRemove
  const saveGate = new Promise(resolve => { releaseSave = resolve }), removeGate = new Promise(resolve => { releaseRemove = resolve })
  const saving = new Promise(resolve => { beganSave = resolve }), removing = new Promise(resolve => { beganRemove = resolve })
  const settingsStore = { get: memory.get, put: async patch => {
    const result = await memory.put(patch)
    if (patch.openaiApiKey === null) { beganRemove(); await removeGate }
    else { beganSave(); await saveGate }
    return result
  } }
  const calls = []
  const { base } = await start({ settingsStore, openaiApiKey: OPENAI, fetchImpl: async (_url, options) => {
    const key = options.headers.Authorization
    calls.push(key)
    return aiJson(key === `Bearer ${OPENAI}` ? 'Environment reply.' : 'Saved reply.')
  } })
  const initial = await readStatus(base)
  const save = put(base, initial.csrfToken, { openaiApiKey: OPENAI_NEXT })
  await saving
  const remove = put(base, initial.csrfToken, { openaiApiKey: null })
  await removing
  releaseSave()
  assert.equal((await save).status, 200)
  assert.deepEqual(await (await post(base, '/api/ai/chat', chatBody)).json(), { text: 'Saved reply. 喵' })
  releaseRemove()
  assert.equal((await remove).status, 200)
  assert.deepEqual(await (await post(base, '/api/ai/chat', chatBody)).json(), { text: 'Environment reply. 喵' })
  assert.deepEqual(calls, [`Bearer ${OPENAI_NEXT}`, `Bearer ${OPENAI}`])
})

test('OpenAI keys saved in Profile never go to a custom compatible endpoint', async () => {
  const customUrl = 'https://compatible.example/v1/chat/completions'
  const { base } = await start({ openaiApiUrl: customUrl })
  const initial = await readStatus(base)
  const rejected = await put(base, initial.csrfToken, { openaiApiKey: OPENAI })
  assert.equal(rejected.status, 409)
  assert.deepEqual(await rejected.json(), { error: 'settings_openai_endpoint' })
  const filePath = join(await directory(), 'provider-keys.json')
  await createProviderSettingsStore({ filePath }).put({ openaiApiKey: OPENAI })
  let calledUrl
  const restored = await start({ openaiApiUrl: customUrl, settingsFilePath: filePath, fetchImpl: async url => { calledUrl = url; return aiJson('Use Plan.') } })
  assert.equal((await post(restored.base, '/api/ai/chat', chatBody)).status, 200)
  assert.equal(calledUrl, OFFICIAL_URL)
})
