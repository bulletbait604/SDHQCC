import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_HOME_TAB, parseHomeTabFromSearch, buildTabQuery } from './tabUrl'

test('default home tab is home and omitted from the URL', () => {
  assert.equal(DEFAULT_HOME_TAB, 'home')
  const parsed = parseHomeTabFromSearch('')
  assert.equal(parsed.tab, 'home')
  assert.equal(buildTabQuery({ tab: 'home' }).toString(), '')
})

test('legacy resource-hub links still open Educate', () => {
  assert.equal(parseHomeTabFromSearch('?tab=resource-hub').tab, 'educate')
})

test('explicit home and educate tabs stay as requested', () => {
  assert.equal(parseHomeTabFromSearch('?tab=home').tab, 'home')
  assert.equal(parseHomeTabFromSearch('?tab=educate').tab, 'educate')
  assert.equal(buildTabQuery({ tab: 'educate' }).get('tab'), 'educate')
})
