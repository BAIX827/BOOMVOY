import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCollaborationStore } from '../server/collaboration-store.mjs'
import { createBoomvoyServer } from '../server/decision-server.mjs'

const trip = {
  id: 'shared', name: 'Tokyo', origin: 'Melbourne', destinations: ['Tokyo'], startDate: '2026-11-20', endDate: '2026-11-20', travellers: 3,
  members: [{ id: 'ari', name: 'Ari', role: 'owner', color: '#123456' }, { id: 'bo', name: 'Bo', role: 'editor', color: '#456789' }, { id: 'cat', name: 'Cat', role: 'viewer', color: '#987654' }], budgetPerPerson: 2000, totalBudget: 6000, homeCurrency: 'AUD', theme: 'cream', cover: 'cream', transportModes: ['public'],
  days: [{ id: 'day', city: 'Tokyo', date: '2026-11-20', planA: [{ id: 'place', name: 'Tower', category: '景点', setting: 'outdoor', photos: ['must-stay-local'] }], planB: [], activePlan: 'A', weather: { condition: 'sunny', tMin: 10, tMax: 20, rainProb: 10, summary: '' }, transportMode: 'public' }],
  saved: [{ id: 'hotel', name: 'Hotel', kind: 'hotel', status: 'comparing', votes: {} }], compares: [], bookings: [], budget: [], expenses: [], gifts: [], notes: '', share: { visibility: 'private' }, createdAt: '2026-10-13',
}
test('Persistent shared rooms enforce member roles, self voting, expiry, revocation and CAS conflicts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'boomvoy-room-')), clock = { time: Date.now() }
  try {
    const store = createCollaborationStore({ directory, now: () => clock.time })
    const owner = await store.create(trip), id = owner.roomId, token = owner.token
    assert.equal(owner.trip.days[0].planA[0].photos, undefined)
    const editor = await store.invite(id, token, 'bo'), viewer = await store.invite(id, token, 'cat')
    await assert.rejects(store.get(id, 'x'.repeat(43)), { status: 401 })
    await assert.rejects(store.invite(id, editor.token, 'cat'), { status: 403 })
    await assert.rejects(store.put(id, viewer.token, { ...owner.trip, name: 'illegal' }, 1), { status: 403 })
    await assert.rejects(store.put(id, editor.token, { ...owner.trip, members: owner.trip.members.map((member) => member.id === 'bo' ? { ...member, role: 'owner' } : member) }, 1), { status: 422 })
    const roles = owner.trip.members.map((member) => member.id === 'cat' ? { ...member, role: 'editor' } : member)
    await assert.rejects(store.put(id, editor.token, { ...owner.trip, members: roles }, 1), { status: 403 })
    const voted = await store.vote(id, viewer.token, 'hotel')
    assert.equal(voted.trip.saved[0].votes.cat, true)
    const conflict = await store.put(id, editor.token, { ...owner.trip, name: 'stale draft' }, 1)
    assert.equal(conflict.conflict, true); assert.equal(conflict.revision, 2)
    const forged = structuredClone(voted.trip); forged.saved[0].votes.ari = true
    await assert.rejects(store.put(id, editor.token, forged, 2), { status: 403 })
    const changed = await store.put(id, editor.token, { ...voted.trip, name: 'Together' }, 2)
    assert.equal(changed.revision, 3)
    assert.equal(changed.changes[0].memberId, 'bo')
    assert.equal((await createCollaborationStore({ directory }).get(id, token)).trip.name, 'Together')
    assert.equal((await readFile(join(directory, `${id}.json`), 'utf8')).includes(token), false, 'Only token hashes reach disk')
    const replacement = await store.invite(id, token, 'bo')
    await assert.rejects(store.get(id, editor.token), { status: 401 })
    assert.equal((await store.get(id, replacement.token)).role, 'editor')
    clock.time += 8 * 86400000
    await assert.rejects(store.get(id, replacement.token), { status: 401 })
  } finally { await rm(directory, { recursive: true, force: true }) }
})
test('Room HTTP API checks creation token, origin, revision, permissions and payload schema', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'boomvoy-room-api-')), creationToken = 'test-only-creation-token-0123456789abcd'
  const server = createBoomvoyServer({ syncToken: creationToken, collaborationDirectory: directory, rateLimit: 200, fetchImpl: async () => { throw new Error('no providers needed') } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api/v1/rooms`
  const request = (path, method, token, body, headers = {}) => fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  try {
    assert.equal((await request('', 'POST', 'incorrect', trip)).status, 401)
    const response = await request('', 'POST', creationToken, trip)
    assert.equal(response.status, 201); const owner = await response.json()
    assert.equal((await request(`/${owner.roomId}`, 'GET', owner.token, undefined, { Origin: 'https://untrusted.example' })).status, 403)
    const invitation = await (await request(`/${owner.roomId}/invites`, 'POST', owner.token, { memberId: 'cat' })).json()
    assert.equal((await request(`/${owner.roomId}`, 'PUT', invitation.token, owner.trip, { 'If-Match': '"r1"' })).status, 403)
    assert.equal((await request(`/${owner.roomId}`, 'PUT', owner.token, owner.trip)).status, 428)
    assert.equal((await request(`/${owner.roomId}`, 'PUT', owner.token, { ...owner.trip, travellers: -2 }, { 'If-Match': '"r1"' })).status, 422)
    assert.equal((await request(`/${owner.roomId}`, 'PUT', owner.token, { ...owner.trip, notes: 'updated' }, { 'If-Match': '"r1"' })).status, 200)
    assert.equal((await request(`/${owner.roomId}`, 'PUT', owner.token, { ...owner.trip, notes: 'stale' }, { 'If-Match': '"r1"' })).status, 409)
    assert.equal((await request(`/${owner.roomId}`, 'GET', owner.token)).headers.get('cache-control')?.includes('no-store'), true)
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }) }
})
