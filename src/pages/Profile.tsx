import { useApp } from '../store'
import { THEMES } from '../catalog'
import { Label, LangSwitch } from '../ui'
import type { ThemeId } from '../types'
import { resolveLlm } from '../llm'
import { themeLabel, useT } from '../i18n'
import type { Profile as ProfileData, Trip } from '../types'

export default function Profile() {
  const profile = useApp((s) => s.profile)
  const trips = useApp((s) => s.trips)
  const setProfile = useApp((s) => s.setProfile)
  const resetDemo = useApp((s) => s.resetDemo)
  const llm = resolveLlm(profile)
  const { t } = useT()

  function exportData() {
    const safeProfile = { ...profile, llmKey: undefined }
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), profile: safeProfile, trips }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `boomvoy-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { profile?: Partial<ProfileData>; trips?: Trip[] }
      if (!Array.isArray(data.trips)) throw new Error('invalid')
      useApp.setState({ trips: data.trips, profile: { ...profile, ...(data.profile || {}), llmKey: profile.llmKey } })
      window.alert(t('profile.importDone', { n: data.trips.length }))
    } catch {
      window.alert(t('profile.importFail'))
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display mb-6 text-4xl">{t('profile.title')}</h1>
      <div className="paper mb-6 space-y-4 p-6">
        <div>
          <Label>{t('profile.language')}</Label>
          <LangSwitch />
        </div>
      </div>
      <div className="paper space-y-4 p-6">
        <div>
          <Label>{t('profile.name')}</Label>
          <input className="field" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
        </div>
        <div>
          <Label>{t('profile.origin')}</Label>
          <input className="field" value={profile.homeCity} onChange={(e) => setProfile({ homeCity: e.target.value })} />
        </div>
        <div>
          <Label>{t('profile.currency')}</Label>
          <select className="field" value={profile.homeCurrency} onChange={(e) => setProfile({ homeCurrency: e.target.value })}>
            {['AUD', 'CNY', 'USD', 'JPY', 'EUR'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>{t('profile.theme')}</Label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              className={profile.themePref === 'auto' ? 'btn' : 'btn btn-ghost'}
              onClick={() => setProfile({ themePref: 'auto' })}
            >
              {t('profile.followTrip')}
            </button>
            {(Object.keys(THEMES) as ThemeId[]).map((id) => (
              <button
                key={id}
                className={`paper theme-preview theme-${id} p-3 text-left`}
                style={{ outline: profile.themePref === id ? '2px solid var(--ink)' : undefined }}
                onClick={() => setProfile({ themePref: id })}
              >
                <div className="mb-2 flex gap-1">
                  {THEMES[id].swatches.map((c) => (
                    <span key={c} className="h-5 flex-1 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <div className="font-medium">{themeLabel(t, id)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="paper mt-6 space-y-4 p-6">
        <h2 className="display text-2xl">{t('profile.api')}</h2>
        <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
          {llm.fromEnv ? t('profile.apiEnv') : t('profile.apiHint')}
        </p>
        <div>
          <Label>{t('profile.apiUrl')}</Label>
          <input
            className="field"
            placeholder={llm.llmUrl}
            value={profile.llmUrl || ''}
            onChange={(e) => setProfile({ llmUrl: e.target.value })}
          />
        </div>
        <div>
          <Label>{t('profile.apiKey')}</Label>
          <input
            className="field"
            type="password"
            autoComplete="off"
            placeholder={llm.fromEnv ? t('profile.apiKeyEnv') : t('profile.apiKeyPh')}
            value={profile.llmKey || ''}
            onChange={(e) => setProfile({ llmKey: e.target.value })}
          />
        </div>
        <div>
          <Label>{t('profile.model')}</Label>
          <input
            className="field"
            placeholder={llm.llmModel}
            value={profile.llmModel || ''}
            onChange={(e) => setProfile({ llmModel: e.target.value })}
          />
        </div>
      </div>
      <div className="paper mt-6 space-y-3 p-6">
        <h2 className="display text-2xl">{t('profile.data')}</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('profile.dataHint')}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={exportData}>{t('profile.export')}</button>
          <label className="btn btn-ghost cursor-pointer">
            {t('profile.import')}
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importData(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-ghost" onClick={() => { if (window.confirm(t('profile.resetConfirm'))) resetDemo() }}>
          {t('profile.resetDemo')}
        </button>
        <button className="btn" onClick={() => window.dispatchEvent(new Event('boomvoy-start-guide'))}>
          {t('profile.replayGuide')}
        </button>
      </div>
    </div>
  )
}
