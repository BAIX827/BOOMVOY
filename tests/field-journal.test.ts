import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { ILLUSTRATION_DESTINATIONS } from '../src/illustrationDestinations'
import { LANDMARK_ILLUSTRATIONS } from '../src/illustrationLandmarks'
import { CITY_ILLUSTRATIONS, destinationIllustration, themeLandscape } from '../src/illustrationCatalog'
import { TRIP_NAVIGATION, tripNavigationGroup } from '../src/tripNavigation'
import { t } from '../src/i18n'

// Global scripts and aliases must share artwork without guessing at unknown places.
for (const city of CITY_ILLUSTRATIONS) {
  for (const alias of city.aliases) assert.equal(destinationIllustration(` ${alias} `), `cities/${city.id}-v1`)
}
for (const landmark of LANDMARK_ILLUSTRATIONS) {
  for (const alias of landmark.aliases) assert.equal(destinationIllustration(` ${alias} `), `landmarks/${landmark.id}-v1`)
}
assert.equal(destinationIllustration('Ｐａｒｉｓ'), 'cities/paris-v1')
assert.equal(destinationIllustration('RIO DE JANEIRO'), 'cities/rio-v1')
assert.equal(destinationIllustration('İSTANBUL'), 'cities/istanbul-v1')
assert.equal(destinationIllustration('Ciudad de México'), 'cities/mexico-city-v1')
for (const unknown of ['Paris, Texas', 'London, Ontario', 'Vancouver, Washington', 'Mexico', '東京駅', 'York', 'São Tomé and Príncipe', 'San Cristóbal de las Casas', '北京路', 'Manchester', 'Victoria', '金字塔', 'Liberty', '']) {
  assert.equal(destinationIllustration(unknown), 'generic/city-v1', `Do not invent landmarks for ${unknown}`)
}
for (const ambiguous of ['Washington', '圣地亚哥']) assert.equal(destinationIllustration(ambiguous), 'generic/city-v1')
for (const landscape of ['city', 'coast', 'mountain', 'countryside'] as const) assert.equal(destinationIllustration('Unlisted destination', landscape), `generic/${landscape}-v1`)
assert.equal(themeLandscape('cream'), 'city')
assert.equal(themeLandscape('ocean'), 'coast')
assert.equal(themeLandscape('forest'), 'mountain')

// The browsable destination list, alias routing and actual bundled bytes must agree.
assert.deepEqual(ILLUSTRATION_DESTINATIONS.map((city) => city.id).sort(), [...CITY_ILLUSTRATIONS, ...LANDMARK_ILLUSTRATIONS].map((city) => city.id).sort())
for (const city of ILLUSTRATION_DESTINATIONS) assert.equal(destinationIllustration(city.city), `${city.kind}/${city.id}-v1`)
const inventory = JSON.parse(readFileSync('docs/illustration-assets.json', 'utf8'))
for (const asset of inventory.assets) {
  for (const kind of ['web', 'web480']) {
    const record = asset[kind]
    const bytes = readFileSync(record.path)
    assert.equal(bytes.byteLength, record.bytes, `${record.path} byte size`)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, `${record.path} checksum`)
  }
}

// Consolidating primary navigation must leave every old route reachable once.
const legacy = ['plan', 'map', 'saved', 'compare', 'bookings', 'budget', 'expenses', 'weather', 'group', 'notes', 'journal', 'pack']
const mapped = TRIP_NAVIGATION.flatMap((group) => [...group.items])
assert.deepEqual([...mapped].sort(), [...legacy].sort())
assert.equal(new Set(mapped).size, mapped.length)
assert.equal(TRIP_NAVIGATION.length, 4)
assert.equal(tripNavigationGroup('pack').key, 'notebook')
assert.equal(tripNavigationGroup('bookings').key, 'notebook')
assert.equal(tripNavigationGroup('notes').key, 'more')
assert.equal(tripNavigationGroup('expenses').key, 'more')
assert.equal(tripNavigationGroup('map').key, 'plan')
for (const locale of ['zh', 'en'] as const) {
  for (const key of ['title', 'checklist', 'tickets', 'notes', 'noTickets', 'noNotes', 'noStops', 'viewRoute']) assert.notEqual(t(locale, `notebook.${key}`), `notebook.${key}`)
}
console.log('Global illustration aliases, safe fallbacks, four-tab legacy navigation and notebook translations passed')
