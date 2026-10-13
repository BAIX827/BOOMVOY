import { useEffect } from 'react'
import { useApp } from './store'
import { useShared, mergeSharedTrip, type SharedRoom } from './collaborationState'
import { readSharedRoom, saveSharedRoom, voteSharedRoom } from './collaborationClient'
import { sanitizeTripForSync } from './syncSchema'
import { restoreLocalPhotos } from './syncClient'
import type { Trip } from './types'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export function applySharedRoom(room: SharedRoom) {
  const state = useApp.getState(), existing = state.trips.find((item) => item.id === room.trip.id)
  const trip = restoreLocalPhotos([room.trip], existing ? [existing] : [])[0]
  useShared.getState().patch(room.trip.id, { ...room, base: room.trip, status: 'synced', remote: undefined })
  useApp.setState({ trips: existing ? state.trips.map((item) => item.id === trip.id ? trip : item) : [trip, ...state.trips] })
}
export function useSharedTrip(trip?: Trip) {
  const binding = useShared((state) => trip ? state.sessions[trip.id] : undefined)
  useEffect(() => {
    if (!trip || !binding) return
    const id = trip.id, token = binding.token, backend = binding.backend, roomId = binding.roomId
    let live = true, busy = false, scheduled: ReturnType<typeof setTimeout> | undefined
    const current = () => { const session = useShared.getState().sessions[id]; return live && session?.token === token ? session : undefined }
    async function accept(room: SharedRoom, captured: Trip) {
      const local = useApp.getState().trips.find((entry) => entry.id === id)
      if (!current() || !local) return
      // Keystrokes entered while the request was running remain a pending local draft.
      const latest = sanitizeTripForSync(local)
      if (!same(latest, captured)) {
        const merged = mergeSharedTrip(captured, latest, room.trip)
        useShared.getState().patch(id, { ...room, base: room.trip, status: merged.conflicts.length ? 'conflict' : 'synced', remote: merged.conflicts.length ? room : undefined })
        if (!merged.conflicts.length) useApp.setState({ trips: useApp.getState().trips.map((entry) => entry.id === id ? restoreLocalPhotos([merged.trip], [local])[0] : entry) })
      } else applySharedRoom(room)
    }
    async function sync() {
      const session = current(), original = useApp.getState().trips.find((entry) => entry.id === id)
      if (!session || !original || busy || session.status === 'conflict') return
      busy = true
      const captured = sanitizeTripForSync(original)
      try {
        let remote = await readSharedRoom(backend, roomId, token)
        if (!current()) return
        if (same(captured, session.base)) { if (remote.revision !== session.revision || remote.role !== session.role) await accept(remote, captured); else if (session.status !== 'synced') useShared.getState().patch(id, { status: 'synced' }); return }
        for (let attempt = 0; attempt < 3; attempt++) {
          const merged = mergeSharedTrip(session.base, captured, remote.trip)
          if (merged.conflicts.length || remote.role === 'viewer') { useShared.getState().patch(id, { role: remote.role, status: 'conflict', remote }); return }
          useShared.getState().patch(id, { status: 'saving' })
          const result = await saveSharedRoom(backend, roomId, token, merged.trip, remote.revision)
          if (!current()) return
          if (!result.conflict) { await accept(result.room, captured); return }
          remote = result.room
        }
        useShared.getState().patch(id, { status: 'offline' })
      } catch { if (current()) useShared.getState().patch(id, { status: 'offline' }) }
      finally { busy = false; const session = current(), latest = useApp.getState().trips.find((entry) => entry.id === id); if (session && latest && session.status === 'synced' && !same(sanitizeTripForSync(latest), session.base)) scheduled = setTimeout(() => void sync(), 1000) }
    }
    const vote = async (savedId: string) => {
      const session = current(), local = useApp.getState().trips.find((entry) => entry.id === id)
      if (!session || !local || busy || session.status === 'conflict') return
      if (!same(sanitizeTripForSync(local), session.base)) { await sync(); const refreshed = current(), latest = useApp.getState().trips.find((entry) => entry.id === id); if (!refreshed || !latest || refreshed.status !== 'synced' || !same(sanitizeTripForSync(latest), refreshed.base)) return }
      busy = true
      try { await accept(await voteSharedRoom(backend, roomId, token, savedId), sanitizeTripForSync(local)) }
      catch { if (current()) useShared.getState().patch(id, { status: 'offline' }) }
      finally { busy = false }
    }
    useShared.getState().patch(id, { vote: (savedId) => void vote(savedId) })
    const unsubscribe = useApp.subscribe((state) => { const local = state.trips.find((entry) => entry.id === id), session = current(); if (local && session && session.status !== 'conflict' && !same(sanitizeTripForSync(local), session.base)) { useShared.getState().patch(id, { status: 'saving' }); clearTimeout(scheduled); scheduled = setTimeout(() => void sync(), 1000) } })
    const interval = setInterval(() => void sync(), 10000)
    const retry = () => void sync()
    window.addEventListener('boomvoy-sync', retry)
    void sync()
    return () => { live = false; clearTimeout(scheduled); clearInterval(interval); unsubscribe(); window.removeEventListener('boomvoy-sync', retry) }
  }, [trip?.id, binding?.roomId, binding?.token, binding?.backend])
  return binding
}
