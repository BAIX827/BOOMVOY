import type { ReactNode } from 'react'
import { cls } from './lib'

export function Modal({
  open,
  title,
  children,
  onClose,
  wide,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <button className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_35%,transparent)]" onClick={onClose} aria-label="关闭" />
      <div className={cls('paper relative z-10 w-full p-5', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="display text-2xl">{title}</h3>
          <button className="btn-ghost btn px-3 py-1 text-sm" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="paper px-6 py-12 text-center">
      <div className="display text-2xl">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--muted)' }}>
        {text}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function CoverArt({ kind, title }: { kind: string; title: string }) {
  const palettes: Record<string, string> = {
    tokyo: 'linear-gradient(145deg,#2b241d 0%,#8b4458 46%,#e8c36a 100%)',
    'ocean-road': 'linear-gradient(145deg,#1d2a1e 0%,#4f6f52 50%,#d5e0b8 100%)',
    bali: 'linear-gradient(145deg,#173445 0%,#3e8ebe 52%,#f3d2a8 100%)',
    cream: 'linear-gradient(145deg,#d989a0,#f3d9a4)',
    ocean: 'linear-gradient(145deg,#3e8ebe,#d5eef3)',
    forest: 'linear-gradient(145deg,#4f6f52,#dfe8c8)',
  }
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: palettes[kind] || palettes.cream,
        minHeight: 160,
      }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path d="M20 150 C 80 80, 140 170, 200 90 S 330 40, 390 110" fill="none" stroke="white" strokeWidth="3" />
        <circle cx="20" cy="150" r="6" fill="white" />
        <circle cx="200" cy="90" r="5" fill="white" />
        <circle cx="390" cy="110" r="6" fill="white" />
      </svg>
      <div className="absolute bottom-4 left-4 right-4 text-white">
        <div className="display text-3xl leading-none drop-shadow">{title}</div>
      </div>
    </div>
  )
}

export function Tone({ tone, children }: { tone: string; children: ReactNode }) {
  const bg =
    tone === 'good'
      ? 'color-mix(in srgb, var(--good) 18%, white)'
      : tone === 'warn'
        ? 'color-mix(in srgb, var(--warn) 18%, white)'
        : tone === 'accent'
          ? 'var(--accent-soft)'
          : tone === 'info'
            ? 'color-mix(in srgb, var(--accent-2) 28%, white)'
            : 'var(--bg-2)'
  return (
    <span className="chip" style={{ background: bg }}>
      {children}
    </span>
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: 'var(--accent)' }}
      />
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
      {children}
    </div>
  )
}
