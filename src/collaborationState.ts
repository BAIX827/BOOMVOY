import { create } from 'zustand'
import type { Role, Trip } from './types'
export type SharedRoom = { roomId: string; trip: Trip; revision: number; updatedAt: string; memberId: string; role: Role; changes: { revision: number; at: string; memberId: string; fields: string[] }[] }
export type SharedSession = SharedRoom & { token: string; backend: string; base: Trip; status: 'synced' | 'saving' | 'offline' | 'conflict'; remote?: SharedRoom; vote?: (savedId: string) => void }
export const useShared = create<{ sessions: Record<string, SharedSession>; put: (id: string, session: SharedSession) => void; patch: (id: string, patch: Partial<SharedSession>) => void; disconnect: (id: string) => void }>((set) => ({
  sessions: {}, put: (id, session) => set((state) => ({ sessions: { ...state.sessions, [id]: session } })),
  patch: (id, patch) => set((state) => state.sessions[id] ? { sessions: { ...state.sessions, [id]: { ...state.sessions[id], ...patch } } } : state),
  disconnect: (id) => set((state) => ({ sessions: Object.fromEntries(Object.entries(state.sessions).filter(([key]) => key !== id)) })),
}))
export const canEditTrip = (id: string) => useShared.getState().sessions[id]?.role !== 'viewer'

/** Merge independent edits by entity ID. Conflicting field edits require a user decision. */
export function mergeSharedTrip(base: Trip, local: Trip, remote: Trip): { trip: Trip; conflicts: string[] } {
  const conflicts: string[] = [], same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  function merge(a: unknown, b: unknown, c: unknown, path: string): unknown {
    if (path === 'trip.weatherUpdatedAt') return [b, c].filter((value): value is string => typeof value === 'string').sort().at(-1)
    if (same(b, c)) return b
    if (same(a, b)) return c
    if (same(a, c)) return b
    if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c) && [...a, ...b, ...c].every((item) => object(item) && typeof item.id === 'string')) {
      const index = (xs: Record<string, unknown>[]) => new Map(xs.map((item) => [item.id as string, item]))
      const aa = index(a), bb = index(b), cc = index(c)
      const common = a.map((item) => item.id).filter((id) => bb.has(id) && cc.has(id))
      const orderB = b.map((item) => item.id).filter((id) => common.includes(id)), orderC = c.map((item) => item.id).filter((id) => common.includes(id))
      const changedB = !same(common, orderB), changedC = !same(common, orderC)
      if (changedB && changedC && !same(orderB, orderC)) conflicts.push(path + '.order')
      const source = changedC && !changedB ? c : b
      const ids = [...new Set([...source.map((item) => item.id), ...b.map((item) => item.id), ...c.map((item) => item.id)])]
      return ids.map((id) => merge(aa.get(id), bb.get(id), cc.get(id), `${path}.${id}`)).filter((item) => item !== undefined)
    }
    if (object(a) && object(b) && object(c)) {
      return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(c)])].filter((key) => !['__proto__', 'constructor', 'prototype'].includes(key)).map((key) => [key, merge(a[key], b[key], c[key], `${path}.${key}`)]))
    }
    conflicts.push(path); return b
  }
  return { trip: merge(base, local, remote, 'trip') as Trip, conflicts }
}
