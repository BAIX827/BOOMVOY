/** Every existing trip route stays reachable through the four primary destinations. */
export const TRIP_NAVIGATION = [
  { key: '', label: 'trip.overview', icon: 'overview', items: [] },
  { key: 'plan', label: 'trip.plan', icon: 'plan', items: ['plan', 'map'] },
  { key: 'notebook', label: 'notebook.title', icon: 'notebook', items: ['pack', 'bookings', 'journal'] },
  { key: 'more', label: 'trip.more', icon: 'more', items: ['saved', 'compare', 'weather', 'expenses', 'budget', 'group', 'notes'] },
] as const

export function tripNavigationGroup(section: string) {
  return TRIP_NAVIGATION.find((group) => group.key === section || (group.items as readonly string[]).includes(section)) || TRIP_NAVIGATION[0]
}
