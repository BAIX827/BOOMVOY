import assert from 'node:assert/strict'
import { acceptDownloadedSnapshot, createSyncSnapshot, downloadSnapshot, restoreLocalPhotos, uploadSnapshot } from '../src/syncClient'
import type { Profile, Trip } from '../src/types'
import { normalizeBackendUrl } from '../src/llm'
import { japanTrip, oceanRoadTrip } from '../src/data'
import { isSyncSnapshot, mergeImportedProfile } from '../src/syncSchema'
import { validateSnapshot as validateServerSnapshot } from '../server/snapshot-store.mjs'

const SYNC_TOKEN = 'correct-token-0123456789-abcdefgh'

const profile: Profile = { name: 'Ari', homeCity: 'Melbourne', homeCurrency: 'AUD', themePref: 'forest', locale: 'zh', backendUrl: 'https://api.example.com/api' }
const trip: Trip = {
  id: 'trip',
  name: 'Trip',
  origin: 'Melbourne',
  destinations: ['Tokyo'],
  startDate: '2026-10-01',
  endDate: '2026-10-01',
  travellers: 1,
  members: [{ id: 'member', name: 'Ari', role: 'owner', color: '#123456' }],
  budgetPerPerson: 2000,
  totalBudget: 2000,
  homeCurrency: 'AUD',
  theme: 'forest',
  cover: 'forest',
  transportModes: ['public'],
  days: [{
    id: 'day',
    date: '2026-10-01',
    city: 'Tokyo',
    weather: { condition: 'sunny', tMin: 15, tMax: 24, rainProb: 10, summary: 'Clear' },
    planA: [{ id: 'place', name: 'Place', category: 'culture', setting: 'indoor', photos: ['data:image/jpeg;base64,test'] }],
    planB: [],
    activePlan: 'A',
    transportMode: 'public',
  }],
  saved: [{
    id: 'saved',
    kind: 'place',
    name: 'My label',
    subtitle: 'provider data',
    status: 'interested',
    rating: 4.8,
    price: { amount: 20, currency: 'AUD' },
    votes: {},
    decision: { id: 'google:one', kind: 'hotel', name: 'Provider label', city: 'Tokyo', source: 'google', sourceUrl: 'https://www.google.com/maps' },
    meta: { decisionSource: 'google' },
  }],
  compares: [],
  bookings: [],
  budget: [],
  expenses: [],
  gifts: [],
  notes: '',
  share: { visibility: 'private' },
  createdAt: '2026-09-08',
  template: false,
}

const snapshot = createSyncSnapshot(profile, [trip, { ...trip, id: 'template', template: true }])
assert.equal(snapshot.trips.length, 1)
assert.equal('backendUrl' in snapshot.profile, false)
assert.equal(snapshot.trips[0].days[0].planA[0].photos, undefined)
assert.equal(snapshot.trips[0].saved[0].decision, undefined)
assert.equal(snapshot.trips[0].saved[0].rating, undefined)
assert.equal(snapshot.trips[0].saved[0].price, undefined)
assert.equal(snapshot.trips[0].saved[0].subtitle, undefined)
const dirtyTrip = {
  ...trip,
  providerPayload: 'drop',
  days: [{ ...trip.days[0], providerPayload: 'drop', planA: [{ ...trip.days[0].planA[0], providerPayload: 'drop' }] }],
  saved: [{ ...trip.saved[0], meta: { ...trip.saved[0].meta, address: 'drop' }, providerPayload: 'drop' }],
} as Trip
const allowlisted = createSyncSnapshot(profile, [dirtyTrip]).trips[0] as Trip & Record<string, unknown>
assert.equal(allowlisted.providerPayload, undefined)
assert.equal((allowlisted.days[0] as typeof trip.days[0] & Record<string, unknown>).providerPayload, undefined)
assert.equal((allowlisted.days[0].planA[0] as typeof trip.days[0]['planA'][0] & Record<string, unknown>).providerPayload, undefined)
assert.equal((allowlisted.saved[0] as typeof trip.saved[0] & Record<string, unknown>).providerPayload, undefined)
assert.deepEqual(allowlisted.saved[0].meta, { decisionSource: 'google' })
assert.equal(isSyncSnapshot(snapshot), true)
assert.equal(isSyncSnapshot({ schemaVersion: 1, profile: snapshot.profile, trips: [trip] }), false, 'Cloud snapshots reject local-only photos and provider facts')
assert.equal(isSyncSnapshot({ schemaVersion: 1, profile: snapshot.profile, trips: [trip] }, { allowLocalFields: true }), true, 'Local backups retain photos and provider facts')
const seedSnapshot = createSyncSnapshot(profile, [japanTrip(), oceanRoadTrip()])
assert.equal(isSyncSnapshot(seedSnapshot), true, 'The shipped seed trips satisfy the browser upload contract')
assert.deepEqual(validateServerSnapshot(seedSnapshot), seedSnapshot, 'The same seed snapshot satisfies the server contract')
assert.equal(isSyncSnapshot({ ...snapshot, trips: [{ ...snapshot.trips[0], travellers: 0 }] }), false)
assert.equal(isSyncSnapshot({ ...snapshot, trips: [{ ...snapshot.trips[0], days: [{ ...snapshot.trips[0].days[0], weather: { ...snapshot.trips[0].days[0].weather, rainProb: 101 } }] }] }), false)
assert.equal(isSyncSnapshot({ ...snapshot, trips: [{ ...snapshot.trips[0], days: [{ ...snapshot.trips[0].days[0], planA: [{ ...snapshot.trips[0].days[0].planA[0], ticketUrl: 'javascript:alert(1)' }] }] }] }), false)
assert.deepEqual(mergeImportedProfile({ name: 'New name' }, profile), {
  name: 'New name', homeCity: 'Melbourne', homeCurrency: 'AUD', themePref: 'forest', locale: 'zh',
})
assert.throws(() => mergeImportedProfile({ name: 123 }, profile), /invalid profile/)
assert.throws(() => mergeImportedProfile({ themePref: 'unknown' }, profile), /invalid profile/)
assert.throws(() => mergeImportedProfile({ locale: 'fr' }, profile), /invalid profile/)

