import { build } from 'esbuild'

for (const entry of ['tests/core.test.ts', 'tests/boomi.test.ts', 'tests/packing.test.ts', 'tests/recommendation.test.ts', 'tests/recommendation-application.test.ts', 'tests/decision.test.ts', 'tests/decision-selection.test.ts', 'tests/sync-client.test.ts', 'tests/provider-settings-client.test.ts']) {
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
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

await import('../tests/decision-provider.test.mjs')
await import('../tests/ai-quality.test.mjs')
await import('../tests/snapshot-store.test.mjs')
await import('../tests/backend-sync.test.mjs')
await import('../tests/provider-settings.test.mjs')
