export type DecisionKind = 'hotel' | 'restaurant'
export type Cuisine = 'any' | 'mexican' | 'japanese' | 'italian' | 'thai' | 'chinese' | 'indian' | 'korean' | 'vietnamese' | 'local'
export type DecisionPreferences = {
  kind: DecisionKind
  city: string
  budgetMax?: number
  currency: string
  seaView: boolean
  parking: boolean
  freeParking: boolean
  cuisine: Cuisine
  excludedCuisines?: Cuisine[]
  variety: boolean
  minRating: number
  minReviews: number
  checkin: string
  checkout: string
  travellers: number
}
export type DecisionCandidate = {
  id: string
  kind: DecisionKind
  name: string
  city: string
  address?: string
  source: 'google' | 'curated' | 'saved'
  sourceUrl: string
  checkedAt?: string
  websiteUrl?: string
  bookingUrl?: string
  mapsUrl?: string
  cuisines?: Cuisine[]
  parking?: 'free' | 'paid' | 'available' | 'none' | 'unknown'
  seaView?: 'room' | 'property' | 'none' | 'unknown'
  price?: { min?: number; max: number; currency: string; basis: 'night' | 'person' }
  rating?: { value: number; count?: number; sourceUrl: string }
  reservable?: boolean
  attributions?: { name: string; url?: string }[]
}
export type DecisionCriterion = { key: 'budget' | 'seaView' | 'parking' | 'freeParking' | 'cuisine' | 'rating' | 'reviews'; state: 'match' | 'unknown' | 'fail' }
export type RankedDecision = { candidate: DecisionCandidate; criteria: DecisionCriterion[]; matchScore: number; confidence: 'confirmed' | 'check' | 'excluded'; qualityScore: number }
export type MealChoice = { date: string; city: string; cuisine: Cuisine; candidate?: DecisionCandidate; repeated: boolean }
