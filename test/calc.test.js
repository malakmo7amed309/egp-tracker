import test from 'node:test'
import assert from 'node:assert/strict'
import { alertHit, convert, egpPer, goldGram, holdingValue, isValidAmount, pctChange, portfolioTotals, rangeStats } from '../src/lib/calc.js'

const rates = { egp: 50, eur: 0.9, gbp: 0.8, sar: 3.75 }

test('egpPer gives the EGP price of one unit', () => {
  assert.equal(egpPer('USD', rates), 50)
  assert.equal(Math.round(egpPer('EUR', rates) * 100) / 100, 55.56)
  assert.equal(egpPer('XXX', rates), null)
})

test('convert goes through the dollar in both directions', () => {
  assert.equal(convert(10, 'USD', 'EGP', rates), 500)
  assert.equal(convert(500, 'EGP', 'USD', rates), 10)
  assert.equal(Math.round(convert(100, 'SAR', 'EGP', rates)), 1333)
  assert.equal(convert(NaN, 'USD', 'EGP', rates), null)
})

test('goldGram scales by karat', () => {
  const g24 = goldGram(24, 3110.34768, 50) // one gram of 24K = 100 USD = 5000 EGP
  assert.ok(Math.abs(g24 - 5000) < 0.01)
  assert.ok(Math.abs(goldGram(21, 3110.34768, 50) - 4375) < 0.01)
  assert.ok(Math.abs(goldGram(18, 3110.34768, 50) - 3750) < 0.01)
})

test('rangeStats and pctChange', () => {
  assert.equal(rangeStats([]), null)
  const s = rangeStats([{ value: 50 }, { value: 40 }, { value: 60 }])
  assert.deepEqual(s, { high: 60, low: 40, avg: 50, change: 20 })
  assert.equal(pctChange(0, 5), null)
})

test('portfolio value and profit', () => {
  const ctx = { rates, goldOzUsd: 3110.34768 }
  const holdings = [
    { kind: 'currency', code: 'USD', amount: 100, cost: 4500 },
    { kind: 'gold', karat: 21, amount: 2, cost: 0 },
  ]
  assert.equal(holdingValue(holdings[0], ctx), 5000)
  const t = portfolioTotals(holdings, ctx)
  assert.ok(Math.abs(t.value - (5000 + 8750)) < 0.01)
  assert.equal(t.profit, 500) // only the holding with a known cost counts
  assert.ok(Math.abs(t.profitPct - 11.11) < 0.01)
  assert.equal(holdingValue(holdings[0], null), null)
})

test('alerts fire on the right side of the target', () => {
  assert.equal(alertHit({ dir: 'above', target: 55 }, 55.2), true)
  assert.equal(alertHit({ dir: 'above', target: 55 }, 54.9), false)
  assert.equal(alertHit({ dir: 'below', target: 50 }, 49.5), true)
  assert.equal(alertHit({ dir: 'below', target: 50 }, null), false)
})

test('isValidAmount accepts positive numbers only', () => {
  for (const ok of ['1', '0.5', '.5', '100.25']) assert.equal(isValidAmount(ok), true, ok)
  for (const bad of ['', '0', '-3', 'abc', '1e5', '1,5']) assert.equal(isValidAmount(bad), false, bad)
})
