import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Booking,
  DayPlan,
  Expense,
  GiftItem,
  PlaceStop,
  PlanVariant,
  Profile,
  SavedItem,
  ThemeId,
  TransportMode,
  Trip,
  WeatherSnap,
} from './types'
import { baliTrip, emptyBudget, japanTrip, oceanRoadTrip } from './data'
import { emptyPacking } from './packing'
import { copyJSON, eachDate, uid } from './lib'

interface AppState {
  profile: Profile
  trips: Trip[]
  setProfile: (p: Partial<Profile>) => void
  createTrip: (draft: {
    name: string
    origin: string
    destinations: string[]
    startDate: string
    endDate: string
    travellers: number
    members: string[]
    budgetPerPerson: number
    homeCurrency: string
    theme: ThemeId
    transportModes: TransportMode[]
  }) => string
  updateTrip: (id: string, patch: Partial<Trip>) => void
  deleteTrip: (id: string) => void
  cloneTrip: (id: string, asMine?: boolean) => string
  cloneDay: (tripId: string, dayId: string, targetTripId: string) => void
  addDayPlace: (tripId: string, dayId: string, plan: PlanVariant, place: Omit<PlaceStop, 'id'>) => void
  updatePlace: (tripId: string, dayId: string, plan: PlanVariant, placeId: string, patch: Partial<PlaceStop>) => void
  removePlace: (tripId: string, dayId: string, plan: PlanVariant, placeId: string) => void
  reorderPlaces: (tripId: string, dayId: string, plan: PlanVariant, ids: string[]) => void
  setActivePlan: (tripId: string, dayId: string, plan: PlanVariant) => void
  replacePlaces: (tripId: string, dayId: string, plan: PlanVariant, places: PlaceStop[]) => void
  addSaved: (tripId: string, item: Omit<SavedItem, 'id' | 'votes'>) => void
  updateSaved: (tripId: string, itemId: string, patch: Partial<SavedItem>) => void
  removeSaved: (tripId: string, itemId: string) => void
  toggleVote: (tripId: string, itemId: string, memberId: string) => void
  addBooking: (tripId: string, item: Omit<Booking, 'id'>) => void
  updateBooking: (tripId: string, id: string, patch: Partial<Booking>) => void
  addExpense: (tripId: string, item: Omit<Expense, 'id'>) => void
  removeExpense: (tripId: string, id: string) => void
  addGift: (tripId: string, item: Omit<GiftItem, 'id'>) => void
  updateGift: (tripId: string, id: string, patch: Partial<GiftItem>) => void
  patchDaysWeather: (tripId: string, byKey: Record<string, WeatherSnap>, fetchedAt: string) => void
  resetDemo: () => void
}

function seed(): Trip[] {
  return [japanTrip(), oceanRoadTrip(), baliTrip()]
}

function patchTrip(trips: Trip[], id: string, fn: (t: Trip) => Trip): Trip[] {
  return trips.map((t) => (t.id === id ? fn(t) : t))
}

