import assert from 'node:assert/strict'
import { hasTravelRecord, planFingerprint, prepareRecommendation } from '../src/recommendationApplication'
import type { DayPlan, PlaceStop, PlanVariant, Trip } from '../src/types'

function stop(name: string, patch: Partial<PlaceStop> = {}): PlaceStop {
  return { id: `id-${name}`, name, category: '景点', setting: 'indoor', time: '09:00', durationMin: 60, ...patch }
}

const original = [stop('浅草寺', { notes: 'Meet at the gate', cost: { amount: 1200, currency: 'JPY', status: 'paid' } })]
const originalSnapshot = structuredClone(original)
const incoming = [stop('Senso-ji Temple', { notes: 'Suggested note', time: '11:00' }), stop('Ueno Park'), stop('上野公园')]
const incomingSnapshot = structuredClone(incoming)
const appended = prepareRecommendation(original, incoming, 'append')
assert.equal(appended.length, 2, 'append deduplicates existing bilingual aliases and repeated incoming places')
assert.deepEqual(appended[0], original[0], 'append preserves the existing stop exactly')
assert.notEqual(appended[1].id, incoming[1].id, 'new stops receive fresh IDs')
assert.deepEqual(original, originalSnapshot, 'preparation leaves the source plan unchanged')
assert.deepEqual(incoming, incomingSnapshot, 'preparation leaves the preview unchanged')

const connectionPlan = [
  stop('Earlier stop', { transportToNext: 'taxi' }),
  stop('Last stop', { transportToNext: 'public', booked: true, checkedIn: true, checkedInAt: '2026-10-01T09:00:00.000Z', photos: ['photo'], feeling: 'Great visit', notes: 'Keep my note', cost: { amount: 50, currency: 'AUD', status: 'paid' } }),
]
const connectionBefore = structuredClone(connectionPlan)
const connected = prepareRecommendation(connectionPlan, [stop('Last stop', { transportToNext: 'taxi' }), stop('New stop', { transportToNext: 'walking' })], 'append')
assert.equal(connected[1].transportToNext, 'walking', 'the connection uses the first genuinely new stop after deduplication')
assert.deepEqual(connected[0], connectionBefore[0], 'earlier existing stops retain their transport')
assert.deepEqual(connected[1], { ...connectionBefore[1], transportToNext: 'walking' }, 'changing the connection preserves every other field')
assert.deepEqual(connectionPlan, connectionBefore, 'changing the connection does not mutate the undo source')
assert.notEqual(connected[1], connectionPlan[1], 'the changed connection is a fresh object')
assert.deepEqual(
  prepareRecommendation(connectionPlan, [stop('New stop')], 'append').slice(0, 2),
  connectionBefore,
  'an unspecified new transport retains the previous connection transport',
)
assert.deepEqual(
  prepareRecommendation(connectionPlan, [stop('Last stop', { transportToNext: 'walking' })], 'append'),
  connectionBefore,
  'an all-duplicate recommendation cannot change the connection transport',
)
assert.deepEqual(prepareRecommendation(connectionPlan, [], 'append'), connectionBefore, 'an empty recommendation leaves the connection unchanged')
assert.equal(prepareRecommendation([], [stop('First stop', { transportToNext: 'cycling' })], 'append')[0].transportToNext, 'cycling', 'an empty plan has no prior connection to patch')

const replacement = prepareRecommendation(original, incoming, 'replace')
assert.equal(replacement.length, 2)
assert.equal(replacement[0].id, original[0].id, 'replacement retains the ID of a matched place')
assert.equal(replacement[0].time, '11:00', 'replacement applies the preview schedule')
assert.equal(replacement[0].notes, 'Meet at the gate', 'replacement preserves user notes')
assert.deepEqual(replacement[0].cost, original[0].cost, 'replacement preserves recorded costs')
assert.equal(new Set(replacement.map((place) => place.id)).size, replacement.length)

const protectedRecords: Partial<PlaceStop>[] = [
  { booked: true },
  { checkedIn: true },
  { checkedInAt: '2026-10-01T09:00:00.000Z' },
  { photos: ['data:image/jpeg;base64,test'] },
  { feeling: 'Loved the gardens' },
]
for (const record of protectedRecords) {
  assert.equal(hasTravelRecord([stop('Museum', record)]), true, `protects ${Object.keys(record)[0]}`)
}
assert.equal(hasTravelRecord([]), false)
assert.equal(hasTravelRecord([stop('Museum', { booked: false, checkedIn: false, photos: [], feeling: '' })]), false)

