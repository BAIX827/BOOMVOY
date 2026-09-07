import assert from 'node:assert/strict'
import { budgetCategoryActuals, budgetTotals, settle } from '../src/domain'
import { cityForDay, eachDate } from '../src/lib'
import type { Trip } from '../src/types'

function tripFixture(): Trip {
  return {
    id: 'trip',
    name: 'Test trip',
    origin: 'Melbourne',
    destinations: ['Tokyo'],
    startDate: '2026-10-01',
    endDate: '2026-10-02',
    travellers: 2,
    members: [
      { id: 'a', name: 'A', role: 'owner', color: '#000' },
      { id: 'b', name: 'B', role: 'editor', color: '#fff' },
    ],
    budgetPerPerson: 1000,
    totalBudget: 2000,
    homeCurrency: 'AUD',
    theme: 'cream',
    cover: 'cream',
    transportModes: ['public'],
    days: [],
    saved: [],
    compares: [],
    bookings: [
      { id: 'bk1', kind: 'flight', name: 'Flight', status: 'paid', cost: { amount: 500, currency: 'USD' }, exchangeRate: 1.5 },
      { id: 'bk2', kind: 'hotel', name: 'Hotel', status: 'need', cost: { amount: 300, currency: 'AUD' } },
    ],
    budget: [
      { id: 'flight', name: '机票', estimated: 900, booked: 1, paid: 1 },
      { id: 'hotel', name: '住宿', estimated: 500, booked: 1, paid: 1 },
    ],
    expenses: [
      { id: 'ex1', title: 'Flight', amount: 500, currency: 'USD', homeAmount: 750, exchangeRate: 1.5, category: '机票', date: '2026-09-01', paidBy: 'a', split: 'equal', excluded: [], status: 'paid' },
    ],
    gifts: [],
    notes: '',
    share: { visibility: 'private' },
    createdAt: '2026-09-01',
  }
}

assert.deepEqual(eachDate('2026-10-01', '2026-10-03'), ['2026-10-01', '2026-10-02', '2026-10-03'])
assert.deepEqual(eachDate('2026-10-03', '2026-10-01'), [])
assert.deepEqual([0, 1, 2, 3, 4].map((index) => cityForDay(['Tokyo', 'Kyoto'], [2, 3], index)), ['Tokyo', 'Tokyo', 'Kyoto', 'Kyoto', 'Kyoto'])

const trip = tripFixture()
assert.deepEqual(budgetTotals(trip), { estimated: 1400, booked: 750, paid: 750 })
assert.deepEqual(budgetCategoryActuals(trip, '机票'), { booked: 750, paid: 750 })
assert.deepEqual(settle(trip).transfers, [{ from: 'b', to: 'a', amount: 375 }])

trip.expenses = [{ ...trip.expenses[0], split: { a: 200, b: 300 } }]
assert.deepEqual(settle(trip).transfers, [{ from: 'b', to: 'a', amount: 450 }])

console.log('core tests passed')
