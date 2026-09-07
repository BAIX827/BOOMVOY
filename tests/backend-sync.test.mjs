import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBoomvoyServer } from '../server/decision-server.mjs'

const servers = []
const directories = []
const SYNC_TOKEN = 'correct-token-0123456789-abcdefgh'

async function start(syncToken = SYNC_TOKEN, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'boomvoy-sync-api-'))
  directories.push(directory)
  const server = createBoomvoyServer({
    syncToken,
    snapshotFilePath: join(directory, 'snapshot.json'),
    fetchImpl: async () => { throw new Error('snapshot route must not call an upstream provider') },
    ...options,
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
  await Promise.all(directories.map(directory => rm(directory, { recursive: true, force: true })))
})

const snapshot = {
  schemaVersion: 1,
  profile: {
    name: 'Boom', homeCity: 'Sydney', homeCurrency: 'AUD', themePref: 'ocean', locale: 'zh',
    backendUrl: 'https://must-not-sync.example/api', llmKey: 'must-not-sync',
  },
  trips: [
    {
      id: 'trip-1',
      name: 'Tokyo',
      origin: 'Sydney',
      destinations: ['Tokyo'],
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      travellers: 1,
      members: [{ id: 'member-1', name: 'Boom', role: 'owner', color: '#123456' }],
      budgetPerPerson: 2000,
      totalBudget: 2000,
      homeCurrency: 'AUD',
      theme: 'ocean',
      cover: 'ocean',
      transportModes: ['public'],
      days: [{
        id: 'day-1',
        date: '2026-10-01',
        city: 'Tokyo',
        weather: { condition: 'sunny', tMin: 15, tMax: 24, rainProb: 10, summary: 'Clear' },
        planA: [{ id: 'place-1', name: 'Museum', category: 'culture', setting: 'indoor', photos: ['data:image/png;base64,secret'] }],
        planB: [],
        activePlan: 'A',
        transportMode: 'public',
      }],
      saved: [],
      compares: [],
      bookings: [],
      budget: [],
      expenses: [],
      gifts: [],
      notes: '',
      share: { visibility: 'private' },
      createdAt: '2026-09-08',
    },
    { id: 'template-1', template: true, name: 'Template', days: [], saved: [] },
  ],
}

function auth(token = SYNC_TOKEN) {
  return { Authorization: `Bearer ${token}` }
}

test('server rejects a weak configured sync token', () => {
  assert.throws(() => createBoomvoyServer({ syncToken: 'too-short' }), /invalid server options/)
})

test('snapshot API requires an explicitly configured token', async () => {
  const base = await start('')
  const response = await fetch(`${base}/api/v1/me/snapshot`, { headers: auth() })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'sync_not_configured' })
})

test('snapshot API rejects bad auth without creating a revision', async () => {
  const base = await start()
  const rejected = await fetch(`${base}/api/v1/me/snapshot`, { headers: auth('wrong-token') })
  assert.equal(rejected.status, 401)
  assert.equal(rejected.headers.get('www-authenticate'), 'Bearer')

  const current = await fetch(`${base}/api/v1/me/snapshot`, { headers: auth() })
  assert.equal(current.status, 200)
  assert.equal((await current.json()).revision, 0)
})

test('snapshot authentication attempts share the client rate limit', async () => {
  const base = await start(SYNC_TOKEN, { rateLimit: 1 })
  assert.equal((await fetch(`${base}/api/v1/me/snapshot`, { headers: auth('wrong-token') })).status, 401)
  const limited = await fetch(`${base}/api/v1/me/snapshot`, { headers: auth('wrong-token') })
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
})

test('snapshot concurrency is bounded before cloning or writing more data', async () => {
  let started
  const began = new Promise(resolve => { started = resolve })
  let release
  const blocked = new Promise(resolve => { release = resolve })
  const snapshotStore = {
    async get() {
      started()
      await blocked
      return { schemaVersion: 1, revision: 0, updatedAt: null, snapshot: null, etag: '"r0"' }
    },
  }
  const base = await start(SYNC_TOKEN, { snapshotStore, snapshotConcurrency: 1 })
  const first = fetch(`${base}/api/v1/me/snapshot`, { headers: auth() })
  await began
  const limited = await fetch(`${base}/api/v1/me/snapshot`, { headers: auth() })
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).error, 'sync_busy')
  release()
  assert.equal((await first).status, 200)
})

test('snapshot API supports one-call upload, conditional download and CAS conflicts', async () => {
  const base = await start()
  const uploaded = await fetch(`${base}/api/v1/me/snapshot`, {
    method: 'PUT',
    headers: { ...auth(), 'Content-Type': 'application/json', 'If-Match': '"r0"', 'Idempotency-Key': 'request-0001' },
    body: JSON.stringify(snapshot),
  })
  assert.equal(uploaded.status, 200)
  assert.equal(uploaded.headers.get('etag'), '"r1"')
  assert.equal((await uploaded.json()).revision, 1)

  const downloaded = await fetch(`${base}/api/v1/me/snapshot`, { headers: auth() })
  assert.equal(downloaded.status, 200)
  assert.equal(downloaded.headers.get('etag'), '"r1"')
  const body = await downloaded.json()
  assert.equal(body.revision, 1)
  assert.equal(body.snapshot.profile.backendUrl, undefined)
  assert.equal(body.snapshot.profile.llmKey, undefined)
  assert.equal(body.snapshot.trips.length, 1)
  assert.equal(body.snapshot.trips[0].days[0].planA[0].photos, undefined)

  const unchanged = await fetch(`${base}/api/v1/me/snapshot`, { headers: { ...auth(), 'If-None-Match': '"r1"' } })
  assert.equal(unchanged.status, 304)

  const conflict = await fetch(`${base}/api/v1/me/snapshot`, {
    method: 'PUT',
    headers: { ...auth(), 'Content-Type': 'application/json', 'If-Match': '"r0"', 'Idempotency-Key': 'request-0002' },
    body: JSON.stringify(snapshot),
  })
  assert.equal(conflict.status, 409)
  assert.equal(conflict.headers.get('etag'), '"r1"')
  const conflictBody = await conflict.json()
  assert.equal(conflictBody.code, 'revision_conflict')
  assert.equal(conflictBody.revision, 1)
  assert.equal(conflictBody.snapshot.trips[0].id, 'trip-1')
})
