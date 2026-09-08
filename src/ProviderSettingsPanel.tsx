import { useEffect, useId, useRef, useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import { useT } from './i18n'
import type { BackendConfig } from './llm'
import { loadProviderSettings, providerSettingsEndpoint, ProviderSettingsError, saveProviderSettings, type ProviderName, type ProviderSettings as Settings, type ProviderSettingsErrorCode } from './providerSettings'

const EMPTY_DRAFTS = { openai: '', google: '' }

export function ProviderSettingsPanel({ backend }: { backend: BackendConfig }) {
  const { t } = useT()
  const id = useId()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS)
  const [visible, setVisible] = useState({ openai: false, google: false })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<ProviderName | null>(null)
  const [error, setError] = useState<ProviderSettingsErrorCode | null>(null)
  const [notice, setNotice] = useState<'saved' | 'removed' | null>(null)
  const request = useRef<AbortController | null>(null)
  const pending = useRef(false)
  let local = false
  try { providerSettingsEndpoint(backend); local = true } catch { /* Remote pages and backends cannot receive secrets. */ }

  function beginRequest() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    pending.current = true
    return controller
  }

  async function load() {
    const controller = beginRequest()
    setLoading(true); setError(null); setNotice(null); setSettings(null)
    try {
      const next = await loadProviderSettings(backend, controller.signal)
      if (!controller.signal.aborted) setSettings(next)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof ProviderSettingsError ? cause.code : 'unavailable')
    } finally {
      if (request.current === controller) { request.current = null; pending.current = false }
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    return () => { request.current?.abort(); request.current = null; pending.current = false }
  }, [])

  async function save(provider: ProviderName, remove = false) {
    if (pending.current || !settings || !local || (!remove && !drafts[provider].trim())) return
    const controller = beginRequest()
    setBusy(provider); setError(null); setNotice(null)
    const key = provider === 'openai' ? 'openaiApiKey' : 'googleApiKey'
    try {
      const next = await saveProviderSettings(backend, settings.csrfToken, { [key]: remove ? null : drafts[provider] }, controller.signal)
      if (controller.signal.aborted) return
      setSettings(next)
      setDrafts((current) => ({ ...current, [provider]: '' }))
      setVisible((current) => ({ ...current, [provider]: false }))
      setNotice(remove ? 'removed' : 'saved')
    } catch (cause) {
      if (controller.signal.aborted) return
      const code = cause instanceof ProviderSettingsError ? cause.code : 'failed'
      setError(code)
      if (code === 'forbidden' || code === 'refresh' || code === 'invalidResponse') setSettings(null)
    } finally {
      if (request.current === controller) { request.current = null; pending.current = false }
      if (!controller.signal.aborted) setBusy(null)
    }
  }

  const blocked = !settings || !local || loading || busy !== null
  return (
    <section className="space-y-4" aria-labelledby={`${id}-title`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><KeyRound size={20} aria-hidden="true" /></span>
        <div>
          <h2 id={`${id}-title`} className="display text-2xl">{t('providers.title')}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{t('providers.intro')}</p>
        </div>
      </div>
      {(['openai', 'google'] as const).map((provider) => {
        const status = settings?.[provider]
        const label = provider === 'openai' ? 'OpenAI API Key' : 'Google Places API Key'
        const descriptionId = `${id}-${provider}-description`
        return (
          <form key={provider} className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }} onSubmit={(event) => { event.preventDefault(); void save(provider) }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={`${id}-${provider}`} className="font-semibold">{label}</label>
              <span className="flex items-center gap-1 text-xs" style={{ color: status?.configured ? 'var(--accent)' : 'var(--muted)' }}>
                {status?.configured && <Check size={14} aria-hidden="true" />}
                {loading ? t('providers.loading') : status ? t(status.configured ? 'providers.configured' : 'providers.notConfigured') : t('providers.unknown')}
              </span>
            </div>
            <p id={descriptionId} className="text-sm leading-6" style={{ color: 'var(--muted)' }}>{t(`providers.${provider}Hint`)}</p>
            {provider === 'google' && <a className="inline-block text-xs underline underline-offset-4" href="https://developers.google.com/maps/documentation/places/web-service/get-api-key" target="_blank" rel="noreferrer">{t('providers.googleSetup')}</a>}
            <div className="relative">
              <input
                id={`${id}-${provider}`}
                type={visible[provider] ? 'text' : 'password'}
                className="field pr-12"
                value={drafts[provider]}
                disabled={!local || loading || busy !== null}
                maxLength={512}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={descriptionId}
                placeholder={t(status?.configured ? 'providers.replacePlaceholder' : 'providers.placeholder')}
                onChange={(event) => { setDrafts((current) => ({ ...current, [provider]: event.target.value })); setNotice(null) }}
              />
              <button
                type="button"
                className="absolute right-0 top-0 grid h-full min-h-11 w-11 place-items-center rounded-xl disabled:opacity-40"
                aria-label={t(visible[provider] ? 'providers.hide' : 'providers.show', { provider: label })}
                aria-pressed={visible[provider]}
                disabled={!drafts[provider] || !local || busy !== null}
                onClick={() => setVisible((current) => ({ ...current, [provider]: !current[provider] }))}
              >{visible[provider] ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn" disabled={blocked || !drafts[provider].trim()}>
                {busy === provider && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                {t(busy === provider ? 'providers.saving' : 'providers.save')}
              </button>
              {status?.source === 'saved' && <button type="button" className="btn btn-ghost" disabled={blocked} onClick={() => void save(provider, true)}><Trash2 size={15} aria-hidden="true" />{t('providers.remove')}</button>}
              {status?.source === 'environment' && <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('providers.environment')}</span>}
            </div>
          </form>
        )
      })}
      <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>{t('providers.privacy')}</p>
      {notice && <p role="status" className="text-sm">{t(`providers.${notice}`)}</p>}
      {error && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
          <p role="alert" className="text-sm leading-6">{t(`providers.error.${error}`)}</p>
          {local && <button type="button" className="btn btn-ghost" disabled={loading || busy !== null} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" />{t('providers.retry')}</button>}
        </div>
      )}
    </section>
  )
}