assert.equal(planFingerprint(original), planFingerprint(structuredClone(original)), 'equal snapshots have equal revisions')
assert.notEqual(planFingerprint(original), planFingerprint([stop('浅草寺', { notes: 'Edited' })]), 'edits invalidate the revision')
assert.notEqual(planFingerprint(replacement), planFingerprint([...replacement].reverse()), 'reordering invalidates the revision')
assert.notEqual(planFingerprint(original), planFingerprint([stop('浅草寺', { photos: ['new-photo'] })]), 'photo changes invalidate the revision')

// Install storage before store initialization so persist never touches real browser data.
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const values = new Map<string, string>()
const memoryStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size },
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage })

try {
  const { useApp } = await import('../src/store')
  const initialState = useApp.getState()

  function dayFixture(id: string, patch: Partial<DayPlan> = {}): DayPlan {
    return {
      id, date: '2026-10-01', city: 'Tokyo', transportMode: 'public', activePlan: 'A',
      weather: { condition: 'sunny', tMin: 16, tMax: 24, rainProb: 10, summary: '' },
      planA: [stop('Existing')], planB: [stop('Rain museum')], ...patch,
    }
  }

  function resetPlan(planA: PlaceStop[] = [stop('Existing')]) {
    const base = initialState.trips[0]
    const trip: Trip = { ...base, id: 'recommendation-trip', days: [dayFixture('day-1', { planA }), dayFixture('day-2')] }
    const otherTrip: Trip = { ...base, id: 'other-trip', days: [dayFixture('other-day')] }
    useApp.setState({ trips: [trip, otherTrip] })
  }

  function currentDay() {
    return useApp.getState().trips.find((trip) => trip.id === 'recommendation-trip')!.days[0]
  }

  function currentPlan(plan: PlanVariant = 'A') {
    return currentDay()[plan === 'A' ? 'planA' : 'planB']
  }

  try {
    resetPlan([stop('Existing', { transportToNext: 'public' })])
    const before = structuredClone(useApp.getState().trips)
    const expected = planFingerprint(currentPlan())
    let updates = 0
    const observedLengths: number[] = []
    const observedConnections: (PlaceStop['transportToNext'])[] = []
    const unsubscribe = useApp.subscribe(() => { updates += 1; observedLengths.push(currentPlan().length); observedConnections.push(currentPlan()[0].transportToNext) })
    const applied = useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'append', [stop('Museum', { transportToNext: 'walking' }), stop('Park', { transportToNext: 'cycling' })], expected)
    assert.equal(applied.ok, true)
    assert.equal(updates, 1, 'a recommendation commits all stops in one store update')
    assert.deepEqual(observedLengths, [3], 'subscribers cannot observe a partially added recommendation')
    assert.deepEqual(observedConnections, ['walking'], 'the connection transport and new stops commit atomically')
    assert.deepEqual(before[0].days[0].planA, [stop('Existing', { transportToNext: 'public' })], 'the original connection snapshot remains unchanged')
    assert.deepEqual(currentPlan('B'), before[0].days[0].planB, 'applying A leaves B unchanged')
    assert.deepEqual(useApp.getState().trips[0].days[1], before[0].days[1], 'applying one day leaves other days unchanged')
    assert.deepEqual(useApp.getState().trips[1], before[1], 'applying one trip leaves other trips unchanged')
    assert.deepEqual(
      useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'append', [stop('Museum'), stop('Park')], expected),
      { ok: false, reason: 'changed' },
      'a repeated click carrying the old revision is rejected',
    )
    assert.equal(updates, 1, 'a rejected stale application causes no store update')
    assert.deepEqual(
      useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'append', [stop('Museum')], planFingerprint(currentPlan())),
      { ok: false, reason: 'empty' },
      'reapplying an existing place with a fresh revision still cannot create duplicates',
    )
    assert.equal(updates, 1)
    unsubscribe()

    assert(applied.ok)
    assert.deepEqual(applied.undo.before, before[0].days[0].planA, 'undo captures the old connection transport')
    assert.equal(applied.undo.after, planFingerprint(currentPlan()), 'the CAS revision includes the new connection transport')
    assert.equal(useApp.getState().undoRecommendation('recommendation-trip', 'day-1', 'A', applied.undo), true)
    assert.deepEqual(currentPlan(), before[0].days[0].planA, 'undo restores the exact prior plan and IDs')
    assert.equal(currentPlan()[0].transportToNext, 'public', 'undo restores the previous connection transport')
    assert.equal(useApp.getState().undoRecommendation('recommendation-trip', 'day-1', 'A', applied.undo), false, 'undo can only apply once')

    resetPlan()
    const aRevision = planFingerprint(currentPlan())
    const bRevision = planFingerprint(currentPlan('B'))
    useApp.getState().setActivePlan('recommendation-trip', 'day-1', 'B')
    assert.deepEqual(
      useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'append', [stop('Old A recommendation')], aRevision),
      { ok: false, reason: 'changed' },
      'switching to B invalidates application targeting A',
    )
    const bApplied = useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'B', 'append', [stop('Existing')], bRevision)
    assert.equal(bApplied.ok, true, 'B may share an A place because the plans are alternatives')
    assert.equal(planFingerprint(currentPlan()), aRevision, 'applying to B leaves A unchanged')

    for (const record of protectedRecords) {
      const recorded = stop('Museum', record)
      resetPlan([recorded])
      const revision = planFingerprint(currentPlan())
      assert.deepEqual(
        useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'replace', [stop('Other museum')], revision),
        { ok: false, reason: 'protected' },
        `replacement cannot remove ${Object.keys(record)[0]}`,
      )
      assert.deepEqual(currentPlan(), [recorded], 'protected replacement leaves the plan unchanged')
      assert.equal(useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'append', [stop('Park')], revision).ok, true)
      assert.deepEqual(currentPlan()[0], recorded, 'append retains all recorded travel data')
    }

    resetPlan(structuredClone(original))
    const replaced = useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'replace', incoming, planFingerprint(currentPlan()))
    assert(replaced.ok)
    assert.equal(replaced.count, 2)
    assert.equal(currentPlan()[0].id, original[0].id)
    assert.equal(currentPlan()[0].notes, original[0].notes)
    assert.deepEqual(currentPlan()[0].cost, original[0].cost)
    useApp.getState().updatePlace('recommendation-trip', 'day-1', 'A', currentPlan()[0].id, { notes: 'New edit after applying' })
    const edited = structuredClone(currentPlan())
    assert.equal(useApp.getState().undoRecommendation('recommendation-trip', 'day-1', 'A', replaced.undo), false, 'undo uses compare-and-swap and rejects subsequent edits')
    assert.deepEqual(currentPlan(), edited, 'rejected undo preserves subsequent edits')

    resetPlan()
    const undoAcrossVariants = useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'append', [stop('Museum')], planFingerprint(currentPlan()))
    assert(undoAcrossVariants.ok)
    useApp.getState().setActivePlan('recommendation-trip', 'day-1', 'B')
    assert.equal(useApp.getState().undoRecommendation('recommendation-trip', 'day-1', 'A', undoAcrossVariants.undo), false, 'undo cannot act on an inactive variant')
    useApp.getState().updatePlace('recommendation-trip', 'day-1', 'B', currentPlan('B')[0].id, { notes: 'Keep this B edit' })
    useApp.getState().setActivePlan('recommendation-trip', 'day-1', 'A')
    assert.equal(useApp.getState().undoRecommendation('recommendation-trip', 'day-1', 'A', undoAcrossVariants.undo), true, 'unrelated B edits do not prevent undoing unchanged A')
    assert.equal(currentPlan('B')[0].notes, 'Keep this B edit', 'undo in A preserves B edits')

    assert.deepEqual(useApp.getState().applyRecommendation('missing-trip', 'day-1', 'A', 'append', [stop('Museum')], '[]'), { ok: false, reason: 'changed' })
    assert.deepEqual(useApp.getState().applyRecommendation('recommendation-trip', 'missing-day', 'A', 'append', [stop('Museum')], '[]'), { ok: false, reason: 'changed' })
    assert.deepEqual(useApp.getState().applyRecommendation('recommendation-trip', 'day-1', 'A', 'replace', [], planFingerprint(currentPlan())), { ok: false, reason: 'empty' })
  } finally {
    useApp.setState(initialState, true)
  }
} finally {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}

console.log('recommendation application tests passed')
