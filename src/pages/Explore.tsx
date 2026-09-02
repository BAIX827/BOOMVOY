import { useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { CoverArt } from '../ui'
import { formatRange } from '../lib'
import { THEMES } from '../catalog'
import { themeLabel, useT } from '../i18n'

export default function Explore() {
  const templates = useApp((s) => s.trips).filter((tr) => tr.template)
  const cloneTrip = useApp((s) => s.cloneTrip)
  const nav = useNavigate()
  const { t, locale } = useT()

  return (
    <div>
      <p className="hand text-2xl" style={{ color: 'var(--muted)' }}>
        {t('explore.kicker')}
      </p>
      <h1 className="display mt-1 mb-8 text-4xl">{t('explore.title')}</h1>
      <div className="grid gap-8 lg:grid-cols-2">
        {templates.map((tr) => (
          <article key={tr.id} className="scrap">
            <CoverArt kind={tr.cover} title={tr.name} polaroid />
            <div className="px-2 pt-4">
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {formatRange(tr.startDate, tr.endDate, locale)} · {tr.origin} → {tr.destinations.join(' → ')}
              </div>
              <p className="mt-3 text-sm leading-6">{tr.notes}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip">
                  {themeLabel(t, tr.theme)} {THEMES[tr.theme].name}
                </span>
                <span className="chip">{t('explore.days', { n: tr.days.length })}</span>
                <span className="chip">{t('explore.copyable')}</span>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    const id = cloneTrip(tr.id)
                    nav(`/trip/${id}`)
                  }}
                >
                  {t('explore.copy')}
                </button>
                <button className="btn btn-ghost" onClick={() => nav(`/share/${tr.id}`)}>
                  {t('explore.peek')}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
