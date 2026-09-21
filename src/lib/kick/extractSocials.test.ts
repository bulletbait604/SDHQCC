import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSocialsFromText, extractUrls, isFetchableProfilePage } from './extractSocials'

test('extractUrls finds http links and strips trailing punctuation', () => {
  const urls = extractUrls('Bio: https://twitch.tv/demo, also https://x.com/demo!')
  assert.deepEqual(urls, ['https://twitch.tv/demo', 'https://x.com/demo'])
})

test('extractSocialsFromText maps hosts to networks and usernames', () => {
  const socials = extractSocialsFromText(
    'I stream on https://kick.com/bulletbait604 and post at https://www.instagram.com/hello.world/'
  )
  assert.equal(socials[0]?.network, 'Kick')
  assert.equal(socials[0]?.username, 'bulletbait604')
  assert.equal(socials[1]?.network, 'Instagram')
  assert.equal(socials[1]?.username, 'hello.world')
})

test('link-in-bio pages are fetchable; closed socials are not', () => {
  assert.equal(isFetchableProfilePage('https://linktr.ee/someone'), true)
  assert.equal(isFetchableProfilePage('https://instagram.com/someone'), false)
})
