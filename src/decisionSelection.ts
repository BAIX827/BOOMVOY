import type { DecisionCandidate, DecisionPreferences } from './decisionTypes'
import type { SavedItem, Trip } from './types'
import { uid } from './lib'
import { CUISINES, buildDecisionLinks, safeDecisionUrl } from './decision'

function cleanStoredCandidate(raw: DecisionCandidate): DecisionCandidate | undefined {
  if (!raw || !['hotel', 'restaurant'].includes(raw.kind) || !['curated', 'saved'].includes(raw.source) || typeof raw.id !== 'string' || typeof raw.name !== 'string' || typeof raw.city !== 'string') return undefined
  const rating = raw.rating && typeof raw.rating.value === 'number' && Number.isFinite(raw.rating.value) && raw.rating.value >= 1 && raw.rating.value <= 5 && safeDecisionUrl(raw.rating.sourceUrl)
    ? { value: raw.rating.value, sourceUrl: safeDecisionUrl(raw.rating.sourceUrl)!, count: Number.isInteger(raw.rating.count) && raw.rating.count! >= 0 ? raw.rating.count : undefined } : undefined
  const price = raw.price && typeof raw.price.max === 'number' && Number.isFinite(raw.price.max) && raw.price.max > 0 && typeof raw.price.currency === 'string' && /^[A-Z]{3}$/.test(raw.price.currency) && ['night', 'person'].includes(raw.price.basis)
    ? { max: raw.price.max, currency: raw.price.currency, basis: raw.price.basis, min: typeof raw.price.min === 'number' && Number.isFinite(raw.price.min) && raw.price.min >= 0 && raw.price.min <= raw.price.max ? raw.price.min : undefined } : undefined
  return {
    id: raw.id.slice(0, 300), kind: raw.kind, name: raw.name.slice(0, 250), city: raw.city.slice(0, 120), source: raw.source,
    sourceUrl: safeDecisionUrl(raw.sourceUrl) || '', websiteUrl: safeDecisionUrl(raw.websiteUrl), bookingUrl: safeDecisionUrl(raw.bookingUrl), mapsUrl: safeDecisionUrl(raw.mapsUrl),
    address: typeof raw.address === 'string' ? raw.address.slice(0, 500) : undefined,
    checkedAt: typeof raw.checkedAt === 'string' && Number.isFinite(Date.parse(raw.checkedAt)) ? raw.checkedAt : undefined,
    cuisines: Array.isArray(raw.cuisines) ? raw.cuisines.filter((cuisine) => CUISINES.includes(cuisine)) : undefined,
    parking: ['free', 'paid', 'available', 'none'].includes(raw.parking || '') ? raw.parking : 'unknown',
    seaView: ['room', 'property', 'none'].includes(raw.seaView || '') ? raw.seaView : 'unknown', rating, price,
  }
}

export function savedDecisionCandidates(saved: SavedItem[]): DecisionCandidate[] {
  return saved.filter((item) => (item.kind === 'hotel' || item.kind === 'restaurant') && item.status !== 'rejected' && item.meta?.decisionSource !== 'google').map((item) => {
    const stored = item.decision && cleanStoredCandidate(item.decision)
    if (stored) return { ...stored, id: typeof item.meta?.decisionId === 'string' ? item.meta.decisionId : stored.id }
    return {
      id: `saved:${item.id}`, kind: item.kind as 'hotel' | 'restaurant', name: item.name,
      city: item.meta?.city || '', source: 'saved' as const,
      sourceUrl: safeDecisionUrl(item.url) || '', websiteUrl: safeDecisionUrl(item.url),
      // Historical prices may cover a whole stay; require an explicit basis before comparing budgets.
      price: item.price && (item.meta?.priceBasis === 'night' || item.meta?.priceBasis === 'person') ? { max: item.price.amount, currency: item.price.currency, basis: item.meta.priceBasis } : undefined,
    }
  })
}

