// No credentials here: a successful settings change starts a fresh cache namespace.
// Late responses from an older configuration cannot populate the new namespace.
let revision = 0

export function providerConfigurationRevision(): number { return revision }
export function advanceProviderConfiguration(): void { revision += 1 }
