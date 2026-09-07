import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  MAX_SNAPSHOT_BYTES,
  SnapshotValidationError,
  createSnapshotStore,
  sanitizeSnapshot,
  validateSnapshot,
} from '../server/snapshot-store.mjs'

function place(id = 'place-1') {
  return { id, name: 'Museum', category: 'culture', setting: 'indoor' }
}

function day(id = 'day-1', planA = [place()], planB = []) {
  return {
    id,
    date: '2026-10-01',
    city: 'Tokyo',
    weather: { condition: 'sunny', tMin: 14, tMax: 22, rainProb: 10, summary: 'Clear' },
    planA,
    planB,
    activePlan: 'A',
    transportMode: 'public',
  }
}

function trip(name = 'Trip one') {
  return {
    id: 'trip-1',
    name,
    origin: 'Melbourne',
    destinations: ['Tokyo'],
    startDate: '2026-10-01',
    endDate: '2026-10-02',
    travellers: 1,
    members: [{ id: 'member-1', name: 'Ari', role: 'owner', color: '#123456' }],
    budgetPerPerson: 2000,
    totalBudget: 2000,
    homeCurrency: 'AUD',
    theme: 'forest',
    cover: 'forest',
    transportModes: ['public'],
    days: [day()],
    saved: [{ id: 'saved-1', kind: 'place', name: 'Museum', status: 'interested', votes: {} }],
    compares: [{ id: 'compare-1', kind: 'place', title: 'Places', itemIds: ['saved-1'] }],
    bookings: [{ id: 'booking-1', kind: 'hotel', name: 'Hotel', status: 'need' }],
    budget: [{ id: 'budget-1', name: 'General', estimated: 100, booked: 0, paid: 0 }],
    expenses: [{ id: 'expense-1', title: 'Train', amount: 20, currency: 'AUD', category: 'Transport', date: '2026-10-01', paidBy: 'member-1', split: 'equal', excluded: [], status: 'estimated' }],
    gifts: [{ id: 'gift-1', forWhom: 'Friend', item: 'Postcard', status: 'need' }],
    packing: {
      phase: 'out',
      groupBy: 'category',
      dismissed: [],
      items: [{ id: 'pack-1', name: 'Passport', category: 'docs', bag: 'personal', qty: 1, packedOut: false, packedBack: false }],
    },
    notes: '',
    share: { visibility: 'private' },
    createdAt: '2026-09-07',
    decisionPreferences: {
      kind: 'hotel', city: 'Tokyo', currency: 'AUD', seaView: false, parking: false, freeParking: false,
      cuisine: 'any', variety: false, minRating: 0, minReviews: 0,
      checkin: '2026-10-01', checkout: '2026-10-02', travellers: 1,
    },
    mealSelections: [{ date: '2026-10-01', city: 'Tokyo', cuisine: 'any', savedId: 'saved-1' }],
  }
}

