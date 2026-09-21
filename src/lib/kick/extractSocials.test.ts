import test from 'node:test'
import assert from 'node:assert/strict'
import { extractSocialsFromText, extractUrls, isFetchableProfilePage, extractSocialsFromKickUser, extractSocialsFromKickLinks, mergeSocials } from './extractSocials'

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

test('extractSocialsFromKickUser maps Kick username fields to profile URLs', () => {
  const socials = extractSocialsFromKickUser({
    instagram: 'bulletbait604',
    twitter: 'bulletbait604',
    youtube: '@bulletbait604',
    discord: '2Xdk3mT4y8',
    tiktok: 'thebulletbait',
    facebook: null,
  })
  assert.equal(socials.length, 5)
  assert.equal(socials[0]?.network, 'Instagram')
  assert.equal(socials[0]?.username, 'bulletbait604')
  assert.equal(socials[0]?.url, 'https://instagram.com/bulletbait604')
  assert.equal(socials[2]?.url, 'https://youtube.com/@bulletbait604')
  assert.equal(socials[3]?.url, 'https://discord.gg/2Xdk3mT4y8')
})

test('mergeSocials keeps Kick handles ahead of extra panel links', () => {
  const merged = mergeSocials(
    extractSocialsFromKickUser({ instagram: 'demo' }),
    extractSocialsFromKickLinks([{ link: 'https://throne.com/demo' }])
  )
  assert.equal(merged[0]?.network, 'Instagram')
  assert.equal(merged[1]?.network, 'Throne')
})