/** One immutable selection: bookmark, board, booking reminder and optional meal slot. */
export function selectDecision(trip: Trip, candidate: DecisionCandidate, prefs: DecisionPreferences, label: string, choose: boolean, boardTitle: string): { trip: Trip; savedId: string } | { error: 'label' | 'mealConflict' | 'date' } {
  if (!label.trim()) return { error: 'label' }
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T12:00:00Z')) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date
  if (choose && candidate.kind === 'hotel' && (!validDate(prefs.checkin) || !validDate(prefs.checkout) || prefs.checkout <= prefs.checkin || prefs.checkin < trip.startDate || prefs.checkout > trip.endDate)) return { error: 'date' }
  if (choose && candidate.kind === 'restaurant' && !trip.days.some((day) => day.date === prefs.checkin)) return { error: 'date' }
  const previous = trip.saved.find((item) => item.meta?.decisionId === candidate.id || candidate.id === `saved:${item.id}`)
  const savedId = previous?.id || uid()
  if (choose && candidate.kind === 'restaurant' && trip.mealSelections?.some((meal) => meal.date === prefs.checkin && meal.savedId !== savedId)) return { error: 'mealConflict' }
  const links = buildDecisionLinks(prefs, candidate)
  const google = candidate.source === 'google'
  const reference = google
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${prefs.city} ${prefs.kind}`)}&query_place_id=${encodeURIComponent(candidate.id.replace(/^google[:\-]/, ''))}`
    : safeDecisionUrl(candidate.bookingUrl) || links.find((link) => link.kind === 'booking')?.url || links.find((link) => link.kind === 'detail')?.url
  const item: SavedItem = {
    ...previous, id: savedId, kind: candidate.kind, name: label.trim().slice(0, 160),
    status: previous?.status === 'booked' ? 'booked' : choose ? 'chosen' : previous?.status || 'comparing',
    votes: previous?.votes || {}, url: safeDecisionUrl(reference),
    meta: { ...previous?.meta, decisionId: candidate.id, decisionSource: candidate.source, city: prefs.city },
    decision: google ? undefined : { ...candidate },
  }
  // Google Place IDs and the traveller's own labels/preferences are retained; provider facts remain session-only.
  if (google) { delete item.rating; delete item.price; delete item.subtitle }
  const saved = previous ? trip.saved.map((entry) => entry.id === savedId ? item : entry) : [...trip.saved, item]
  const board = trip.compares.find((entry) => entry.kind === candidate.kind && (entry.itemIds.includes(savedId) || entry.city?.trim().toLowerCase() === prefs.city.trim().toLowerCase()))
  const compares = board ? trip.compares.map((entry) => entry.id === board.id ? { ...entry, itemIds: [...new Set([...entry.itemIds, savedId])] } : entry) : [...trip.compares, { id: uid(), kind: candidate.kind, city: prefs.city, title: `${prefs.city} · ${boardTitle}`, itemIds: [savedId] }]
  const bookingExists = trip.bookings.some((entry) => entry.sourceSavedId === savedId && entry.date === prefs.checkin && !['cancelled', 'refunded'].includes(entry.status))
  const bookings = choose && !bookingExists ? [...trip.bookings, { id: uid(), kind: candidate.kind, name: item.name, status: 'need' as const, date: prefs.checkin, checkout: candidate.kind === 'hotel' ? prefs.checkout : undefined, url: item.url, sourceSavedId: savedId }] : trip.bookings
  const mealSelections = choose && candidate.kind === 'restaurant'
    ? [...(trip.mealSelections || []).filter((meal) => meal.date !== prefs.checkin), { date: prefs.checkin, city: prefs.city, cuisine: !google && prefs.cuisine === 'any' ? candidate.cuisines?.find((cuisine) => cuisine !== 'any') || 'any' : prefs.cuisine, savedId }]
    : trip.mealSelections
  return { trip: { ...trip, saved, compares, bookings, mealSelections, decisionPreferences: { ...prefs } }, savedId }
}
