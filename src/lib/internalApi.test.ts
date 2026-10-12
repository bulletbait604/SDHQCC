import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidCronRequest } from './internalApi'

const req = (h: Record<string, string>) => ({ headers: new Headers(h) })

test('x-vercel-cron header alone is NOT trusted', () => {
  process.env.CRON_SECRET = 's3cret'
  assert.equal(isValidCronRequest(req({ 'x-vercel-cron': '1' })), false)
})

test('Bearer CRON_SECRET is accepted, wrong secret rejected', () => {
  process.env.CRON_SECRET = 's3cret'
  assert.equal(isValidCronRequest(req({ authorization: 'Bearer s3cret' })), true)
  assert.equal(isValidCronRequest(req({ authorization: 'Bearer nope' })), false)
  assert.equal(isValidCronRequest(req({ authorization: 's3cret' })), false)
})

test('fails closed when CRON_SECRET is unset', () => {
  delete process.env.CRON_SECRET
  assert.equal(isValidCronRequest(req({ authorization: 'Bearer ' })), false)
  assert.equal(isValidCronRequest(req({ 'x-vercel-cron': '1' })), false)
})
