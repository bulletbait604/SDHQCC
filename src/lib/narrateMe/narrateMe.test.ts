import test from 'node:test'
import assert from 'node:assert/strict'
import { analysisWindows, formatClock, formatSrtTime, hashNarrationText } from '@/lib/narrateMe/config'
import { alignmentFromElevenLabs, cuesFromVoiceSegments, cuesToSrt, cuesToVtt } from '@/lib/narrateMe/captions'
import { capcutZipFiles, pcmToWav, zipStore } from '@/lib/narrateMe/assemble'
import { parseTimelineEvents, mergeTimelineEvents } from '@/lib/narrateMe/gemini'
import { isSafeR2ObjectKey } from '@/lib/r2KeyValidation'
import { sourceVideoKey } from '@/lib/narrateMe/keys'
import type { VoiceSegment } from '@/lib/narrateMe/types'

test('analysis windows cover a 2 hour video without random sampling', () => {
  const windows = analysisWindows(7200)
  assert.ok(windows.length >= 14)
  assert.equal(windows[0]?.startTime, 0)
  assert.equal(windows[windows.length - 1]?.endTime, 7200)
  for (let i = 1; i < windows.length; i++) {
    assert.ok(windows[i]!.startTime < windows[i - 1]!.endTime)
  }
})

test('formatClock and SRT timestamps stay on the source timeline', () => {
  assert.equal(formatClock(421.2), '7:01')
  assert.equal(formatSrtTime(421.2), '00:07:01,200')
})

test('unchanged narration text keeps the same cache hash', () => {
  assert.equal(hashNarrationText('Hello  world'), hashNarrationText('Hello world'))
  assert.notEqual(hashNarrationText('Hello world'), hashNarrationText('Hello world.'))
})

test('captions use ElevenLabs alignment, not estimated speaking speed', () => {
  const alignment = alignmentFromElevenLabs({
    characters: ['H', 'i', ' ', 't', 'h', 'e', 'r', 'e'],
    character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
    character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  })
  assert.equal(alignment.words[0]?.word, 'Hi')
  assert.equal(alignment.words[1]?.word, 'there')
  const segment: VoiceSegment = {
    id: 'a',
    sourceStart: 421.2,
    sourceEnd: 430,
    text: 'Hi there',
    textHash: 'x',
    elevenLabsRequestId: 'req',
    audioKey: 'k',
    duration: 0.8,
    sampleRate: 44100,
    alignment,
  }
  const cues = cuesFromVoiceSegments([segment])
  assert.ok(cues.length >= 1)
  assert.ok(Math.abs(cues[0]!.start - 421.2) < 0.05)
  const srt = cuesToSrt(cues)
  assert.match(srt, /00:07:01,/)
  assert.match(cuesToVtt(cues), /^WEBVTT/)
})

test('WAV header is PCM16 and zip never includes the original video', () => {
  const pcm = Buffer.alloc(44100 * 2)
  const wav = pcmToWav(pcm)
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
  const zip = zipStore(
    capcutZipFiles({
      wav,
      srt: '1\n00:00:00,000 --> 00:00:01,000\nHi\n',
      vtt: 'WEBVTT\n',
      readme: 'readme',
    })
  )
  const names = zip.toString('utf8')
  assert.match(names, /NARRATION_FULL\.wav/)
  assert.match(names, /CAPTIONS\.srt/)
  assert.doesNotMatch(names, /original-video/)
  assert.doesNotMatch(names, /source\//)
})

test('timeline parser drops invented times outside the analyzed window', () => {
  const events = parseTimelineEvents(
    {
      events: [
        {
          startTime: 10,
          endTime: 12,
          event: 'Opens lab',
          evidence: ['UI visible'],
          confidence: 0.9,
        },
        {
          startTime: 900,
          endTime: 910,
          event: 'Invented far away',
          confidence: 0.99,
        },
        {
          startTime: 11,
          endTime: 12,
          event: 'Guess',
          confidence: 0.2,
        },
      ],
    },
    0,
    0,
    20
  )
  assert.equal(events.length, 1)
  assert.equal(events[0]?.event, 'Opens lab')
  const merged = mergeTimelineEvents(events, events)
  assert.equal(merged.length, 1)
})

test('narrate-me R2 keys are accepted by the shared validator', () => {
  const key = sourceVideoKey('Bulletbait604', 'job-1', 'clip.mp4', 'video/mp4')
  assert.equal(isSafeR2ObjectKey(key), true)
  assert.match(key, /^narrate-me\//)
  assert.doesNotMatch(key, /\.\./)
})
