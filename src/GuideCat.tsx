import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './store'
import boomiFace from './assets/boomi-face.jpg'
import boomi from './assets/boomi.jpg'
import { useT, type TFn } from './i18n'

type Step = {
  title: string
  say: string
  route?: string
  selector?: string
}

const SEEN_KEY = 'boomvoy-met-boom'

function pageTip(pathname: string, t: TFn) {
  if (pathname === '/' || pathname.endsWith('/')) return t('guide.tip.home')
  if (pathname.includes('/explore')) return t('guide.tip.explore')
  if (pathname.includes('/new')) return t('guide.tip.new')
  if (pathname.includes('/profile')) return t('guide.tip.profile')
  if (pathname.includes('/plan')) return t('guide.tip.plan')
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

export default function GuideCat() {
  const loc = useLocation()
  const nav = useNavigate()
  const { t } = useT()
  const demoId = useApp((s) => s.trips.find((tr) => !tr.template)?.id)
  const [open, setOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  const [step, setStep] = useState(0)
  const [bubble, setBubble] = useState(false)
  const [hi, setHi] = useState<DOMRect | null>(null)

  const steps = useMemo<Step[]>(() => {
    const trip = demoId ? `/trip/${demoId}` : '/new'
    return [
      { title: t('guide.step1t'), say: t('guide.step1s'), selector: '[data-guide="brand"]' },
      { title: t('guide.step2t'), say: t('guide.step2s'), route: '/', selector: '[data-guide="my-trips"]' },
      { title: t('guide.step3t'), say: t('guide.step3s'), selector: '[data-guide="create-trip"]' },
      { title: t('guide.step4t'), say: t('guide.step4s'), route: '/explore', selector: '[data-guide="nav-explore"]' },
      { title: t('guide.step5t'), say: t('guide.step5s'), route: trip, selector: '[data-guide="trip-nav"]' },
      { title: t('guide.step6t'), say: t('guide.step6s'), route: demoId ? `${trip}/plan` : '/new', selector: '[data-guide="nav-plan"]' },
      { title: t('guide.step7t'), say: t('guide.step7s'), route: demoId ? `${trip}/map` : '/new', selector: '[data-guide="nav-map"]' },
      { title: t('guide.step8t'), say: t('guide.step8s'), route: demoId ? `${trip}/compare` : '/new', selector: '[data-guide="nav-compare"]' },
      { title: t('guide.step9t'), say: t('guide.step9s'), route: demoId ? `${trip}/weather` : '/new', selector: '[data-guide="nav-weather"]' },
      { title: t('guide.step10t'), say: t('guide.step10s'), route: '/' },
    ]
  }, [demoId, t])

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      const timer = window.setTimeout(() => setBubble(true), 700)
      return () => window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const replay = () => {
      localStorage.setItem(SEEN_KEY, '1')
      setBubble(false)
      setOpen(false)
      setTouring(true)
      setStep(0)
    }
    window.addEventListener('boomvoy-start-guide', replay)
    return () => window.removeEventListener('boomvoy-start-guide', replay)
  }, [])

  const current = steps[step]

  function measure() {
    if (!touring || !current?.selector) {
      setHi(null)
      return
    }
    const el = [...document.querySelectorAll(current.selector)].find((node) => {
      const r = node.getBoundingClientRect()
      return r.width > 2 && r.height > 2
    })
    if (!el) {
      setHi(null)
      return
    }
    const r = el.getBoundingClientRect()
    setHi(new DOMRect(r.x - 8, r.y - 8, r.width + 16, r.height + 16))
  }

  useLayoutEffect(() => {
    measure()
    const timer = window.setTimeout(measure, 380)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [touring, step, loc.pathname, current?.selector])

  function meetBoom() {
    localStorage.setItem(SEEN_KEY, '1')
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
    setOpen(false)
    setTouring(true)
    setStep(0)
    const first = steps[0]
    if (first.route) nav(first.route)
  }

  function finish() {
    setTouring(false)
    setHi(null)
    setOpen(false)
    meetBoom()
  }

  function onCat() {
    if (touring) return
    meetBoom()
    setOpen((v) => !v)
  }

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

      <div className="guide-dock">
        {(bubble || open || touring) && (
          <div className="guide-card paper" role="dialog" aria-label={t('guide.aria')}>
            {touring && current ? (
              <>
                <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                  {t('guide.progress', { n: step + 1, total: steps.length })}
                </div>
                <div className="display mt-1 text-xl">{current.title}</div>
                <p className="mt-2 text-sm leading-6">{current.say}</p>
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
                <p className="mt-2 text-sm leading-6">{pageTip(loc.pathname, t)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn text-sm" onClick={startTour}>
                    {t('guide.takeTour')}
                  </button>
                  <button className="btn btn-ghost text-sm" onClick={() => setOpen(false)}>
                    {t('guide.browse')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <img src={boomi} alt="" className="guide-hero" />
                <p className="text-sm leading-6">
                  {t('guide.firstHi', { name: 'Boomi' }).split('Boomi').map((part, i, arr) =>
                    i < arr.length - 1 ? (
                      <span key={i}>
                        {part}
                        <strong>Boomi</strong>
                      </span>
                    ) : (
                      <span key={i}>{part}</span>
                    ),
                  )}
                </p>
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
          className={`guide-cat ${bubble && !open && !touring ? 'guide-cat-pulse' : ''}`}
          onClick={onCat}
          aria-label={t('guide.ariaBtn')}
        >
          <img src={boomiFace} alt="" />
          {!open && !touring && (
            <span className="guide-badge">{bubble ? t('guide.tap') : 'Boomi'}</span>
          )}
        </button>
      </div>
    </>
  )
}
