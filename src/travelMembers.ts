/** Fill unnamed travellers without changing the identities used by existing expenses. */
export function completeMemberNames(names: string[], total: number, placeholder: (n: number) => string) {
  const named = names.map((name) => name.trim()).filter(Boolean)
  const count = Math.max(named.length, Math.min(100, Math.max(1, Math.floor(total))))
  return Array.from({ length: count }, (_, index) => named[index] || placeholder(index + 1))
}

export function pendingMemberName(name: string) {
  return /^(?:旅伴 \d+（待命名）|Traveller \d+ \(name pending\))$/.test(name)
}
