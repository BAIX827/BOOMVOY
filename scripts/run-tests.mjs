import { build } from 'esbuild'

// Exercise persistence in memory on Node versions without browser storage.
const testStorage = new Map()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key) => testStorage.get(key) ?? null, setItem: (key, value) => testStorage.set(key, String(value)), removeItem: (key) => testStorage.delete(key), clear: () => testStorage.clear() } })

for (const entry of ['tests/experience.test.ts', 'tests/travel-upgrades.test.ts', 'tests/journey.test.ts', 'tests/core.test.ts', 'tests/boomi.test.ts', 'tests/packing.test.ts', 'tests/recommendation.test.ts', 'tests/recommendation-application.test.ts', 'tests/decision.test.ts', 'tests/decision-selection.test.ts', 'tests/sync-client.test.ts', 'tests/provider-settings-client.test.ts']) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    write: false,
    logLevel: 'silent',
  })

  const source = result.outputFiles[0].text
  try {
    await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  } catch (error) {
    if (error instanceof Error && error.stack) error.stack = error.stack.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, entry)
    console.error(error instanceof Error ? error.stack : error)
    process.exit(1)
  }
}

await import('../tests/decision-provider.test.mjs')
await import('../tests/ai-quality.test.mjs')
await import('../tests/snapshot-store.test.mjs')
await import('../tests/backend-sync.test.mjs')
await import('../tests/provider-settings.test.mjs')

await import('../tests/collaboration.test.mjs')
