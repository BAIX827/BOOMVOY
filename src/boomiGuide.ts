import type { TFn } from './i18n'
import type { Trip } from './types'

export type GuideStep = { title: string; say: string; route: string; selector?: string }

export function guideTripId(trips: Pick<Trip, 'id' | 'template'>[], pathname: string): string | undefined {
  const current = pathname.match(/^\/trip\/([^/]+)(?:\/|$)/)?.[1]
  return trips.find((trip) => trip.id === current && !trip.template)?.id || trips.find((trip) => !trip.template)?.id
}

export function guideSteps(t: TFn, tripId?: string): GuideStep[] {
  const step = (key: string, route: string, selector?: string): GuideStep => ({
    title: t(`guide.${key}t`), say: t(`guide.${key}s`), route, selector,
  })
  if (!tripId) return [
    step('emptyStart', '/', '[data-guide="my-trips"]'),
    step('step3', '/new', '[data-guide="create-form"]'),
    step('step4', '/explore', '[data-guide="template-list"]'),
    step('step10', '/new'),
  ]
  const trip = `/trip/${tripId}`
  return [
    step('step5', trip, '[data-guide="trip-nav"]'),
    step('step6', `${trip}/plan`, '[data-guide="day-suggest"]'),
    step('step8', `${trip}/map`, '[data-guide="nav-map"]'),
    step('stepPack', `${trip}/pack`, '[data-guide="pack-list"]'),
    step('step9', `${trip}/bookings`, '[data-guide="booking-links"]'),
    step('step10', trip),
  ]
}

export function guideChips(pathname: string): string[] {
  if (pathname === '/') return ['create', 'sample', 'theme']
  if (pathname === '/new') return ['create', 'theme']
  if (pathname === '/explore') return ['sample', 'create']
  if (pathname === '/profile') return ['theme', 'create']
  if (pathname.endsWith('/plan')) return ['suggest', 'checkin', 'weather']
  if (pathname.endsWith('/pack')) return ['packing', 'weather']
  if (pathname.endsWith('/map')) return ['map', 'suggest']
  if (pathname.endsWith('/weather')) return ['weather', 'packing']
  if (pathname.endsWith('/bookings')) return ['booking', 'budget']
  if (pathname.endsWith('/saved') || pathname.endsWith('/compare')) return ['saved', 'compare', 'booking']
  if (pathname.endsWith('/budget') || pathname.endsWith('/expenses')) return ['budget', 'booking']
  if (pathname.endsWith('/notes')) return ['theme', 'saved']
  return ['suggest', 'checkin', 'map']
}
