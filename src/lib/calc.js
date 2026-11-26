export const OZ_TO_GRAM = 31.1034768

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'CAD', name: 'Canadian Dollar' },
]
export const KARATS = [24, 21, 18]

export const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** `rates` is the usd.json map: how many units of each currency one US dollar buys. */
const rate = (rates, code) => (code === 'USD' ? 1 : rates[code.toLowerCase()])

/** How many EGP one unit of `code` is worth. */
export function egpPer(code, rates) {
  const r = rate(rates, code)
  return r ? rates.egp / r : null
}

export function convert(amount, from, to, rates) {
  const a = rate(rates, from)
  const b = rate(rates, to)
  if (!a || !b || !isFinite(amount)) return null
  return (amount / a) * b
}

/** EGP price of one gram of gold of a given karat. */
export function goldGram(karat, ozUsd, usdEgp) {
  return ((ozUsd / OZ_TO_GRAM) * usdEgp * karat) / 24
}

export function pctChange(from, to) {
  return from ? ((to - from) / from) * 100 : null
}

/** High, low, average and change for a series of { value }. */
export function rangeStats(points) {
  if (points.length === 0) return null
  const v = points.map((p) => p.value)
  return {
    high: Math.max(...v),
    low: Math.min(...v),
    avg: v.reduce((a, b) => a + b, 0) / v.length,
    change: pctChange(v[0], v[v.length - 1]),
  }
}

/** Value of one holding in EGP right now. null when the rates aren't loaded. */
export function holdingValue(h, ctx) {
  if (!ctx) return null
  if (h.kind === 'gold') return h.amount * goldGram(h.karat, ctx.goldOzUsd, ctx.rates.egp)
  const per = egpPer(h.code, ctx.rates)
  return per == null ? null : h.amount * per
}

export function portfolioTotals(holdings, ctx) {
  let value = 0
  let cost = 0
  let costKnown = 0
  for (const h of holdings) {
    const v = holdingValue(h, ctx)
    if (v == null) continue
    value += v
    if (h.cost > 0) {
      cost += h.cost
      costKnown += v
    }
  }
  return { value, cost, profit: cost > 0 ? costKnown - cost : null, profitPct: cost > 0 ? pctChange(cost, costKnown) : null }
}

export function alertHit(alert, current) {
  if (current == null) return false
  return alert.dir === 'above' ? current >= alert.target : current <= alert.target
}

export const isValidAmount = (s) => /^\d*\.?\d+$/.test(String(s).trim()) && Number(s) > 0