function snapshot(name = 'Trip one') {
  return {
    schemaVersion: 1,
    profile: {
      name: 'Ari',
      homeCity: 'Melbourne',
      homeCurrency: 'AUD',
      themePref: 'auto',
      locale: 'zh',
    },
    trips: [trip(name)],
  }
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

async function temporaryStore(run, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'boomvoy-snapshot-'))
  const filePath = join(directory, 'snapshot.json')
  try {
    await run({ directory, filePath, store: createSnapshotStore({ filePath, ...options }) })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('snapshot sanitizer applies the cloud payload allowlist', () => {
  const input = {
    schemaVersion: 1,
    profile: {
      name: 'Ari', homeCity: 'Melbourne', homeCurrency: 'AUD', themePref: 'forest', locale: 'en',
      llmKey: 'secret', llmUrl: 'https://llm.invalid', llmModel: 'private-model', decisionApiUrl: 'https://decision.invalid', extra: 'drop me',
    },
    trips: [
      { id: 'template-gor', template: true, days: [], saved: [] },
      {
        id: 'trip-1', name: 'Private trip', notes: 'keep user data', providerTrip: 'drop me',
        days: [{
          id: 'day-1', providerDay: 'drop me',
          planA: [{ id: 'a', name: 'Beach', photos: ['data:image/jpeg;base64,aaa'], feeling: 'keep', providerPlace: 'drop me' }],
          planB: [{ id: 'b', photos: ['data:image/jpeg;base64,bbb'] }],
        }],
        saved: [
          {
            id: 'google', name: 'Chosen label', subtitle: 'provider subtitle', rating: 4.8,
            price: { amount: 10 }, decision: { source: 'google', address: 'provider address' },
            meta: { decisionSource: 'google', decisionId: 'google:abc', city: 'Tokyo', providerRaw: 'drop me' },
            providerSaved: 'drop me',
          },
          {
            id: 'curated', rating: 4.2, providerSaved: 'drop me',
            decision: {
              source: 'curated', name: 'Keep curated', providerDecision: 'drop me',
              price: { max: 20, currency: 'AUD', basis: 'person', providerPrice: 'drop me' },
              rating: { value: 4.2, sourceUrl: 'https://example.com/rating', providerRating: 'drop me' },
              attributions: [{ name: 'Guide', providerAttribution: 'drop me' }],
            },
            meta: { decisionSource: 'curated', customLabel: 'keep me' },
          },
        ],
      },
    ],
  }

  const clean = sanitizeSnapshot(input)
  assert.deepEqual(clean.profile, { name: 'Ari', homeCity: 'Melbourne', homeCurrency: 'AUD', themePref: 'forest', locale: 'en' })
  assert.equal(clean.trips.length, 1)
  assert.equal(clean.trips[0].notes, 'keep user data')
  assert.equal('providerTrip' in clean.trips[0], false)
  assert.equal('providerDay' in clean.trips[0].days[0], false)
  assert.equal('photos' in clean.trips[0].days[0].planA[0], false)
  assert.equal('photos' in clean.trips[0].days[0].planB[0], false)
  assert.equal('providerPlace' in clean.trips[0].days[0].planA[0], false)
  assert.equal(clean.trips[0].days[0].planA[0].feeling, 'keep')
  assert.deepEqual(clean.trips[0].saved[0], {
    id: 'google', name: 'Chosen label', meta: { decisionSource: 'google', decisionId: 'google:abc', city: 'Tokyo' },
  })
  assert.equal(Object.hasOwn(clean.trips[0].saved[1], 'providerSaved'), false)
  assert.deepEqual(clean.trips[0].saved[1].decision, {
    source: 'curated', name: 'Keep curated',
    price: { max: 20, currency: 'AUD', basis: 'person' },
    rating: { value: 4.2, sourceUrl: 'https://example.com/rating' },
    attributions: [{ name: 'Guide' }],
  })
  assert.equal(clean.trips[0].saved[1].rating, 4.2)
  assert.deepEqual(clean.trips[0].saved[1].meta, { decisionSource: 'curated', customLabel: 'keep me' })
})

test('store persists only schema v1 fields at every nested object boundary', async () => {
  const input = snapshot()
  input.providerTop = 'drop me'
  const value = input.trips[0]
  value.providerTrip = 'drop me'
  value.members[0].providerMember = 'drop me'
  value.days[0].providerDay = 'drop me'
  value.days[0].weather.providerWeather = 'drop me'
  value.days[0].planA[0].providerPlace = 'drop me'
  value.days[0].planA[0].photos = ['data:image/jpeg;base64,aaa']
  value.days[0].planA[0].coords = { lat: 35.68, lng: 139.76, providerCoords: 'drop me' }
  value.days[0].planA[0].cost = { amount: 20, currency: 'AUD', status: 'estimated', providerMoney: 'drop me' }

  value.saved[0].providerSaved = 'drop me'
  value.saved[0].price = { amount: 25, currency: 'AUD', providerMoney: 'drop me' }
  value.saved[0].priceHistory = [{ date: '2026-09-01', amount: 30, providerHistory: 'drop me' }]
  value.saved[0].meta = { decisionSource: 'curated', customLabel: 'keep me' }
  value.saved[0].decision = {
    id: 'candidate-1', kind: 'hotel', name: 'Curated hotel', city: 'Tokyo', source: 'curated',
    sourceUrl: 'https://example.com/hotel', providerDecision: 'drop me',
    price: { min: 100, max: 150, currency: 'AUD', basis: 'night', providerPrice: 'drop me' },
    rating: { value: 4.5, count: 10, sourceUrl: 'https://example.com/rating', providerRating: 'drop me' },
    attributions: [{ name: 'Independent guide', url: 'https://example.com/guide', providerAttribution: 'drop me' }],
  }
  value.compares[0].providerCompare = 'drop me'
  value.bookings[0].providerBooking = 'drop me'
  value.bookings[0].cost = { amount: 500, currency: 'AUD', providerMoney: 'drop me' }
  value.budget[0].providerBudget = 'drop me'
  value.expenses[0].providerExpense = 'drop me'
  value.gifts[0].providerGift = 'drop me'
  value.packing.providerPacking = 'drop me'
  value.packing.items[0].providerPackItem = 'drop me'
  value.share.providerShare = 'drop me'
  value.decisionPreferences.providerPreferences = 'drop me'
  value.mealSelections[0].providerMeal = 'drop me'

  await temporaryStore(async ({ store }) => {
    await store.put({ snapshot: input, expectedRevision: 0, idempotencyKey: 'allowlist-0001' })
    const clean = (await store.get()).snapshot
    const cleanTrip = clean.trips[0]
    const cleanDay = cleanTrip.days[0]
    const cleanPlace = cleanDay.planA[0]
    const cleanSaved = cleanTrip.saved[0]
    const cleanDecision = cleanSaved.decision

    for (const [record, field] of [
      [clean, 'providerTop'], [cleanTrip, 'providerTrip'], [cleanTrip.members[0], 'providerMember'],
      [cleanDay, 'providerDay'], [cleanDay.weather, 'providerWeather'], [cleanPlace, 'providerPlace'],
      [cleanPlace.coords, 'providerCoords'], [cleanPlace.cost, 'providerMoney'], [cleanSaved, 'providerSaved'],
      [cleanSaved.price, 'providerMoney'], [cleanSaved.priceHistory[0], 'providerHistory'],
      [cleanDecision, 'providerDecision'], [cleanDecision.price, 'providerPrice'],
      [cleanDecision.rating, 'providerRating'], [cleanDecision.attributions[0], 'providerAttribution'],
      [cleanTrip.compares[0], 'providerCompare'], [cleanTrip.bookings[0], 'providerBooking'],
      [cleanTrip.bookings[0].cost, 'providerMoney'], [cleanTrip.budget[0], 'providerBudget'],
      [cleanTrip.expenses[0], 'providerExpense'], [cleanTrip.gifts[0], 'providerGift'],
      [cleanTrip.packing, 'providerPacking'], [cleanTrip.packing.items[0], 'providerPackItem'],
      [cleanTrip.share, 'providerShare'], [cleanTrip.decisionPreferences, 'providerPreferences'],
      [cleanTrip.mealSelections[0], 'providerMeal'],
    ]) assert.equal(Object.hasOwn(record, field), false, `${field} must not be persisted`)

    assert.equal(Object.hasOwn(cleanPlace, 'photos'), false)
    assert.equal(cleanSaved.meta.customLabel, 'keep me', 'non-Google string metadata remains user-owned')
  }, { now: () => new Date('2026-09-07T10:00:00Z') })
})

test('sanitizer keeps invalid known fields for the validator to reject', () => {
  const input = snapshot()
  input.trips[0].bookings[0].cost = { amount: 'not-a-number', currency: 'AUD', providerMoney: 'drop me' }

  const clean = sanitizeSnapshot(input)
  assert.equal(clean.trips[0].bookings[0].cost.amount, 'not-a-number')
  assert.equal(Object.hasOwn(clean.trips[0].bookings[0].cost, 'providerMoney'), false)
  assert.throws(() => validateSnapshot(input), /bookings\[0\]\.cost\.amount must be a finite number/)
})

test('validator accepts the complete UI shape and requires every Trip scalar and array', () => {
  assert.deepEqual(validateSnapshot(snapshot()), snapshot())

  for (const field of ['name', 'origin', 'destinations', 'startDate', 'endDate', 'travellers', 'members',
    'budgetPerPerson', 'totalBudget', 'homeCurrency', 'theme', 'cover', 'transportModes', 'days', 'saved',
    'compares', 'bookings', 'budget', 'expenses', 'gifts', 'notes', 'share', 'createdAt']) {
    const input = copy(snapshot())
    delete input.trips[0][field]
    assert.throws(() => validateSnapshot(input), new RegExp(`trips\\[0\\]\\.${field}`), `${field} must be required`)
  }

  for (const field of ['name', 'homeCity', 'homeCurrency', 'themePref']) {
    const input = copy(snapshot())
    delete input.profile[field]
    assert.throws(() => validateSnapshot(input), new RegExp(`profile\\.${field}`), `${field} must be required`)
  }
})

test('validator requires consumable days and rejects duplicate trip, day and place ids', () => {
  const missingPlan = copy(snapshot())
  delete missingPlan.trips[0].days[0].planA
  assert.throws(() => validateSnapshot(missingPlan), /trips\[0\]\.days\[0\]\.planA must be an array/)

  const missingPlaceId = copy(snapshot())
  delete missingPlaceId.trips[0].days[0].planA[0].id
  assert.throws(() => validateSnapshot(missingPlaceId), /trips\[0\]\.days\[0\]\.planA\[0\]\.id/)

  const duplicateTrips = copy(snapshot())
  duplicateTrips.trips.push(copy(duplicateTrips.trips[0]))
  assert.throws(() => validateSnapshot(duplicateTrips), /trips contains duplicate id trip-1/)

  const duplicateDays = copy(snapshot())
  duplicateDays.trips[0].days.push(day('day-1', [], []))
  assert.throws(() => validateSnapshot(duplicateDays), /trips\[0\]\.days contains duplicate id day-1/)

  const duplicatePlaces = copy(snapshot())
  duplicatePlaces.trips[0].days[0].planB.push(place('place-1'))
  assert.throws(() => validateSnapshot(duplicatePlaces), /trips\[0\]\.places contains duplicate id place-1/)
})

test('validator rejects unsupported schemas, invalid nested collection members and requests above 4 MB', () => {
  assert.throws(() => validateSnapshot({ ...snapshot(), schemaVersion: 2 }), (error) => {
    assert.equal(error instanceof SnapshotValidationError, true)
    assert.equal(error.code, 'unsupported_schema')
    return true
  })
  const badSaved = copy(snapshot())
  badSaved.trips[0].saved[0].votes = []
  assert.throws(() => validateSnapshot(badSaved), /trips\[0\]\.saved\[0\]\.votes must be an object/)
  assert.throws(() => validateSnapshot({ ...snapshot(), ignored: 'x'.repeat(MAX_SNAPSHOT_BYTES) }), (error) => {
    assert.equal(error.code, 'payload_too_large')
    assert.equal(error.status, 413)
    return true
  })
})

test('validator enforces semantic bounds while preserving the legacy saved rating scale', () => {
  const legacyRating = copy(snapshot())
  legacyRating.trips[0].saved[0].rating = 8.8
  assert.equal(validateSnapshot(legacyRating).trips[0].saved[0].rating, 8.8)

  for (const mutate of [
    (input) => { input.trips[0].travellers = 0 },
    (input) => { input.trips[0].days[0].weather.rainProb = 101 },
    (input) => { input.trips[0].days[0].planA[0].coords = { lat: 91, lng: 0 } },
    (input) => { input.trips[0].days[0].planA[0].ticketUrl = 'javascript:alert(1)' },
    (input) => { input.trips[0].startDate = '2026-02-30' },
    (input) => { input.trips[0].saved[0].rating = 10.1 },
  ]) {
    const invalid = copy(snapshot())
    mutate(invalid)
    assert.throws(() => validateSnapshot(invalid), SnapshotValidationError)
  }
})

test('store creates the first revision and upgrades it with compare-and-swap', async () => {
  const dates = [new Date('2026-09-07T10:00:00Z'), new Date('2026-09-07T10:01:00Z')]
  await temporaryStore(async ({ directory, store }) => {
    assert.deepEqual(await store.get(), {
      ok: true, schemaVersion: 1, revision: 0, updatedAt: null, snapshot: null, etag: '"r0"',
    })

    const first = await store.put({ snapshot: snapshot(), expectedRevision: 0, idempotencyKey: 'mutation-0001' })
    assert.deepEqual(first, {
      ok: true, schemaVersion: 1, revision: 1, updatedAt: '2026-09-07T10:00:00.000Z', etag: '"r1"', replayed: false,
    })
    const second = await store.put({ snapshot: snapshot('Trip renamed'), expectedRevision: 1, idempotencyKey: 'mutation-0002' })
    assert.equal(second.revision, 2)
    assert.equal(second.etag, '"r2"')
    assert.equal((await store.get()).snapshot.trips[0].name, 'Trip renamed')

    const files = await readdir(directory)
    assert.deepEqual(files, ['snapshot.json'], 'temporary files are renamed away after a successful write')
  }, { now: () => dates.shift() })
})

test('store returns the current snapshot on a revision conflict', async () => {
  await temporaryStore(async ({ store }) => {
    await store.put({ snapshot: snapshot(), expectedRevision: 0, idempotencyKey: 'mutation-0001' })
    const result = await store.put({ snapshot: snapshot('Stale edit'), expectedRevision: 0, idempotencyKey: 'mutation-0002' })
    assert.equal(result.ok, false)
    assert.equal(result.conflict, true)
    assert.equal(result.code, 'revision_conflict')
    assert.equal(result.revision, 1)
    assert.equal(result.etag, '"r1"')
    assert.equal(result.snapshot.trips[0].name, 'Trip one')
  }, { now: () => new Date('2026-09-07T10:00:00Z') })
})

test('an idempotent retry replays its original acknowledgement', async () => {
  let clockCalls = 0
  await temporaryStore(async ({ store }) => {
    const request = { snapshot: snapshot(), expectedRevision: 0, idempotencyKey: 'mutation-0001' }
    const first = await store.put(request)
    const replay = await store.put(request)
    assert.equal(first.replayed, false)
    assert.deepEqual(replay, { ...first, replayed: true })
    assert.equal((await store.get()).revision, 1)
    assert.equal(clockCalls, 1)

    const reused = await store.put({ snapshot: snapshot('Different body'), expectedRevision: 0, idempotencyKey: 'mutation-0001' })
    assert.equal(reused.ok, false)
    assert.equal(reused.code, 'idempotency_key_reused')
  }, { now: () => { clockCalls += 1; return new Date('2026-09-07T10:00:00Z') } })
})

test('writes are ordered and state plus idempotency survive a reload', async () => {
  const dates = [new Date('2026-09-07T10:00:00Z'), new Date('2026-09-07T10:01:00Z')]
  await temporaryStore(async ({ filePath, store }) => {
    const firstRequest = { snapshot: snapshot(), expectedRevision: 0, idempotencyKey: 'mutation-0001' }
    const secondRequest = { snapshot: snapshot('Ordered second'), expectedRevision: 1, idempotencyKey: 'mutation-0002' }
    const [first, second] = await Promise.all([store.put(firstRequest), store.put(secondRequest)])
    assert.equal(first.revision, 1)
    assert.equal(second.revision, 2)

    const reloaded = createSnapshotStore({ filePath, now: () => new Date('2026-09-07T11:00:00Z') })
    const current = await reloaded.get()
    assert.equal(current.revision, 2)
    assert.equal(current.snapshot.trips[0].name, 'Ordered second')
    const replay = await reloaded.put(secondRequest)
    assert.equal(replay.ok, true)
    assert.equal(replay.replayed, true)
    assert.equal(replay.revision, 2)
    assert.equal((await reloaded.get()).revision, 2)
  }, { now: () => dates.shift() })
})
