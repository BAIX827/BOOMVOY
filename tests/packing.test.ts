import assert from 'node:assert/strict'
import { clothingSeeds, tripDays } from '../src/packing'
import type { DayPlan, Trip, WeatherCondition } from '../src/types'

function tripFixture(conditions: Array<{ tMin: number; tMax: number; condition?: WeatherCondition }>): Trip {
  const days: DayPlan[] = conditions.map((weather, index) => ({
    id: `day-${index}`,
    date: `2026-10-${String(index + 1).padStart(2, '0')}`,
    city: 'Tokyo',
    weather: {
      condition: weather.condition ?? 'sunny',
      tMin: weather.tMin,
      tMax: weather.tMax,
      rainProb: 10,
      summary: '',
    },
    planA: [],
    planB: [],
    activePlan: 'A',
    transportMode: 'public',
  }))

  return {
    id: 'trip',
    name: 'Test trip',
    origin: 'Melbourne',
    destinations: ['Tokyo'],
    startDate: days[0]?.date ?? '2026-10-01',
    endDate: days.at(-1)?.date ?? '2026-10-01',
    travellers: 1,
    members: [],
    budgetPerPerson: 0,
    totalBudget: 0,
    homeCurrency: 'AUD',
    theme: 'cream',
    cover: 'cream',
    transportModes: ['public'],
    days,
    saved: [],
    compares: [],
    bookings: [],
    budget: [],
    expenses: [],
    gifts: [],
    notes: '',
    share: { visibility: 'private' },
    createdAt: '2026-09-07',
  }
}

function quantity(trip: Trip, catalogId: string) {
  return clothingSeeds(trip).find((seed) => seed.catalogId === catalogId)?.qty
}

const shortWarmTrip = tripFixture(Array.from({ length: 3 }, () => ({ tMin: 19, tMax: 27 })))
assert.equal(tripDays(shortWarmTrip), 3)
assert.equal(quantity(shortWarmTrip, 'tees'), 3, 'A three-day trip should never suggest six T-shirts')
assert.equal(quantity(shortWarmTrip, 'pants'), 1)

const mixedTrip = tripFixture([
  { tMin: 20, tMax: 28 },
  { tMin: 10, tMax: 17 },
  { tMin: 15, tMax: 22, condition: 'rain' },
])
assert.equal(quantity(mixedTrip, 'tees'), 2)
assert.equal(quantity(mixedTrip, 'longSleeve'), 2)
assert.equal(quantity(mixedTrip, 'rainJacket'), 1)

const longWarmTrip = tripFixture(Array.from({ length: 12 }, () => ({ tMin: 22, tMax: 30 })))
assert.equal(quantity(longWarmTrip, 'tees'), 7, 'Long trips use a one-week laundry window')
assert.equal(quantity(longWarmTrip, 'underwear'), 8)

console.log('packing tests passed')
