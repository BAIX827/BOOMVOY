import type { SavedItem, Money } from './types'
export function savedBookingCost(item: SavedItem, date?: string, checkout?: string): Money | undefined {
  if (!item.price) return undefined
  if (item.kind !== 'hotel' || item.meta?.priceBasis !== 'night') return { ...item.price }
  if (!date || !checkout) return undefined
  const nights = Math.round((Date.parse(checkout) - Date.parse(date)) / 86400000)
  const amount = item.price.amount * nights
  return Number.isInteger(nights) && nights > 0 && nights <= 730 && Number.isFinite(amount) && amount <= 1_000_000_000_000 ? { amount, currency: item.price.currency } : undefined
}
