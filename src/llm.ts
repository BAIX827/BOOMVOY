export const DEFAULT_LLM_URL = 'https://api.openai.com/v1/chat/completions'
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini'

export function resolveLlm(profile: { llmUrl?: string; llmKey?: string; llmModel?: string }) {
  const envKey = import.meta.env.DEV ? import.meta.env.VITE_OPENAI_API_KEY || '' : ''
  const llmKey = profile.llmKey || envKey
  return {
    llmUrl: profile.llmUrl || import.meta.env.VITE_OPENAI_API_URL || DEFAULT_LLM_URL,
    llmKey,
    llmModel: profile.llmModel || import.meta.env.VITE_OPENAI_MODEL || DEFAULT_LLM_MODEL,
    fromEnv: Boolean(envKey) && !profile.llmKey,
    ready: Boolean(llmKey),
  }
}
