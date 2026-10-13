import type { Trip } from './types'
import { sanitizeTripForSync } from './syncSchema'

/** A portable itinerary for sharing, with payment and personal-record details removed. */
export function itineraryExport(trip: Trip) {
  const clean = sanitizeTripForSync(trip)
  return { schemaVersion: 1, kind: 'boomvoy-trip', exportedAt: new Date().toISOString(), trips: [{ ...clean,
    template: false, share: { visibility: 'private' as const },
    bookings: clean.bookings.map(({ confirmation: _confirmation, cost: _cost, homeAmount: _homeAmount, exchangeRate: _rate, notes: _notes, ...booking }) => booking),
    days: clean.days.map((day) => ({ ...day, notes: '', planA: day.planA.map(publicStop), planB: day.planB.map(publicStop) })),
    budget: [], expenses: [], settlements: [], gifts: [], notes: '', packing: undefined, decisionPreferences: undefined,
    saved: clean.saved.map(({ notes: _notes, priceHistory: _history, votes: _votes, pros: _pros, cons: _cons, ...item }) => ({ ...item, votes: {} })),
  }] }
}
function publicStop({ feeling: _feeling, checkedInAt: _at, socialBuzz: _buzz, cost: _cost, notes: _notes, ...place }: Trip['days'][number]['planA'][number]) { return place }
