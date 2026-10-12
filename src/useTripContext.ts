import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Trip } from './types'
import { resolveTripDay, tripHref } from './journey'

function rememberedDay(tripId?: string) {
  try { return tripId ? localStorage.getItem(`boomvoy-day:${tripId}`) : null } catch { return null }
}

export function useTripContext(trip?: Trip) {
  const [params, setParams] = useSearchParams()
  const day = trip ? resolveTripDay(trip, params.get('day'), rememberedDay(trip.id)) : undefined
  const placeId = params.get('place') || undefined
  useEffect(() => {
    if (!trip || !day) return
    try { localStorage.setItem(`boomvoy-day:${trip.id}`, day.id) } catch { /* URL remains usable if storage is unavailable. */ }
  }, [trip?.id, day?.id])
  function selectDay(dayId: string) {
    const next = new URLSearchParams(params)
    next.set('day', dayId)
    next.delete('place')
    next.delete('view')
    setParams(next, { replace: true })
  }
  function selectPlace(id: string, dayId = day?.id) {
    const next = new URLSearchParams(params)
    if (dayId) next.set('day', dayId)
    next.set('place', id)
    next.delete('view')
    setParams(next, { replace: true, preventScrollReset: true })
  }
  return { day, placeId, selectDay, selectPlace, allDays: params.get('view') === 'all',
    showAllDays: () => { const next = new URLSearchParams(params); next.set('view', 'all'); next.delete('place'); setParams(next, { replace: true }) },
    href: (section = '', selectedDay = day?.id, selectedPlace = selectedDay === day?.id ? placeId : undefined) => tripHref(trip?.id || '', section, selectedDay, selectedPlace),
  }
}
