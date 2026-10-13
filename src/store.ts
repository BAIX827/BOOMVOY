import { completeMemberNames } from './travelMembers'
import { t as translate, resolveLocale } from './i18n'
import { canEditTrip, useShared } from './collaborationState'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Booking,
  CompareBoard,
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
import { emptyBudget, japanTrip, oceanRoadTrip } from './data'
import { emptyPacking } from './packing'
import { cityForDay, copyJSON, eachDate, uid } from './lib'
import { hasTravelRecord, planFingerprint, prepareRecommendation, type RecommendationApplyResult, type RecommendationMode, type RecommendationUndo } from './recommendationApplication'
import { selectDecision } from './decisionSelection'
import type { DecisionCandidate, DecisionPreferences } from './decisionTypes'
import { rescheduleTrip, scheduleDraft, shiftDate } from './tripSchedule'
import { settle } from './domain'
import { reconcileBookingLinks } from './bookingLinkage'

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
    destinationDays?: number[]
  }) => string
  updateTrip: (id: string, patch: Partial<Trip>) => void
  deleteTrip: (id: string) => void
  cloneTrip: (id: string, asMine?: boolean, startDate?: string) => string
  cloneDay: (tripId: string, dayId: string, targetTripId: string) => void
  addDayPlace: (tripId: string, dayId: string, plan: PlanVariant, place: Omit<PlaceStop, 'id'>) => string
  scheduleSaved: (tripId: string, savedId: string, dayId: string, time: string, checkout?: string) => string | null
  updatePlace: (tripId: string, dayId: string, plan: PlanVariant, placeId: string, patch: Partial<PlaceStop>) => void
  removePlace: (tripId: string, dayId: string, plan: PlanVariant, placeId: string) => void
  reorderPlaces: (tripId: string, dayId: string, plan: PlanVariant, ids: string[]) => void
  setActivePlan: (tripId: string, dayId: string, plan: PlanVariant) => void
  replacePlaces: (tripId: string, dayId: string, plan: PlanVariant, places: PlaceStop[]) => void
  applyRecommendation: (tripId: string, dayId: string, plan: PlanVariant, mode: RecommendationMode, places: Omit<PlaceStop, 'id'>[], expected: string) => RecommendationApplyResult
  undoRecommendation: (tripId: string, dayId: string, plan: PlanVariant, undo: RecommendationUndo) => boolean
  addSaved: (tripId: string, item: Omit<SavedItem, 'id' | 'votes'>) => void
  saveDecision: (tripId: string, candidate: DecisionCandidate, preferences: DecisionPreferences, label: string, choose: boolean, boardTitle: string) => string | null
  updateSaved: (tripId: string, itemId: string, patch: Partial<SavedItem>) => void
  removeSaved: (tripId: string, itemId: string) => void
  toggleVote: (tripId: string, itemId: string, memberId: string) => void
  addCompareBoard: (tripId: string, board: Omit<CompareBoard, 'id'>) => void
  updateCompareBoard: (tripId: string, id: string, patch: Partial<CompareBoard>) => void
  removeCompareBoard: (tripId: string, id: string) => void
  addBooking: (tripId: string, item: Omit<Booking, 'id'>) => void
  updateBooking: (tripId: string, id: string, patch: Partial<Booking>) => void
  removeBooking: (tripId: string, id: string) => void
  addExpense: (tripId: string, item: Omit<Expense, 'id'>) => void
  updateExpense: (tripId: string, id: string, patch: Partial<Expense>) => void
  removeExpense: (tripId: string, id: string) => void
  recordSettlement: (tripId: string, transfer: { from: string; to: string; amount: number }) => boolean
  undoSettlement: (tripId: string, id: string) => void
  removeGift: (tripId: string, id: string) => void
  addGift: (tripId: string, item: Omit<GiftItem, 'id'>) => void
  updateGift: (tripId: string, id: string, patch: Partial<GiftItem>) => void
  patchDaysWeather: (tripId: string, byKey: Record<string, WeatherSnap>, fetchedAt: string) => void
  resetDemo: () => void
}

function seed(): Trip[] {
  return [japanTrip(), oceanRoadTrip()]
}