const restored = restoreLocalPhotos(snapshot.trips, [trip])
assert.deepEqual(restored[0].days[0].planA[0].photos, ['data:image/jpeg;base64,test'])
assert.equal(normalizeBackendUrl('/api?target=elsewhere'), '')
assert.equal(normalizeBackendUrl('/api#broken'), '')
assert.equal(normalizeBackendUrl('https://api.example.com/api?target=elsewhere'), '')
assert.equal(normalizeBackendUrl('https://api.example.com/api/'), 'https://api.example.com/api')

const originalFetch = globalThis.fetch
const sessionDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
const syncMeta = new Map<string, string>()
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (key: string) => syncMeta.get(key) ?? null,
  setItem: (key: string, value: string) => { syncMeta.set(key, value) },
} })

try {
  let requestedHeaders: HeadersInit | undefined
  globalThis.fetch = (async (_input, init) => {
    requestedHeaders = init?.headers
    return new Response(JSON.stringify({ schemaVersion: 1, revision: 3, updatedAt: '2026-09-08T00:00:00.000Z', snapshot }), {
      headers: { 'Content-Type': 'application/json', ETag: '"r3"' },
    })
  }) as typeof fetch
  const backend = { baseUrl: 'https://sync-a.example/api', ready: true, fromEnv: false }
  const downloaded = await downloadSnapshot(backend, SYNC_TOKEN)
  assert.equal(new Headers(requestedHeaders).has('If-None-Match'), false, 'A manual download always fetches the remote snapshot')
  assert.equal(syncMeta.size, 0, 'A download does not advance the local revision before the user applies it')
  acceptDownloadedSnapshot(backend, downloaded.revision, downloaded.etag)
  assert.equal(syncMeta.size, 1)
  assert.match([...syncMeta.keys()][0], /sync-a\.example/)
  assert.throws(() => acceptDownloadedSnapshot({ ...backend, baseUrl: 'https://sync-b.example/api' }, 3, '"r2"'), /invalid sync revision/)

  let oversizedFetches = 0
  globalThis.fetch = (async () => { oversizedFetches += 1; return new Response() }) as typeof fetch
  const oversized = { ...snapshot, trips: snapshot.trips.map((entry, index) => index ? entry : { ...entry, notes: 'x'.repeat(4 * 1024 * 1024) }) }
  await assert.rejects(uploadSnapshot(backend, SYNC_TOKEN, oversized), /snapshot too large/)
  assert.equal(oversizedFetches, 0, 'An oversized upload is rejected before making an API call')

  await assert.rejects(downloadSnapshot(backend, 'too-short'), /invalid sync token/)
  assert.equal(oversizedFetches, 0, 'An invalid token is rejected before making an API call')

  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: 'revision_conflict', schemaVersion: 1, revision: 2, updatedAt: '2026-09-08T00:00:00.000Z', snapshot: null,
  }), { status: 409, headers: { 'Content-Type': 'application/json', ETag: '"r2"' } })) as typeof fetch
  await assert.rejects(uploadSnapshot(backend, SYNC_TOKEN, snapshot), /invalid sync response/)

  globalThis.fetch = (async () => new Response(JSON.stringify({
    schemaVersion: 1, revision: 4, updatedAt: null,
    snapshot: { schemaVersion: 1, profile: snapshot.profile, trips: [{ id: 'bad', days: 'not-an-array', saved: [] }] },
  }), { headers: { 'Content-Type': 'application/json', ETag: '"r4"' } })) as typeof fetch
  await assert.rejects(downloadSnapshot(backend, SYNC_TOKEN), /invalid sync response/)
} finally {
  globalThis.fetch = originalFetch
  if (sessionDescriptor) Object.defineProperty(globalThis, 'sessionStorage', sessionDescriptor)
  else Reflect.deleteProperty(globalThis, 'sessionStorage')
}

console.log('sync client tests passed')
