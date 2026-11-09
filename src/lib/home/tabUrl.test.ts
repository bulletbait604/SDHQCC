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

test('emote maker is a normal Create sub tab', () => {
  const parsed = parseHomeTabFromSearch('?tab=create&create=emotes')
  assert.equal(parsed.tab, 'create')
  assert.equal(parsed.create, 'emotes')
  assert.equal(buildTabQuery({ tab: 'create', create: 'emotes' }).get('create'), 'emotes')
})

test('banner sizer is a normal Create sub tab', () => {
  const parsed = parseHomeTabFromSearch('?tab=create&create=banners')
  assert.equal(parsed.tab, 'create')
  assert.equal(parsed.create, 'banners')
  assert.equal(buildTabQuery({ tab: 'create', create: 'banners' }).get('create'), 'banners')
})

test('legacy panels-banners links still open R&D', () => {
  const parsed = parseHomeTabFromSearch('?tab=panels-banners')
  assert.equal(parsed.tab, 'rnd')
  assert.equal(parsed.rnd, 'trending-vids')
  assert.equal(parsed.create, undefined)
})

test('explicit home and educate tabs stay as requested', () => {
  assert.equal(parseHomeTabFromSearch('?tab=home').tab, 'home')
  assert.equal(parseHomeTabFromSearch('?tab=educate').tab, 'educate')
  assert.equal(buildTabQuery({ tab: 'educate' }).get('tab'), 'educate')
})
