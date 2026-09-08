import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, MessageCircle, X } from 'lucide-react'
import { useApp } from './store'
import boomi from './assets/boomi.png'
import { matchBoomi, type BoomiHit } from './boomiChat'
import { boomiSay } from './boomiVoice.mjs'
import { guideChips, guideSteps, guideTripId } from './boomiGuide'
import { askBoomi, resolveBackend } from './llm'
import { useT, type TFn } from './i18n'

type ChatMsg = { who: 'user' | 'boomi'; text: string; action?: BoomiHit }

const SEEN_KEY = 'boomvoy-met-boom'

function pageTip(pathname: string, t: TFn) {
  if (pathname === '/' || pathname.endsWith('/')) return t('guide.tip.home')
  if (pathname.includes('/explore')) return t('guide.tip.explore')
  if (pathname.includes('/new')) return t('guide.tip.new')
  if (pathname.includes('/profile')) return t('guide.tip.profile')
  if (pathname.includes('/plan')) return t('guide.tip.plan')
  if (pathname.includes('/journal')) return t('guide.tip.journal')
  if (pathname.includes('/pack')) return t('guide.tip.pack')
  if (pathname.includes('/map')) return t('guide.tip.map')
  if (pathname.includes('/saved')) return t('guide.tip.saved')
  if (pathname.includes('/compare')) return t('guide.tip.compare')
  if (pathname.includes('/bookings')) return t('guide.tip.bookings')
  if (pathname.includes('/budget')) return t('guide.tip.budget')
  if (pathname.includes('/expenses')) return t('guide.tip.expenses')
  if (pathname.includes('/weather')) return t('guide.tip.weather')
  if (pathname.includes('/group')) return t('guide.tip.group')
  if (pathname.includes('/notes')) return t('guide.tip.notes')
  if (pathname.includes('/share')) return t('guide.tip.share')
  if (pathname.includes('/trip/')) return t('guide.tip.trip')
  return t('guide.tip.fallback')
}

function findTarget(selector: string) {
  return [...document.querySelectorAll(selector)].find((node) => {
    const r = node.getBoundingClientRect()
    return r.width > 2 && r.height > 2
  })
}

