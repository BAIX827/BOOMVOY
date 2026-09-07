import { build } from 'esbuild'

for (const entry of ['tests/core.test.ts', 'tests/packing.test.ts', 'tests/recommendation.test.ts', 'tests/recommendation-application.test.ts', 'tests/decision.test.ts', 'tests/decision-selection.test.ts']) {
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
