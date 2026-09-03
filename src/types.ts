export type ThemeId = 'cream' | 'ocean' | 'forest'
export type TransportMode =
  | 'self-drive'
  | 'public'
  | 'walking'
  | 'taxi'
  | 'cycling'
  | 'mixed'
  | 'flight'
export type PlaceSetting = 'indoor' | 'outdoor' | 'mixed'
export type SavedKind =
  | 'flight'
  | 'hotel'
  | 'restaurant'
  | 'place'
  | 'activity'
  | 'rental-car'
  | 'souvenir'
  | 'route'
export type DecisionStatus =
  | 'interested'
  | 'comparing'
  | 'shortlisted'
  | 'chosen'
  | 'booked'
  | 'rejected'
export type BookingStatus = 'need' | 'booked' | 'paid' | 'cancelled' | 'refunded'
export type ExpenseStatus = 'estimated' | 'booked' | 'paid'
export type Role = 'owner' | 'editor' | 'viewer'
export type PlanVariant = 'A' | 'B'
export type Priority = 'must' | 'want' | 'optional'
export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'wind'

export interface Member {
  id: string
  name: string
  role: Role
  color: string
}

export interface Coords {
  lat: number
  lng: number
}

export interface Money {
  amount: number
  currency: string
}

export interface WeatherSnap {
  condition: WeatherCondition
  tMin: number
  tMax: number
  rainProb: number
  rainWindow?: string
  summary: string
  source?: 'forecast' | 'seasonal' | 'archive' | 'placeholder'
  precipMm?: number
}

export interface PlaceStop {
  id: string
  name: string
  category: string
  setting: PlaceSetting
  time?: string
  durationMin?: number
  notes?: string
  cost?: Money & { status: ExpenseStatus }
  ticketNeeded?: boolean
  ticketUrl?: string
  booked?: boolean
  priority?: Priority
  transportToNext?: TransportMode
  coords?: Coords
  address?: string
  socialBuzz?: string
  checkedIn?: boolean
  checkedInAt?: string
  feeling?: string
  photos?: string[]
}

export interface DayPlan {
  id: string
  date: string
  city: string
  weather: WeatherSnap
  planA: PlaceStop[]
  planB: PlaceStop[]
  activePlan: PlanVariant
  notes?: string
  transportMode: TransportMode
  stay?: string
}

export interface SavedItem {
  id: string
  kind: SavedKind
  name: string
  subtitle?: string
  status: DecisionStatus
  price?: Money
  rating?: number
  url?: string
  notes?: string
  pros?: string[]
  cons?: string[]
  rejectReason?: string
  votes: Record<string, boolean>
  watchTarget?: number
  priceHistory?: { date: string; amount: number }[]
  meta?: Record<string, string>
}

export interface CompareBoard {
  id: string
  kind: 'flight' | 'hotel' | 'activity'
  title: string
  itemIds: string[]
}

export interface Booking {
  id: string
  kind: SavedKind
  name: string
  status: BookingStatus
  date?: string
  confirmation?: string
  url?: string
  cost?: Money
}

export interface BudgetCategory {
  id: string
  name: string
  estimated: number
  booked: number
  paid: number
}

export interface Expense {
  id: string
  title: string
  amount: number
  currency: string
  homeAmount?: number
  category: string
  date: string
  paidBy: string
  split: 'equal' | Record<string, number>
  excluded: string[]
  status: ExpenseStatus
  notes?: string
}

export interface GiftItem {
  id: string
  forWhom: string
  item: string
  city?: string
  status: 'need' | 'bought' | 'packed'
}

export interface Trip {
  id: string
  name: string
  origin: string
  destinations: string[]
  startDate: string
  endDate: string
  travellers: number
  members: Member[]
  budgetPerPerson: number
  totalBudget: number
  homeCurrency: string
  theme: ThemeId
  cover: string
  transportModes: TransportMode[]
  days: DayPlan[]
  saved: SavedItem[]
  compares: CompareBoard[]
  bookings: Booking[]
  budget: BudgetCategory[]
  expenses: Expense[]
  gifts: GiftItem[]
  notes: string
  share: { visibility: 'private' | 'friends' | 'public' }
  createdAt: string
  template?: boolean
  weatherUpdatedAt?: string
}

export interface Profile {
  name: string
  homeCity: string
  homeCurrency: string
  themePref: ThemeId | 'auto'
  locale?: 'zh' | 'en'
  llmUrl?: string
  llmKey?: string
  llmModel?: string
}
