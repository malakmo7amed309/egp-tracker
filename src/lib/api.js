const FX = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json'
const KEEP = ['egp', 'eur', 'gbp', 'sar', 'aed', 'kwd', 'qar', 'cad']

const pick = (usd) => Object.fromEntries(KEEP.map((k) => [k, usd[k]]))

export async function fetchLatest() {
  const [fxRes, goldRes] = await Promise.all([fetch(FX), fetch('https://api.gold-api.com/price/XAU')])
  if (!fxRes.ok || !goldRes.ok) throw new Error('rates service error')
  const fx = await fxRes.json()
  const gold = await goldRes.json()
  if (!fx.usd?.egp || !gold.price) throw new Error('unexpected rates response')
  return { rates: pick(fx.usd), fxDate: fx.date, goldOzUsd: gold.price, fetchedAt: Date.now() }
}

const dayKey = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// Past daily snapshots never change, so each day is saved after the first download.
async function fetchDay(date) {
  const key = 'egp-day-' + date
  try {
    const hit = JSON.parse(localStorage.getItem(key))
    if (hit) return hit
  } catch { /* ignore */ }
  try {
    const res = await fetch(`https://${date}.currency-api.pages.dev/v1/currencies/usd.json`)
    if (!res.ok) return null
    const j = await res.json()
    const row = { date, rates: pick(j.usd) }
    try { localStorage.setItem(key, JSON.stringify(row)) } catch { /* ignore */ }
    return row
  } catch {
    return null
  }
}

/** About 30 evenly spaced daily snapshots over the last `days` days. */
export async function fetchHistory(days) {
  const step = Math.max(1, Math.round(days / Math.min(30, days)))
  const dates = []
  for (let n = days; n >= 1; n -= step) dates.push(dayKey(n))
  const rows = (await Promise.all(dates.map(fetchDay))).filter(Boolean)
  if (rows.length < 2) throw new Error('no history')
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