function patchDay(trip: Trip, dayId: string, fn: (d: DayPlan) => DayPlan): Trip {
  return { ...trip, days: trip.days.map((d) => (d.id === dayId ? fn(d) : d)) }
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      profile: {
        name: 'Ari',
        homeCity: 'Melbourne',
        homeCurrency: 'AUD',
        themePref: 'auto',
        locale: 'zh',
      },
      trips: seed(),
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),
      createTrip: (draft) => {
        const id = uid()
        const members = draft.members.filter(Boolean).map((name, i) => ({
          id: i === 0 ? 'me' : uid(),
          name,
          role: i === 0 ? ('owner' as const) : ('editor' as const),
          color: ['#D989A0', '#3E8EBE', '#6B8F71', '#E8C36A'][i % 4],
        }))
        const dest0 = draft.destinations[0] || draft.origin
        const days: DayPlan[] = eachDate(draft.startDate, draft.endDate).map((date) => ({
          id: uid(),
          date,
          city: dest0,
          stay: '',
          transportMode: draft.transportModes[0] || 'mixed',
          weather: {
            condition: 'sunny',
            tMin: 16,
            tMax: 24,
            rainProb: 20,
            summary: '',
            source: 'placeholder',
          },
          planA: [],
          planB: [],
          activePlan: 'A',
        }))
        const trip: Trip = {
          id,
          name: draft.name,
          origin: draft.origin,
          destinations: draft.destinations,
          startDate: draft.startDate,
          endDate: draft.endDate,
          travellers: draft.travellers,
          members: members.length ? members : [{ id: 'me', name: 'Me', role: 'owner', color: '#D989A0' }],
          budgetPerPerson: draft.budgetPerPerson,
          totalBudget: draft.budgetPerPerson * draft.travellers,
          homeCurrency: draft.homeCurrency,
          theme: draft.theme,
          cover: draft.theme,
          transportModes: draft.transportModes,
          days,
          saved: [],
          compares: [],
          bookings: [],
          budget: emptyBudget(draft.budgetPerPerson * draft.travellers),
          expenses: [],
          gifts: [],
          packing: emptyPacking({ days } as Trip),
          notes: '',
          share: { visibility: 'private' },
          createdAt: new Date().toISOString().slice(0, 10),
        }
        set({ trips: [trip, ...get().trips] })
        return id
      },
      updateTrip: (id, patch) => set({ trips: patchTrip(get().trips, id, (t) => ({ ...t, ...patch })) }),
      deleteTrip: (id) => set({ trips: get().trips.filter((t) => t.id !== id) }),
      cloneTrip: (id, asMine = true) => {
        const src = get().trips.find((t) => t.id === id)
        if (!src) return id
        const copy = copyJSON(src)
        copy.id = uid()
        copy.template = false
        copy.share = { visibility: 'private' }
        copy.createdAt = new Date().toISOString().slice(0, 10)
        if (asMine) copy.name = copy.name.replace(/（模板）$/, '') + ' 副本'
        const remap = (p: PlaceStop) => ({ ...p, id: uid() })
        copy.days = copy.days.map((d) => ({
          ...d,
          id: uid(),
          planA: d.planA.map(remap),
          planB: d.planB.map(remap),
        }))
        if (copy.packing) {
          copy.packing = {
            ...copy.packing,
            items: copy.packing.items.map((it) => ({ ...it, id: uid() })),
          }
        }
        set({ trips: [copy, ...get().trips] })
        return copy.id
      },
      cloneDay: (tripId, dayId, targetTripId) => {
        const src = get().trips.find((t) => t.id === tripId)?.days.find((d) => d.id === dayId)
        if (!src) return
        const cloned: DayPlan = {
          ...copyJSON(src),
          id: uid(),
          planA: src.planA.map((p) => ({ ...p, id: uid() })),
          planB: src.planB.map((p) => ({ ...p, id: uid() })),
        }
        set({
          trips: patchTrip(get().trips, targetTripId, (t) => ({ ...t, days: [...t.days, cloned] })),
        })
      },
      addDayPlace: (tripId, dayId, plan, place) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) =>
            patchDay(t, dayId, (d) => {
              const key = plan === 'A' ? 'planA' : 'planB'
              return { ...d, [key]: [...d[key], { ...place, id: uid() }] }
            }),
          ),
        }),
      updatePlace: (tripId, dayId, plan, placeId, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) =>
            patchDay(t, dayId, (d) => {
              const key = plan === 'A' ? 'planA' : 'planB'
              return { ...d, [key]: d[key].map((p) => (p.id === placeId ? { ...p, ...patch } : p)) }
            }),
          ),
        }),
      removePlace: (tripId, dayId, plan, placeId) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) =>
            patchDay(t, dayId, (d) => {
              const key = plan === 'A' ? 'planA' : 'planB'
              return { ...d, [key]: d[key].filter((p) => p.id !== placeId) }
            }),
          ),
        }),
      reorderPlaces: (tripId, dayId, plan, ids) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) =>
            patchDay(t, dayId, (d) => {
              const key = plan === 'A' ? 'planA' : 'planB'
              const map = new Map(d[key].map((p) => [p.id, p]))
              return { ...d, [key]: ids.map((id) => map.get(id)!).filter(Boolean) }
            }),
          ),
        }),
      setActivePlan: (tripId, dayId, plan) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => patchDay(t, dayId, (d) => ({ ...d, activePlan: plan }))),
        }),
      replacePlaces: (tripId, dayId, plan, places) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) =>
            patchDay(t, dayId, (d) => ({ ...d, [plan === 'A' ? 'planA' : 'planB']: places })),
          ),
        }),
      addSaved: (tripId, item) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            saved: [...t.saved, { ...item, id: uid(), votes: {} }],
          })),
        }),
      updateSaved: (tripId, itemId, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            saved: t.saved.map((s) => (s.id === itemId ? { ...s, ...patch } : s)),
          })),
        }),
      removeSaved: (tripId, itemId) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            saved: t.saved.filter((s) => s.id !== itemId),
          })),
        }),
      toggleVote: (tripId, itemId, memberId) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            saved: t.saved.map((s) => {
              if (s.id !== itemId) return s
              const next = { ...s.votes }
              next[memberId] = !next[memberId]
              return { ...s, votes: next }
            }),
          })),
        }),
      addBooking: (tripId, item) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            bookings: [...t.bookings, { ...item, id: uid() }],
          })),
        }),
      updateBooking: (tripId, id, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            bookings: t.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
          })),
        }),
      addExpense: (tripId, item) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            expenses: [...t.expenses, { ...item, id: uid() }],
          })),
        }),
      removeExpense: (tripId, id) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            expenses: t.expenses.filter((e) => e.id !== id),
          })),
        }),
      addGift: (tripId, item) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            gifts: [...t.gifts, { ...item, id: uid() }],
          })),
        }),
      updateGift: (tripId, id, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            gifts: t.gifts.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          })),
        }),
      patchDaysWeather: (tripId, byKey, fetchedAt) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            weatherUpdatedAt: fetchedAt,
            days: t.days.map((d) => {
              const snap = byKey[`${d.date}|${d.city}`]
              return snap ? { ...d, weather: snap } : d
            }),
          })),
        }),
      resetDemo: () => set({ trips: seed() }),
    }),
    { name: 'boomvoy-v1', storage: createJSONStorage(() => localStorage) },
  ),
)

export function useTrip(id?: string) {
  return useApp((s) => s.trips.find((t) => t.id === id))
}
