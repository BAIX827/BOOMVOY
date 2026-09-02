import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './store'

type Step = {
  title: string
  say: string
  route?: string
  selector?: string
}

const SEEN_KEY = 'boomvoy-met-boom'

function pageTip(pathname: string) {
  if (pathname === '/' || pathname.endsWith('/')) return '这是你的旅行首页。点一张卡片进入工作台，或右上角「创建旅行」。'
  if (pathname.includes('/explore')) return '发现页可以复制现成路线。喜欢就整趟拷进自己的旅行。'
  if (pathname.includes('/new')) return '创建只要四步：去哪、哪天、和谁、什么风格。填完会自动生成每一天。'
  if (pathname.includes('/profile')) return '这里改你的名字和本币。引导看烦了，也可以再叫我讲一遍。'
  if (pathname.includes('/plan')) return '空的一天可以让 Boom 生成建议行程，点「一键加入计划表」就贴进去。下雨切 Plan B。'
  if (pathname.includes('/map')) return '路线图按天分色。看有没有绕路、某一天会不会走太远。'
  if (pathname.includes('/saved')) return '机票、酒店、餐厅先收藏在这，别散落在十个 App 里。'
  if (pathname.includes('/compare')) return '收藏只是开始。这里帮你比较、投票、排除，避免反复纠结。'
  if (pathname.includes('/bookings')) return '登机牌上那个大按钮会打开已经填好航线的比价站。订完切回这个页，我会问你要不要记一笔。'
  if (pathname.includes('/budget')) return '每类费用分预估 / 已订 / 已付，看出还剩多少预算。'
  if (pathname.includes('/expenses')) return '谁付的记一笔，我会算 AA：谁该转给谁。'
  if (pathname.includes('/weather')) return '天气会检查当天户外多不多。雨大了会问你要不要换 Plan B。'
  if (pathname.includes('/group')) return '把同伴加进来，酒店可以一起投票。'
  if (pathname.includes('/notes')) return '旅行备注、Theme、分享范围都在这。'
  if (pathname.includes('/share')) return '这是分享页。复制链接就能把路线海报发给朋友。'
  if (pathname.includes('/trip/')) return '左边是一次旅行的全部工具。建议先看总览，再去排行程。'
  return '点下面「带我走一遍」，我带你认识 BOOMVOY。'
}

