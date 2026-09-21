import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHomeClipEditSuggestionsPrompt,
  normalizeHomeClipOverlays,
} from './clipAnalyzePrompt'
import { toolCoinCost } from './coins/toolCosts'

test('home clip analyze costs 3 coins', () => {
  assert.equal(toolCoinCost('home-clip-analyze'), 3)
  assert.equal(toolCoinCost('clip-analyzer'), 2)
})

test('buildHomeClipEditSuggestionsPrompt asks for clip-specific overlay details', () => {
  const prompt = buildHomeClipEditSuggestionsPrompt({
    platformLabel: 'TikTok',
    targetPlatform: 'tiktok',
  })
  assert.match(prompt, /Watch/)
  assert.match(prompt, /details/)
  assert.match(prompt, /proTips/)
  assert.doesNotMatch(prompt, /"score"/)
})

test('normalizeHomeClipOverlays keeps AI details and drops empty rows', () => {
  const overlays = normalizeHomeClipOverlays([
    {
      type: 'text',
      timing: '0:03-0:06',
      description: 'SAY GG',
      details: ['Put SAY GG over the clutch'],
      proTips: ['Keep it 3 letters'],
    },
    { type: '', timing: '0:01' },
    { type: 'sound', timing: '  0:00  ', details: ['', '  duck the mic  '] },
  ])
  assert.equal(overlays.length, 2)
  assert.equal(overlays[0]?.description, 'SAY GG')
  assert.deepEqual(overlays[0]?.details, ['Put SAY GG over the clutch'])
  assert.equal(overlays[1]?.type, 'sound')
  assert.deepEqual(overlays[1]?.details, ['duck the mic'])
})
