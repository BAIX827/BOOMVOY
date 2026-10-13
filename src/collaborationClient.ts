import { backendEndpoint, normalizeBackendUrl } from './llm'
import { isSyncSnapshot, sanitizeTripForSync } from './syncSchema'
import type { SharedRoom } from './collaborationState'
import type { Trip } from './types'

export function accessCode(roomId: string, token: string) { return `BV1:${roomId}:${token}` }
export function parseAccessCode(value: string) {
  const match = /^BV1:([a-f0-9-]{36}):([A-Za-z0-9_-]{32,512})$/.exec(value.trim())
  if (!match) throw new Error('invalid access code')
  return { roomId: match[1], token: match[2] }
}
function roomResponse(value: unknown): SharedRoom {
  const data = value as SharedRoom
  if (!data || typeof data.roomId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.roomId) || !Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.updatedAt !== 'string' || !data.trip?.members.some((member) => member.id === data.memberId && member.role === data.role)
    || !Array.isArray(data.changes) || data.changes.length > 30 || data.changes.some((change) => !Number.isSafeInteger(change.revision) || typeof change.at !== 'string' || typeof change.memberId !== 'string' || !Array.isArray(change.fields) || change.fields.some((field) => typeof field !== 'string'))
    || !isSyncSnapshot({ schemaVersion: 1, profile: { name: '', homeCity: '', homeCurrency: 'AUD', themePref: 'auto' }, trips: [data.trip] })) throw new Error('invalid room response')
  return { roomId: data.roomId, revision: data.revision, updatedAt: data.updatedAt, memberId: data.memberId, role: data.role, trip: data.trip, changes: data.changes }
}
async function request(backend: string, path: string, token: string, method = 'GET', body?: unknown, revision?: number) {
  if (!normalizeBackendUrl(backend) || !token || token.length > 512 || /\s/.test(token)) throw new Error('invalid connection')
  const response = await fetch(backendEndpoint(backend, '/v1/rooms' + path), { method, cache: 'no-store', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(revision === undefined ? {} : { 'If-Match': `"r${revision}"` }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  if (!response.headers.get('content-type')?.includes('application/json') || !response.ok && response.status !== 409) throw new Error(`collaboration ${response.status}`)
  return { value: await response.json(), conflict: response.status === 409 }
}
export async function createSharedRoom(backend: string, token: string, trip: Trip) {
  const { value } = await request(backend, '', token, 'POST', sanitizeTripForSync(trip))
  const room = roomResponse(value)
  if (typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{32,512}$/.test(value.token)) throw new Error('invalid token')
  return { room, token: value.token as string }
}
export async function readSharedRoom(backend: string, roomId: string, token: string) { return roomResponse((await request(backend, `/${roomId}`, token)).value) }
export async function saveSharedRoom(backend: string, roomId: string, token: string, trip: Trip, revision: number) { const result = await request(backend, `/${roomId}`, token, 'PUT', sanitizeTripForSync(trip), revision); return { room: roomResponse(result.value), conflict: result.conflict } }
export async function inviteSharedMember(backend: string, roomId: string, token: string, memberId: string) {
  const { value } = await request(backend, `/${roomId}/invites`, token, 'POST', { memberId })
  if (value.roomId !== roomId || value.memberId !== memberId || typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{32,512}$/.test(value.token)) throw new Error('invalid invitation')
  return accessCode(roomId, value.token)
}
export async function voteSharedRoom(backend: string, roomId: string, token: string, savedId: string) { return roomResponse((await request(backend, `/${roomId}/votes`, token, 'POST', { savedId })).value) }