export default function GuideCat() {
  const loc = useLocation()
  const nav = useNavigate()
  const demoId = useApp((s) => s.trips.find((t) => !t.template)?.id)
  const [open, setOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  const [step, setStep] = useState(0)
  const [bubble, setBubble] = useState(false)
  const [hi, setHi] = useState<DOMRect | null>(null)

  const steps = useMemo<Step[]>(() => {
    const trip = demoId ? `/trip/${demoId}` : '/new'
    return [
      {
        title: '嗨，我是 Boom',
        say: '我是 BOOMVOY 的导游小猫。一次旅行里的地图、机票、天气和 AA，我带你找地方。',
        selector: '[data-guide="brand"]',
      },
      {
        title: '你的旅行都在这',
        say: '首页是旅行列表。有示例「Japan 2026」，点进去就能看到完整工作台。',
        route: '/',
        selector: '[data-guide="my-trips"]',
      },
      {
        title: '从零创建',
        say: '右上角「创建旅行」：去哪、哪几天、几个人、预算和 Theme。填完会自动生成每一天。',
        selector: '[data-guide="create-trip"]',
      },
      {
        title: '也可以抄作业',
        say: '发现页有现成路线。大洋路、Bali 都可以整趟复制，再改成自己的。',
        route: '/explore',
        selector: '[data-guide="nav-explore"]',
      },
      {
        title: '一次旅行，一个工作台',
        say: '进旅行后，左边就是全部工具：行程、路线、收藏、预算……不用再开十个 App。',
        route: trip,
        selector: '[data-guide="trip-nav"]',
      },
      {
        title: '最核心：按天排',
        say: '行程页按 Day 排。空的一天 Boom 会给建议，一键就能加进计划表。拖动改顺序，下雨切 Plan B。',
        route: demoId ? `${trip}/plan` : '/new',
        selector: '[data-guide="nav-plan"]',
      },
      {
        title: '看路线有没有绕',
        say: '路线图按天分色连起来。规划完一眼能看出某一天会不会走太远。',
        route: demoId ? `${trip}/map` : '/new',
        selector: '[data-guide="nav-map"]',
      },
      {
        title: '收藏以后要做决定',
        say: '决策板拿来比较酒店和机票。排除的也留下原因，以后不会再纠结同一家。',
        route: demoId ? `${trip}/compare` : '/new',
        selector: '[data-guide="nav-compare"]',
      },
      {
        title: '下雨也有 Plan B',
        say: '天气不只是显示 22°C。户外太多又要下雨时，我会提醒你切换雨天方案。',
        route: demoId ? `${trip}/weather` : '/new',
        selector: '[data-guide="nav-weather"]',
      },
      {
        title: '你随时可以叫我',
        say: '右下角这只猫就是我。迷路了再点一下，我会讲这一页怎么用，也可以重新带你走一遍。',
        route: '/',
      },
    ]
  }, [demoId])

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      const t = window.setTimeout(() => setBubble(true), 700)
      return () => window.clearTimeout(t)
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
    const t = window.setTimeout(measure, 380)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(t)
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
          <div className="guide-card paper" role="dialog" aria-label="导游小猫 Boom">
            {touring && current ? (
              <>
                <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                  新手引导 {step + 1} / {steps.length}
                </div>
                <div className="display mt-1 text-xl">{current.title}</div>
                <p className="mt-2 text-sm leading-6">{current.say}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={step === 0} onClick={() => goStep(step - 1)}>
                    上一步
                  </button>
                  {step < steps.length - 1 ? (
                    <button className="btn px-3 py-1.5 text-sm" onClick={() => goStep(step + 1)}>
                      下一步
                    </button>
                  ) : (
                    <button className="btn btn-accent px-3 py-1.5 text-sm" onClick={finish}>
                      我知道啦
                    </button>
                  )}
                  <button className="text-xs" style={{ color: 'var(--muted)' }} onClick={finish}>
                    跳过
                  </button>
                </div>
              </>
            ) : open ? (
              <>
                <div className="display text-xl">Boom 在这</div>
                <p className="mt-2 text-sm leading-6">{pageTip(loc.pathname)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn text-sm" onClick={startTour}>
                    带我走一遍
                  </button>
                  <button className="btn btn-ghost text-sm" onClick={() => setOpen(false)}>
                    先自己逛
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm leading-6">
                  嗨，我是导游猫 <strong>Boom</strong>。第一次来的话，点我，我带你认识 BOOMVOY～
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="btn text-sm" onClick={startTour}>
                    开始引导
                  </button>
                  <button className="btn btn-ghost text-sm" onClick={meetBoom}>
                    先看看
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          className={`guide-cat ${bubble && !open && !touring ? 'guide-cat-pulse' : ''}`}
          onClick={onCat}
          aria-label="导游小猫 Boom，点击查看新手引导"
        >
          <CatFace talking={open || touring || bubble} />
          {!open && !touring && (
            <span className="guide-badge">{bubble ? '点我' : 'Boom'}</span>
          )}
        </button>
      </div>
    </>
  )
}

function CatFace({ talking }: { talking: boolean }) {
  return (
    <svg viewBox="0 0 88 96" width="76" height="84" aria-hidden>
      <ellipse cx="44" cy="88" rx="22" ry="5" fill="color-mix(in srgb, var(--ink) 12%, transparent)" />
      <path d="M18 38 L10 12 Q22 16 30 32" fill="#f3d2b5" />
      <path d="M70 38 L78 12 Q66 16 58 32" fill="#f3d2b5" />
      <path d="M18 38 L14 18 Q22 20 28 34" fill="#f4b8c5" />
      <path d="M70 38 L74 18 Q66 20 60 34" fill="#f4b8c5" />
      <ellipse cx="44" cy="52" rx="30" ry="28" fill="#f7dcc4" />
      <ellipse cx="44" cy="58" rx="22" ry="18" fill="#fbe8d6" />
      <circle cx="33" cy="50" r="5.2" fill="#2b241d" />
      <circle cx="55" cy="50" r="5.2" fill="#2b241d" />
      <circle cx="34.6" cy="48.4" r="1.6" fill="white" />
      <circle cx="56.6" cy="48.4" r="1.6" fill="white" />
      <path d="M44 56 l-3 3 a4 4 0 0 0 6 0 z" fill="#e89aa8" />
      {talking ? (
        <ellipse cx="44" cy="66" rx="5" ry="3.2" fill="#2b241d" />
      ) : (
        <path d="M39 65 Q44 69 49 65" fill="none" stroke="#2b241d" strokeWidth="1.7" strokeLinecap="round" />
      )}
      <path d="M44 59 v4" stroke="#e89aa8" strokeWidth="1.2" />
      <path d="M18 56 Q8 54 4 50" fill="none" stroke="#d7b49a" strokeWidth="1.4" />
      <path d="M18 60 Q6 60 3 57" fill="none" stroke="#d7b49a" strokeWidth="1.4" />
      <path d="M70 56 Q80 54 84 50" fill="none" stroke="#d7b49a" strokeWidth="1.4" />
      <path d="M70 60 Q82 60 85 57" fill="none" stroke="#d7b49a" strokeWidth="1.4" />
      <circle cx="44" cy="28" r="9" fill="#d989a0" />
      <path d="M44 20 v-10" stroke="#d989a0" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="44" cy="8" r="3.2" fill="#e8c36a" />
    </svg>
  )
}