function migratePersisted(state: unknown) {
  const stored = state as Partial<AppState>
  const safeProfile = stored.profile && typeof stored.profile === 'object' ? { ...stored.profile as unknown as Record<string, unknown> } : {}
  for (const key of ['llmKey', 'llmUrl', 'llmModel', 'decisionApiUrl']) delete safeProfile[key]
  if (!Array.isArray(stored.trips)) return { ...stored, profile: safeProfile, trips: seed() }
  return {
    ...stored,
    profile: safeProfile,
    trips: stored.trips
      .filter((trip) => trip.id !== 'template-bali')
      .map((trip) =>
        trip.id === 'template-gor' && trip.template ? oceanRoadTrip() : trip.id === 'japan-2026'
          ? { ...trip, compares: trip.compares.filter((board) => board.id !== 'cmp-hotel-osa') }
          : trip,
      ),
  }
}

function patchTrip(trips: Trip[], id: string, fn: (t: Trip) => Trip): Trip[] {
  return trips.map((t) => (t.id === id && canEditTrip(id) ? fn(t) : t))
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
        const members = completeMemberNames(draft.members, draft.travellers, (n) => translate(resolveLocale(get().profile.locale), 'members.placeholder', { n })).map((name, i) => ({
          id: i === 0 ? 'me' : uid(),
          name,
          role: i === 0 ? ('owner' as const) : ('editor' as const),
          color: ['#D989A0', '#3E8EBE', '#6B8F71', '#E8C36A'][i % 4],
        }))
        const travellers = Math.max(draft.travellers, members.length)
        const dest0 = draft.destinations[0] || draft.origin
        const destinationDays = draft.destinationDays || []
        const days: DayPlan[] = eachDate(draft.startDate, draft.endDate).map((date, index) => ({
          id: uid(),
          date,
          city: cityForDay(draft.destinations, destinationDays, index) || dest0,
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
          travellers,
          members: members.length ? members : [{ id: 'me', name: 'Me', role: 'owner', color: '#D989A0' }],
          budgetPerPerson: draft.budgetPerPerson,
          totalBudget: draft.budgetPerPerson * travellers,
          homeCurrency: draft.homeCurrency,
          theme: draft.theme,
          cover: draft.theme,
          transportModes: draft.transportModes,
          days,
          saved: [],
          compares: [],
          bookings: [],
          budget: emptyBudget(draft.budgetPerPerson * travellers),
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
      updateTrip: (id, patch) => { const session = useShared.getState().sessions[id]; const previous = get().trips.find((trip) => trip.id === id); if (session && session.role !== 'owner' && (patch.members && JSON.stringify(patch.members) !== JSON.stringify(previous?.members) || patch.travellers !== undefined && patch.travellers !== previous?.travellers)) return; set({ trips: patchTrip(get().trips, id, (t) => ({ ...t, ...patch })) }) },
      deleteTrip: (id) => { if (canEditTrip(id)) { useShared.getState().disconnect(id); set({ trips: get().trips.filter((t) => t.id !== id) }) } },
      cloneTrip: (id, asMine = true, startDate) => {
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
        let result = copy
        if (startDate) {
          const draft = scheduleDraft(copy)
          const next = rescheduleTrip(copy, { ...draft, startDate, endDate: shiftDate(startDate, copy.days.length - 1) })
          if (!next.ok) return id
          result = next.trip
        }
        set({ trips: [result, ...get().trips] })
        return result.id
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
      addDayPlace: (tripId, dayId, plan, place) => {
        const id = uid()
        set({
          trips: patchTrip(get().trips, tripId, (t) =>
            patchDay(t, dayId, (d) => {
              const key = plan === 'A' ? 'planA' : 'planB'
              return { ...d, [key]: [...d[key], { ...place, id }] }
            }),
          ),
        })
        return id
      },
      scheduleSaved: (tripId, savedId, dayId, time, checkout) => {
        const trip = get().trips.find((item) => item.id === tripId)
        const saved = trip?.saved.find((item) => item.id === savedId)
        const day = trip?.days.find((item) => item.id === dayId)
        if (!canEditTrip(tripId) || !trip || !saved || !day || !['hotel', 'restaurant', 'place', 'activity', 'souvenir'].includes(saved.kind)) return null
        if (saved.kind === 'hotel') {
          if (!checkout || !trip.days.some((item) => item.date === checkout) || checkout <= day.date) return null
          const existing = trip.bookings.find((item) => item.sourceSavedId === savedId && (item.date === day.date || !item.date && item.status === 'need') && item.status !== 'cancelled' && item.status !== 'refunded')
          if (existing && (existing.status === 'booked' || existing.status === 'paid') && existing.checkout !== checkout) return null
          const booking: Booking = { ...existing, id: existing?.id || uid(), kind: 'hotel', name: saved.name, status: existing?.status || 'need', date: day.date, checkout, url: saved.url, cost: existing?.cost, costFromSaved: existing?.costFromSaved ?? !existing?.cost, notes: existing?.notes || saved.notes, sourceSavedId: savedId }
          const next = reconcileBookingLinks({ ...trip, bookings: existing ? trip.bookings.map((item) => item.id === existing.id ? booking : item) : [...trip.bookings, booking],
            saved: trip.saved.map((item) => item.id === savedId && item.status !== 'booked' ? { ...item, status: 'chosen' as const } : item),
            days: trip.days.map((item) => item.date >= day.date && item.date < checkout ? { ...item, stay: saved.name, stayBookingId: booking.id } : item),
          })
          set({ trips: patchTrip(get().trips, tripId, () => next) })
          return booking.id
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
        const key = day.activePlan === 'A' ? 'planA' : 'planB'
        const duplicate = day[key].find((place) => place.sourceSavedId === savedId)
        if (duplicate) return duplicate.id
        const id = uid()
        const place: PlaceStop = { id, sourceSavedId: savedId, name: saved.name, time, category: saved.kind === 'restaurant' ? '餐饮' : saved.kind === 'souvenir' ? '购物' : saved.kind === 'activity' ? '活动' : '景点', setting: saved.kind === 'restaurant' ? 'indoor' : 'mixed', notes: saved.notes, transportToNext: day.transportMode, cost: saved.price ? { ...saved.price, status: 'estimated' } : undefined }
        set({ trips: patchTrip(get().trips, tripId, () => reconcileBookingLinks(patchDay(trip, dayId, (item) => ({ ...item, [key]: [...item[key], place] })))) })
        return id
      },
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
      applyRecommendation: (tripId, dayId, plan, mode, places, expected) => {
        const trip = get().trips.find((item) => item.id === tripId)
        const day = trip?.days.find((item) => item.id === dayId)
        const key = plan === 'A' ? 'planA' : 'planB'
        if (!canEditTrip(tripId) || !day || day.activePlan !== plan || planFingerprint(day[key]) !== expected) return { ok: false, reason: 'changed' }
        if (mode === 'replace' && hasTravelRecord(day[key])) return { ok: false, reason: 'protected' }
        if (!places.length) return { ok: false, reason: 'empty' }
        const next = prepareRecommendation(day[key], places, mode)
        const count = mode === 'append' ? next.length - day[key].length : next.length
        if (!count) return { ok: false, reason: 'empty' }
        const undo = { before: day[key], after: planFingerprint(next) }
        set({ trips: patchTrip(get().trips, tripId, (t) => patchDay(t, dayId, (d) => ({ ...d, [key]: next }))) })
        return { ok: true, count, undo }
      },
      undoRecommendation: (tripId, dayId, plan, undo) => {
        const day = get().trips.find((item) => item.id === tripId)?.days.find((item) => item.id === dayId)
        const key = plan === 'A' ? 'planA' : 'planB'
        if (!canEditTrip(tripId) || !day || day.activePlan !== plan || planFingerprint(day[key]) !== undo.after) return false
        set({ trips: patchTrip(get().trips, tripId, (t) => patchDay(t, dayId, (d) => ({ ...d, [key]: undo.before }))) })
        return true
      },
      addSaved: (tripId, item) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            saved: [...t.saved, { ...item, id: uid(), votes: {} }],
          })),
        }),
      saveDecision: (tripId, candidate, preferences, label, choose, boardTitle) => {
        const trip = get().trips.find((entry) => entry.id === tripId)
        if (!trip || !canEditTrip(tripId)) return 'trip'
        const result = selectDecision(trip, candidate, preferences, label, choose, boardTitle)
        if ('error' in result) return result.error
        set({ trips: get().trips.map((entry) => entry.id === tripId ? reconcileBookingLinks(result.trip) : entry) })
        return null
      },
      updateSaved: (tripId, itemId, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => reconcileBookingLinks({
            ...t,
            saved: t.saved.map((s) => (s.id === itemId ? { ...s, ...patch } : s)),
          })),
        }),
      removeSaved: (tripId, itemId) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            saved: t.saved.filter((s) => s.id !== itemId),
            mealSelections: t.mealSelections?.filter((meal) => meal.savedId !== itemId),
            compares: t.compares.map((board) => ({
              ...board,
              itemIds: board.itemIds.filter((id) => id !== itemId),
            })),
          })),
        }),
      toggleVote: (tripId, itemId, memberId) => {
        const session = useShared.getState().sessions[tripId]
        if (session) { if (session.memberId === memberId) session.vote?.(itemId); return }
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
        })
      },
      addCompareBoard: (tripId, board) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            compares: [...t.compares, { ...board, id: uid() }],
          })),
        }),
      updateCompareBoard: (tripId, id, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            compares: t.compares.map((board) => (board.id === id ? { ...board, ...patch } : board)),
          })),
        }),
      removeCompareBoard: (tripId, id) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            compares: t.compares.filter((board) => board.id !== id),
          })),
        }),
      addBooking: (tripId, item) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => reconcileBookingLinks({
            ...t,
            bookings: [...t.bookings, { ...item, id: uid() }],
          })),
        }),
      updateBooking: (tripId, id, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => reconcileBookingLinks({
            ...t,
            bookings: t.bookings.map((b) => (b.id === id ? { ...b, ...patch, costFromSaved: Object.hasOwn(patch, 'cost') && JSON.stringify(patch.cost) !== JSON.stringify(b.cost) ? false : b.costFromSaved } : b)),
          })),
        }),
      removeBooking: (tripId, id) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => reconcileBookingLinks({
            ...t,
            bookings: t.bookings.filter((booking) => booking.id !== id),
            saved: t.saved.map((item) => item.status === 'booked' && t.bookings.some((booking) => booking.id === id && booking.sourceSavedId === item.id) ? { ...item, status: 'chosen' as const } : item),
          })),
        }),
      addExpense: (tripId, item) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            expenses: [...t.expenses, { ...item, id: uid() }],
          })),
        }),
      updateExpense: (tripId, id, patch) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            expenses: t.expenses.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)),
          })),
        }),
      removeExpense: (tripId, id) =>
        set({
          trips: patchTrip(get().trips, tripId, (t) => ({
            ...t,
            expenses: t.expenses.filter((e) => e.id !== id),
          })),
        }),
      recordSettlement: (tripId, transfer) => {
        const trip = get().trips.find((item) => item.id === tripId)
        const current = trip && settle(trip).transfers.find((entry) => entry.from === transfer.from && entry.to === transfer.to && Math.abs(entry.amount - transfer.amount) < 0.005)
        if (!trip || !current || !canEditTrip(tripId)) return false
        set({ trips: patchTrip(get().trips, tripId, (item) => ({ ...item, settlements: [...(item.settlements || []), { ...current, id: uid(), currency: item.homeCurrency, settledAt: new Date().toISOString() }] })) })
        return true
      },
      undoSettlement: (tripId, id) => set({ trips: patchTrip(get().trips, tripId, (trip) => ({ ...trip, settlements: trip.settlements?.filter((entry) => entry.id !== id) })) }),
      removeGift: (tripId, id) => set({ trips: patchTrip(get().trips, tripId, (trip) => ({ ...trip, gifts: trip.gifts.filter((entry) => entry.id !== id) })) }),
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
    {
      name: 'boomvoy-v1',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: migratePersisted,
    },
  ),
)

export function useTrip(id?: string) {
  return useApp((s) => s.trips.find((t) => t.id === id))
}

/** Keep memory and persisted state together if localStorage rejects a large replacement. */
export function replaceTravelData(next: Pick<AppState, 'profile' | 'trips'>) {
  const previous = useApp.getState()
  try {
    useApp.setState(next)
  } catch (error) {
    try {
      useApp.setState({ profile: previous.profile, trips: previous.trips })
    } catch { /* the previous persisted value remains the recovery source on reload */ }
    throw error
  }
}