function findRect(selector: string) {
  const el = findTarget(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return new DOMRect(r.x - 8, r.y - 8, r.width + 16, r.height + 16)
}

export default function GuideCat() {
  const loc = useLocation()
  const nav = useNavigate()
  const { t, locale } = useT()
  const trips = useApp((s) => s.trips)
  const profile = useApp((s) => s.profile)
  const tripId = guideTripId(trips, loc.pathname)
  const [tourTripId, setTourTripId] = useState<string>()
  const [open, setOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  const [step, setStep] = useState(0)
  const [bubble, setBubble] = useState(false)
  const [hi, setHi] = useState<DOMRect | null>(null)
  const [nudge, setNudge] = useState<DOMRect | null>(null)
  const [draft, setDraft] = useState('')
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [busy, setBusy] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const catButton = useRef<HTMLButtonElement>(null)
  const replyController = useRef<AbortController | null>(null)
  const replyVersion = useRef(0)
  const sending = useRef(false)
  const nudgeTimers = useRef<number[]>([])
  const welcomeTimer = useRef<number | undefined>(undefined)
  const currentPath = useRef(loc.pathname)

  const steps = useMemo(() => guideSteps(t, tourTripId), [tourTripId, t])

  useEffect(() => {
    let seen = false
    try { seen = !!localStorage.getItem(SEEN_KEY) } catch { /* A blocked storage area must not break the guide. */ }
    if (!seen) {
      welcomeTimer.current = window.setTimeout(() => setBubble(true), 700)
      return () => window.clearTimeout(welcomeTimer.current)
    }
  }, [])

  useEffect(() => {
    const replay = () => startTour()
    window.addEventListener('boomvoy-start-guide', replay)
    return () => window.removeEventListener('boomvoy-start-guide', replay)
  }, [tripId, loc.pathname, t])

  useEffect(() => {
    const list = chatEnd.current
    if (list) list.scrollTop = list.scrollHeight
  }, [msgs, busy])

  useEffect(() => { cancelReply(); setMsgs([]); setDraft('') }, [locale])
  useEffect(() => { currentPath.current = loc.pathname; cancelReply(); setNudge(null) }, [loc.pathname])
  useEffect(() => () => {
    replyVersion.current += 1
    replyController.current?.abort()
    nudgeTimers.current.forEach(window.clearTimeout)
  }, [])

  useEffect(() => {
    if (!open && !touring && !bubble) return
    if (open || touring) dialog.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish() }
      if (event.key !== 'Tab' || !touring || !dialog.current) return
      const controls = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      const first = controls[0], last = controls[controls.length - 1]
      if (!dialog.current.contains(document.activeElement)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus()
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, touring, bubble])

  const current = steps[step]

  function measure() {
    if (!touring || !current?.selector) {
      setHi(null)
      return
    }
    const first = current.selector.split(',').map((s) => s.trim()).find((s) => findRect(s))
    setHi(first ? findRect(first) : null)
  }

  useLayoutEffect(() => {
    let located = false
    const reveal = () => {
      if (touring && current?.selector && !located) {
        const target = findTarget(current.selector)
        if (target) { located = true; target.scrollIntoView({ block: 'center', behavior: 'instant' }) }
      }
      measure()
    }
    reveal()
    const observer = new MutationObserver(() => { if (!located) reveal() })
    if (touring) observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setTimeout(reveal, 380)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [touring, step, loc.pathname, current?.selector])

  function meetBoom() {
    window.clearTimeout(welcomeTimer.current)
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* Session-only dismissal still works. */ }
    setBubble(false)
  }

  async function goStep(i: number) {
    const next = steps[i]
    if (!next) return finish()
    setStep(i)
    if (next.route && next.route !== loc.pathname) {
      nav(next.route)
    }
  }

  function startTour() {
    meetBoom()
    cancelReply()
    setTourTripId(tripId)
    setOpen(false)
    setTouring(true)
    setStep(0)
    const first = guideSteps(t, tripId)[0]
    if (first.route !== loc.pathname) nav(first.route)
  }

  function finish() {
    cancelReply()
    nudgeTimers.current.forEach(window.clearTimeout)
    nudgeTimers.current = []
    setNudge(null)
    setTouring(false)
    setHi(null)
    setOpen(false)
    meetBoom()
    catButton.current?.focus({ preventScroll: true })
  }

  function cancelReply() {
    replyVersion.current += 1
    replyController.current?.abort()
    sending.current = false
    setBusy(false)
  }

  function onCat() {
    if (touring) return
    meetBoom()
    if (open) finish()
    else setOpen(true)
  }

  function pointAt(selector?: string, wait = 80, pathname = loc.pathname) {
    if (!selector) return
    nudgeTimers.current.forEach(window.clearTimeout)
    nudgeTimers.current = [window.setTimeout(() => {
      if (currentPath.current !== pathname) return
      const first = selector.split(',').map((s) => s.trim()).find((s) => findRect(s))
      const box = first ? findRect(first) : null
      if (!box) return
      findTarget(selector)?.scrollIntoView({ block: 'center', behavior: 'instant' })
      setNudge(first ? findRect(first) : box)
      nudgeTimers.current.push(window.setTimeout(() => setNudge(null), 3200))
    }, wait)]
  }

  function openAnswer(hit: BoomiHit) {
    if (!hit.route) return
    const destinationTrip = hit.route.match(/^\/trip\/([^/]+)/)?.[1]
    if (destinationTrip && !trips.some((trip) => trip.id === destinationTrip)) { nav('/new'); return }
    if (hit.route !== loc.pathname) { nav(hit.route); pointAt(hit.selector, 480, hit.route) }
    else pointAt(hit.selector)
  }

  async function send(text?: string) {
    const q = (text ?? draft).trim()
    if (!q || q.length > 2000 || sending.current) return
    sending.current = true
    const version = ++replyVersion.current
    const abort = new AbortController()
    replyController.current = abort
    setDraft('')
    setMsgs((m) => [...m.slice(-18), { who: 'user', text: q }])
    setBusy(true)
    const hit = matchBoomi(q, tripId)
    try {
      if (hit) {
        setMsgs((m) => [...m, { who: 'boomi', text: t(hit.sayKey), action: hit.route ? hit : undefined }])
        return
      }
      const backend = resolveBackend(profile)
      if (backend.ready) {
        const reply = await askBoomi(backend, q, locale, loc.pathname, abort.signal)
        if (version !== replyVersion.current || abort.signal.aborted) return
        setMsgs((m) => [...m, { who: 'boomi', text: reply }])
        return
      }
      setMsgs((m) => [...m, { who: 'boomi', text: t('chat.unknown') }])
    } catch {
      if (version === replyVersion.current && !abort.signal.aborted) setMsgs((m) => [...m, { who: 'boomi', text: t('chat.unknown') }])
    } finally {
      if (version === replyVersion.current) { setBusy(false); sending.current = false }
    }
  }

  const chips = guideChips(loc.pathname).map((key) => t(`guide.chip.${key}`))

  return (
    <>
      {touring && (
        <div className="fixed inset-0 z-[70]" onClick={() => void 0}>
          <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--ink) 38%, transparent)' }} onClick={finish} />
          {hi && (
            <div
              className="guide-spot"
              style={{
                top: hi.top,
                left: hi.left,
                width: hi.width,
                height: hi.height,
              }}
            />
          )}
        </div>
      )}
      {!touring && nudge && (
        <div
          className="guide-spot"
          style={{
            top: nudge.top,
            left: nudge.left,
            width: nudge.width,
            height: nudge.height,
          }}
        />
      )}

      <div className="guide-dock">
        {(bubble || open || touring) && (
          <div ref={dialog} tabIndex={-1} className="guide-card paper" role="dialog" aria-modal={touring || undefined} aria-label={t('guide.aria')}>
            <div className="guide-card-header">
              <span><MessageCircle size={14} aria-hidden="true" /> BOOMI</span>
              <button className="guide-close" type="button" onClick={finish} aria-label={t('guide.close')}><X size={17} /></button>
            </div>
            {touring && current ? (
              <>
                <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                  {t('guide.progress', { n: step + 1, total: steps.length })}
                </div>
                <div className="display mt-1 text-xl">{current.title}</div>
                <p className="mt-2 text-sm leading-6" aria-live="polite">{boomiSay(current.say)}</p>
                <div className="guide-progress-track" aria-hidden="true"><span style={{ width: `${(step + 1) / steps.length * 100}%` }} /></div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={step === 0} onClick={() => goStep(step - 1)}>
                    {t('guide.prev')}
                  </button>
                  {step < steps.length - 1 ? (
                    <button className="btn px-3 py-1.5 text-sm" onClick={() => goStep(step + 1)}>
                      {t('guide.next')}
                    </button>
                  ) : (
                    <button className="btn btn-accent px-3 py-1.5 text-sm" onClick={finish}>
                      {t('guide.done')}
                    </button>
                  )}
                  <button className="text-xs" style={{ color: 'var(--muted)' }} onClick={finish}>
                    {t('guide.skip')}
                  </button>
                </div>
              </>
            ) : open ? (
              <>
                <div className="display text-xl">{t('guide.here')}</div>
                <p className="mt-2 text-sm leading-6">{boomiSay(pageTip(loc.pathname, t))}</p>
                {msgs.length > 0 && (
                  <div ref={chatEnd} className="guide-chat" role="log" aria-live="polite" aria-relevant="additions">
                    {msgs.map((m, i) => (
                      <div key={`${m.who}-${i}`} className={m.who === 'user' ? 'guide-msg guide-msg-user' : 'guide-msg'}>
                        <span>{m.who === 'boomi' ? boomiSay(m.text) : m.text}</span>
                        {m.who === 'boomi' && m.action?.route && <button type="button" className="guide-answer-action" onClick={() => openAnswer(m.action!)}>{t('chat.openPage')}<ArrowUpRight size={14} /></button>}
                      </div>
                    ))}
                    {busy && <div className="guide-msg" style={{ color: 'var(--muted)' }}>{boomiSay(t('chat.thinking'))}</div>}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((question) => (
                    <button key={question} type="button" className="chip text-xs" disabled={busy} onClick={() => void send(question)}>
                      {question}
                    </button>
                  ))}
                </div>
                <form
                  className="guide-chat-row"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void send()
                  }}
                >
                  <input
                    className="field"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t('guide.placeholder')}
                    aria-label={t('guide.inputLabel')}
                    maxLength={2000}
                    disabled={busy}
                  />
                  <button className="btn px-3 py-2 text-sm" type="submit" disabled={busy || !draft.trim()}>
                    {t('guide.send')}
                  </button>
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-ghost text-sm" onClick={startTour}>
                    {t('guide.takeTour')}
                  </button>
                  {msgs.length > 0 && <button className="btn btn-ghost text-sm" onClick={() => { cancelReply(); setMsgs([]) }}>{t('guide.clear')}</button>}
                </div>
              </>
            ) : (
              <>
                <div className="guide-welcome"><img src={boomi} alt="" /><p className="text-sm leading-6">{boomiSay(t('guide.firstHi', { name: 'Boomi' }))}</p></div>
                <div className="mt-3 flex gap-2">
                  <button className="btn text-sm" onClick={startTour}>
                    {t('guide.start')}
                  </button>
                  <button className="btn btn-ghost text-sm" onClick={meetBoom}>
                    {t('guide.later')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          ref={catButton}
          className={`guide-cat ${bubble && !open && !touring ? 'guide-cat-pulse' : ''}`}
          onClick={onCat}
          aria-label={t('guide.ariaBtn')}
          aria-expanded={open || touring || bubble}
        >
          <img src={boomi} alt="" />
          {!open && !touring && (
            <span className="guide-badge">{bubble ? t('guide.tap') : 'Boomi'}</span>
          )}
        </button>
      </div>
    </>
  )
}
