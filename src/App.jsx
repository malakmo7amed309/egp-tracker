import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const OZ_TO_GRAM = 31.1034768
const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const todayStr = () => new Date().toISOString().slice(0, 10)

function dateDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

async function fetchLatest() {
  const [fxRes, goldRes] = await Promise.all([
    fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.json'),
    fetch('https://api.gold-api.com/price/XAU'),
  ])
  const fx = await fxRes.json()
  const gold = await goldRes.json()
  return {
    usdEgp: fx.usd.egp,
    eurEgp: fx.usd.egp / fx.usd.eur,
    fxDate: fx.date,
    goldOzUsd: gold.price,
    goldUpdated: gold.updatedAt,
    fetchedAt: Date.now(),
  }
}

async function fetchHistory(days) {
  const points = Math.min(30, days)
  const step = Math.max(1, Math.round(days / points))
  const dates = []
  for (let n = days; n >= 1; n -= step) dates.push(dateDaysAgo(n))
  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const res = await fetch(`https://${date}.currency-api.pages.dev/v1/currencies/usd.json`)
        if (!res.ok) return null
        const j = await res.json()
        return { date, value: j.usd.egp }
      } catch {
        return null
      }
    })
  )
  return results.filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))
}

function ChangeBadge({ pct }) {
  if (pct == null || !isFinite(pct)) return null
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
        up ? 'bg-green-soft text-green' : 'bg-[#f7e3dc] text-down'
      }`}
    >
      {up ? '\u25B2' : '\u25BC'} {Math.abs(pct).toFixed(2)}%
    </span>
  )
}

function StatCard({ label, sub, value, unit, pct, gold }) {
  return (
    <div className={`anim-rise rounded-2xl border border-line p-5 shadow-sm ${gold ? 'bg-gold-soft' : 'bg-card'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
        <ChangeBadge pct={pct} />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-ink sm:text-3xl">
        {value}
        <span className="ml-1 text-sm font-normal text-muted">{unit}</span>
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function AreaChart({ points, height = 260 }) {
  const ref = useRef(null)
  const [hover, setHover] = useState(null)
  const W = 720
  const H = height
  const PAD = { l: 8, r: 8, t: 16, b: 24 }

  const { path, area, min, max, xs } = useMemo(() => {
    if (!points.length) return { path: '', area: '', min: 0, max: 0, xs: [] }
    const values = points.map((p) => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const innerW = W - PAD.l - PAD.r
    const innerH = H - PAD.t - PAD.b
    const xs = points.map((_, i) => PAD.l + (i / Math.max(1, points.length - 1)) * innerW)
    const ys = points.map((p) => PAD.t + (1 - (p.value - min) / span) * innerH)
    const path = points.map((_, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
    const area = `${path} L${xs[xs.length - 1].toFixed(1)},${H - PAD.b} L${xs[0].toFixed(1)},${H - PAD.b} Z`
    return { path, area, min, max, xs }
  }, [points, H])

  const onMove = (e) => {
    if (!ref.current || !points.length) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i
    setHover(best)
  }

  const span = max - min || 1
  const innerH = H - PAD.t - PAD.b
  const yFor = (v) => PAD.t + (1 - (v - min) / span) * innerH
  const hp = hover != null ? points[hover] : null

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => e.touches[0] && onMove(e.touches[0])}
      >
        <defs>
          <linearGradient id="fillg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d5c46" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0d5c46" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.t + t * innerH
          const v = max - t * span
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e4dfd0" strokeDasharray="3 4" />
              <text x={W - PAD.r} y={y - 4} textAnchor="end" fontSize="10" fill="#6b7a72" fontFamily="IBM Plex Mono, monospace">
                {fmt(v)}
              </text>
            </g>
          )
        })}
        <path d={area} fill="url(#fillg)" />
        <path d={path} fill="none" stroke="#0d5c46" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {hp && (
          <g>
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD.t} y2={H - PAD.b} stroke="#b98a1d" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx={xs[hover]} cy={yFor(hp.value)} r="5" fill="#b98a1d" stroke="#fffdf7" strokeWidth="2" />
          </g>
        )}
        {points.length > 1 && (
          <>
            <text x={PAD.l} y={H - 6} fontSize="10" fill="#6b7a72" fontFamily="IBM Plex Mono, monospace">{points[0].date}</text>
            <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="#6b7a72" fontFamily="IBM Plex Mono, monospace">{points[points.length - 1].date}</text>
          </>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute rounded-lg border border-line bg-card px-3 py-1.5 text-center shadow-md"
          style={{ left: `${(xs[hover] / W) * 100}%`, top: 0, transform: `translateX(${xs[hover] / W > 0.7 ? '-110%' : '10%'})` }}
        >
          <p className="font-mono text-sm font-semibold text-ink">{fmt(hp.value)} EGP</p>
          <p className="text-[11px] text-muted">{hp.date}</p>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [latest, setLatest] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem('egp-latest'))
      if (c && Date.now() - c.fetchedAt < 10 * 60 * 1000) return c
    } catch { /* ignore */ }
    return null
  })
  const [range, setRange] = useState(90)
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const l = await fetchLatest()
      setLatest(l)
      localStorage.setItem('egp-latest', JSON.stringify(l))
    } catch {
      setError('Could not reach the rates API - showing the last saved numbers.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!latest) refresh()
  }, [latest, refresh])

  useEffect(() => {
    let dead = false
    if (history[range]) return
    fetchHistory(range).then((pts) => {
      if (!dead) setHistory((h) => ({ ...h, [range]: pts }))
    })
    return () => { dead = true }
  }, [range, history])

  const pts = history[range] || []
  const change30 = useMemo(() => {
    const h = history[30]
    if (!h || h.length < 2 || !latest) return null
    return ((latest.usdEgp - h[0].value) / h[0].value) * 100
  }, [history, latest])

  const rangeChange = useMemo(() => {
    if (pts.length < 2 || !latest) return null
    return ((latest.usdEgp - pts[0].value) / pts[0].value) * 100
  }, [pts, latest])

  const goldGram24 = latest ? (latest.goldOzUsd / OZ_TO_GRAM) * latest.usdEgp : null
  const goldGram21 = goldGram24 ? (goldGram24 * 21) / 24 : null
  const goldGram18 = goldGram24 ? (goldGram24 * 18) / 24 : null

  // converter state
  const [convAmount, setConvAmount] = useState('100')
  const [convDir, setConvDir] = useState('usd2egp')
  const [goldGrams, setGoldGrams] = useState('5')
  const [goldKarat, setGoldKarat] = useState('21')

  const convOut = useMemo(() => {
    const a = parseFloat(convAmount)
    if (!latest || isNaN(a)) return null
    return convDir === 'usd2egp' ? a * latest.usdEgp : a / latest.usdEgp
  }, [convAmount, convDir, latest])

  const goldOut = useMemo(() => {
    const g = parseFloat(goldGrams)
    if (!goldGram24 || isNaN(g)) return null
    const perGram = goldGram24 * (Number(goldKarat) / 24)
    return g * perGram
  }, [goldGrams, goldKarat, goldGram24])

  const updatedLabel = latest
    ? new Date(latest.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            EGP <span className="text-green">Tracker</span>
          </h1>
          <p className="text-sm text-muted">Dollar &amp; gold prices in Egypt, live</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedLabel && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-green" />
              updated {updatedLabel}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-full border border-line bg-card px-4 py-1.5 text-sm font-medium text-green transition hover:border-green disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <p className="mt-4 rounded-lg bg-[#f7e3dc] px-4 py-2 text-sm text-down">{error}</p>}

      <section className="anim-rise mt-6 rounded-3xl bg-green p-6 text-paper shadow-lg sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-soft/80">1 US Dollar</p>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="font-mono text-5xl font-semibold sm:text-6xl">
            {latest ? fmt(latest.usdEgp) : '---'}
          </p>
          <p className="pb-2 text-lg text-green-soft/90">EGP</p>
          <span className="pb-2"><ChangeBadge pct={change30} /></span>
        </div>
        <p className="mt-2 text-sm text-green-soft/80">
          30-day change{latest ? ` \u00B7 market rate for ${latest.fxDate}` : ''}
        </p>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Euro" sub="1 EUR in Egyptian pounds" value={latest ? fmt(latest.eurEgp) : '---'} unit="EGP" />
        <StatCard label="Gold ounce" sub="spot price, US dollars" value={latest ? fmt(latest.goldOzUsd, 0) : '---'} unit="USD" gold />
        <StatCard label="Gold gram 24K" sub="ayar 24, per gram" value={goldGram24 ? fmt(goldGram24, 0) : '---'} unit="EGP" gold />
        <StatCard label="Gold gram 21K" sub="ayar 21 - the Egyptian standard" value={goldGram21 ? fmt(goldGram21, 0) : '---'} unit="EGP" gold />
        <StatCard label="Gold gram 18K" sub="ayar 18, per gram" value={goldGram18 ? fmt(goldGram18, 0) : '---'} unit="EGP" gold />
        <StatCard label="100 USD" sub="quick mental math" value={latest ? fmt(100 * latest.usdEgp, 0) : '---'} unit="EGP" />
      </section>

      <section className="anim-rise mt-8 rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">USD/EGP chart</h2>
            <p className="text-sm text-muted">
              Scrub across the line for the exact rate{rangeChange != null ? ` \u00B7 ` : ''}
              {rangeChange != null && (
                <span className={rangeChange >= 0 ? 'text-green font-medium' : 'text-down font-medium'}>
                  {rangeChange >= 0 ? '+' : ''}{rangeChange.toFixed(2)}% over {range} days
                </span>
              )}
            </p>
          </div>
          <div className="flex rounded-full border border-line p-1">
            {[30, 90, 180].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-4 py-1 text-sm font-medium transition ${
                  range === r ? 'bg-green text-paper' : 'text-muted hover:text-ink'
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {pts.length ? <AreaChart points={pts} /> : <p className="py-20 text-center text-sm text-muted">Loading chart data...</p>}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="anim-rise rounded-3xl border border-line bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">Currency converter</h2>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={convAmount}
              onChange={(e) => setConvAmount(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 font-mono text-lg outline-none focus:border-green"
            />
            <button
              onClick={() => setConvDir(convDir === 'usd2egp' ? 'egp2usd' : 'usd2egp')}
              className="shrink-0 rounded-xl border border-line bg-paper px-3 py-3 text-sm font-semibold text-green transition hover:border-green"
              title="Swap direction"
            >
              {convDir === 'usd2egp' ? 'USD \u2192 EGP' : 'EGP \u2192 USD'}
            </button>
          </div>
          <p className="mt-4 font-mono text-2xl font-semibold text-green">
            {convOut != null ? `${fmt(convOut)} ${convDir === 'usd2egp' ? 'EGP' : 'USD'}` : '---'}
          </p>
        </div>

        <div className="anim-rise rounded-3xl border border-line bg-gold-soft p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">Gold calculator</h2>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={goldGrams}
              onChange={(e) => setGoldGrams(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-xl border border-line bg-card px-4 py-3 font-mono text-lg outline-none focus:border-gold"
            />
            <span className="shrink-0 text-sm text-muted">grams</span>
            <div className="flex rounded-xl border border-line bg-card p-1">
              {['24', '21', '18'].map((k) => (
                <button
                  key={k}
                  onClick={() => setGoldKarat(k)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    goldKarat === k ? 'bg-gold text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {k}K
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 font-mono text-2xl font-semibold text-gold">
            {goldOut != null ? `${fmt(goldOut, 0)} EGP` : '---'}
          </p>
          <p className="mt-1 text-xs text-muted">gold price only - workmanship (masna'eya) is extra at the jeweler</p>
        </div>
      </section>

      <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">
        <p>
          Rates: open currency-api (daily snapshots) and gold-api.com (live spot). Gold grams converted at 31.1035 g per ounce
          and priced by karat. Indicative market rates - bank counter rates differ slightly.
        </p>
        <p className="mt-1">Built with React + Tailwind CSS. Chart hand-rolled in SVG, no chart library.</p>
      </footer>
    </div>
  )
}
