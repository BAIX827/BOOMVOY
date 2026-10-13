import assert from 'node:assert/strict'
import { boomiPlanAction, itineraryRequest, matchBoomi } from '../src/boomiChat'
import { stayCoverage } from '../src/stayCoverage'
import { completeMemberNames } from '../src/travelMembers'
import { weatherAdvice, suggestedSwap } from '../src/domain'
import { weatherCompact, t } from '../src/i18n'
import { useApp } from '../src/store'
import { isSyncSnapshot } from '../src/syncSchema'
import { createSyncSnapshot } from '../src/syncClient'
import { validateSnapshot } from '../server/snapshot-store.mjs'
import type { Trip, DayPlan, WeatherSnap } from '../src/types'

const weather: WeatherSnap = { condition: 'rain', tMin: 8, tMax: 13, rainProb: 82, precipMm: 9, summary: '', source: 'seasonal' }
const trip = { id: 'experience-trip', startDate: '2026-11-11', endDate: '2026-11-18',
  days: Array.from({ length: 8 }, (_, i) => ({ id: `day-${i + 1}`, date: `2026-11-${11 + i}`, city: 'Tokyo' })),
  bookings: [{ id: 'hotel', kind: 'hotel', name: 'One night', status: 'booked', date: '2026-11-11', checkout: '2026-11-12' }],
} as Trip
const request = '帮我安排东京第三天，下午想去浅草寺，预算100澳币'
assert.equal(matchBoomi(request, trip.id)?.sayKey, 'chat.suggest', 'Itinerary intent wins over a budget modifier')
assert.deepEqual(itineraryRequest(request), { text: request, dayNumber: 3, place: '浅草寺', time: '14:00' })
const action = boomiPlanAction(request, trip)!
const params = new URL(action.route!, 'http://localhost').searchParams
assert.equal(params.get('day'), 'day-3')
assert.equal(params.get('request'), request, 'Place, timing and budget survive navigation')
assert.equal(boomiPlanAction('帮我安排第九天', trip)?.sayKey, 'chat.dayMissing')
assert.equal(boomiPlanAction('帮我安排一天')?.route, '/new')
assert.equal(boomiPlanAction('帮我安排下午想去浅草寺', trip, 'day-5')?.route?.includes('day=day-5'), true)
assert.equal(itineraryRequest('Plan my day 3, visit Sensoji, with a budget of AUD100')?.place, 'Sensoji')
assert.equal(boomiPlanAction('预算怎么看', trip), null)

assert.deepEqual(stayCoverage(trip), { total: 7, done: 1, missing: ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'], undated: [] })
const all = { ...trip, bookings: [...trip.bookings, { ...trip.bookings[0], id: 'rest', date: '2026-11-11', checkout: '2026-11-18' }] }
assert.equal(stayCoverage(all).done, 7, 'Overlapping bookings count each night once')
assert.equal(stayCoverage({ ...trip, bookings: [{ ...trip.bookings[0], status: 'cancelled' }] }).done, 0)
assert.deepEqual(stayCoverage({ ...trip, bookings: [{ ...trip.bookings[0], checkout: undefined }] }).undated, ['One night'])
assert.equal(stayCoverage({ ...trip, endDate: trip.startDate }).total, 0)
assert.deepEqual(completeMemberNames([' Ari ', ''], 2, (n) => `Traveller ${n}`), ['Ari', 'Traveller 2'])
const before = useApp.getState().trips
const created = useApp.getState().createTrip({ name: 'Experience test', origin: 'Melbourne', destinations: ['Tokyo'], startDate: '2026-11-11', endDate: '2026-11-18', travellers: 2, members: ['Ari'], budgetPerPerson: 3000, homeCurrency: 'AUD', theme: 'cream', transportModes: ['public'] })
assert.equal(useApp.getState().trips.find((item) => item.id === created)?.members.length, 2, 'Quick creation produces one Split member per traveller')
const generated = useApp.getState().trips.find((item) => item.id === created)!
generated.days[0].weather.rainProbKnown = false
const snapshot = createSyncSnapshot(useApp.getState().profile, [generated])
assert.equal(isSyncSnapshot(snapshot), true)
assert.deepEqual(validateSnapshot(snapshot), snapshot, 'Rain probability availability survives backup')
assert.throws(() => validateSnapshot({ ...snapshot, trips: [{ ...snapshot.trips[0], days: [{ ...snapshot.trips[0].days[0], weather: { ...snapshot.trips[0].days[0].weather, rainProbKnown: 'false' } }] }] }))
useApp.setState({ trips: before })

const translate = (key: string, vars?: Record<string, string | number>) => t('zh', key, vars)
assert.doesNotMatch(weatherCompact(weather, translate), /%/)
assert.match(weatherCompact(weather, translate), /去年同期参考/)
assert.doesNotMatch(weatherCompact({ ...weather, source: 'forecast', rainProbKnown: false }, translate), /%/)
assert.match(weatherCompact({ ...weather, source: 'archive' }, translate), /历史实况/)
assert.equal(weatherCompact({ ...weather, source: 'placeholder' }, translate), '天气待更新')
const day = { weather, activePlan: 'A', planA: [{ id: 'outside', name: 'Park', setting: 'outdoor' }, { id: 'inside', name: 'Museum', setting: 'indoor' }, { id: 'out2', name: 'Walk', setting: 'outdoor' }], planB: [{ id: 'rain', name: 'Museum', setting: 'indoor' }] } as DayPlan
assert.equal(weatherAdvice(day, translate), null, 'Historical reference data cannot trigger forecast warnings')
assert.equal(suggestedSwap(day), null, 'Historical rain values cannot reorder a future trip')
assert.equal(weatherAdvice({ ...day, weather: { ...weather, source: 'forecast' } }, translate)?.suggestSwitch, true)
console.log('Experience regression tests passed')
