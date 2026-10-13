import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { validateSnapshot } from './snapshot-store.mjs'

export class CollaborationError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code }
}
const fail = (status, code) => { throw new CollaborationError(status, code) }
const hash = (value) => createHash('sha256').update(value).digest('hex')
const copy = (value) => JSON.parse(JSON.stringify(value))
const validId = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value)
const profile = { name: '', homeCity: '', homeCurrency: 'AUD', themePref: 'auto' }
function cleanTrip(raw) {
  const trip = validateSnapshot({ schemaVersion: 1, profile, trips: [raw] }).trips[0]
  if (!trip || trip.members.filter((member) => member.role === 'owner').length !== 1) fail(422, 'one_owner_required')
  return trip
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function otherVotes(saved, memberId) {
  return Object.fromEntries(saved.map((item) => [item.id, Object.fromEntries(Object.entries(item.votes).filter(([id, value]) => id !== memberId && value).sort())]).filter(([, votes]) => Object.keys(votes).length))
}

/** One process, persistent rooms, per-member expiring bearer grants, serialized CAS writes. */
export function createCollaborationStore({ directory, now = Date.now } = {}) {
  const locks = new Map()
  async function load(id) {
    if (!validId(id)) fail(404, 'room_not_found')
    try {
      const value = JSON.parse(await readFile(join(directory, `${id}.json`), 'utf8'))
      if (value.id !== id || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.grants) || !Array.isArray(value.changes)) fail(503, 'room_unavailable')
      value.trip = cleanTrip(value.trip)
      return value
    } catch (error) {
      if (error.code === 'ENOENT') fail(404, 'room_not_found')
      if (error instanceof CollaborationError) throw error
      fail(503, 'room_unavailable')
    }
  }
  async function save(room) {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const path = join(directory, `${room.id}.json`), temporary = `${path}.${randomUUID()}.tmp`
    let handle
    try {
      handle = await open(temporary, 'wx', 0o600)
      await handle.writeFile(JSON.stringify(room)); await handle.sync(); await handle.close(); handle = undefined
      await rename(temporary, path)
    } finally { await handle?.close(); await unlink(temporary).catch(() => {}) }
  }
  function serialize(id, work) {
    const next = (locks.get(id) || Promise.resolve()).catch(() => {}).then(work)
    locks.set(id, next)
    next.finally(() => { if (locks.get(id) === next) locks.delete(id) }).catch(() => {})
    return next
  }
  function authenticate(room, token) {
    if (typeof token !== 'string' || token.length < 32 || token.length > 512) fail(401, 'access_denied')
    const grant = room.grants.find((entry) => entry.hash === hash(token) && entry.expiresAt > now())
    const member = grant && room.trip.members.find((entry) => entry.id === grant.memberId)
    if (!member) fail(401, 'access_denied')
    return member
  }
  const view = (room, member) => ({ roomId: room.id, trip: copy(room.trip), revision: room.revision, updatedAt: room.updatedAt, memberId: member.id, role: member.role, changes: copy(room.changes) })
  function grant(room, memberId) {
    const token = randomBytes(32).toString('base64url')
    room.grants = room.grants.filter((entry) => entry.memberId !== memberId)
    room.grants.push({ hash: hash(token), memberId, expiresAt: now() + (room.trip.members.find((member) => member.id === memberId)?.role === 'owner' ? 365 : 7) * 86400000 })
    return token
  }
  async function create(raw) {
    const trip = cleanTrip(raw), owner = trip.members.find((entry) => entry.role === 'owner')
    const room = { id: randomUUID(), trip, revision: 1, updatedAt: new Date(now()).toISOString(), changes: [], grants: [] }
    const token = grant(room, owner.id)
    await save(room)
    return { ...view(room, owner), token }
  }
  async function get(id, token) { const room = await load(id); return view(room, authenticate(room, token)) }
  function invite(id, token, memberId) {
    return serialize(id, async () => {
      const room = await load(id), actor = authenticate(room, token)
      if (actor.role !== 'owner') fail(403, 'owner_required')
      if (!room.trip.members.some((entry) => entry.id === memberId) || memberId === actor.id) fail(422, 'invalid_member')
      const nextToken = grant(room, memberId)
      await save(room)
      return { token: nextToken, roomId: id, memberId }
    })
  }
  function put(id, token, raw, expectedRevision) {
    return serialize(id, async () => {
      const room = await load(id), actor = authenticate(room, token)
      if (actor.role === 'viewer') fail(403, 'read_only')
      if (room.revision !== expectedRevision) return { conflict: true, ...view(room, actor) }
      const trip = cleanTrip(raw)
      if (trip.id !== room.trip.id || trip.homeCurrency !== room.trip.homeCurrency || trip.members.find((member) => member.role === 'owner')?.id !== room.trip.members.find((member) => member.role === 'owner')?.id) fail(422, 'invalid_trip_change')
      if (actor.role !== 'owner' && (!equal(trip.members, room.trip.members) || trip.travellers !== room.trip.travellers)) fail(403, 'owner_required')
      if (!equal(otherVotes(trip.saved, actor.id), otherVotes(room.trip.saved.filter((item) => trip.saved.some((entry) => entry.id === item.id)), actor.id))) fail(403, 'own_vote_required')
      const fields = Object.keys(trip).filter((field) => !equal(trip[field], room.trip[field]))
      if (!fields.length) return view(room, actor)
      room.trip = trip; room.revision++; room.updatedAt = new Date(now()).toISOString()
      room.changes = [{ revision: room.revision, at: room.updatedAt, memberId: actor.id, fields }, ...room.changes].slice(0, 30)
      room.grants = room.grants.filter((entry) => trip.members.some((member) => member.id === entry.memberId))
      await save(room)
      return view(room, trip.members.find((entry) => entry.id === actor.id) || actor)
    })
  }
  function vote(id, token, savedId) {
    return serialize(id, async () => {
      const room = await load(id), actor = authenticate(room, token), item = room.trip.saved.find((entry) => entry.id === savedId)
      if (!item) fail(404, 'saved_not_found')
      item.votes[actor.id] = !item.votes[actor.id]
      room.revision++; room.updatedAt = new Date(now()).toISOString()
      room.changes = [{ revision: room.revision, at: room.updatedAt, memberId: actor.id, fields: ['saved'] }, ...room.changes].slice(0, 30)
      await save(room)
      return view(room, actor)
    })
  }
  return { create, get, invite, put, vote }
}
