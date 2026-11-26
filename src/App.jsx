import { useCallback, useEffect, useMemo, useState } from 'react'
import AreaChart from './components/Chart.jsx'
import Portfolio from './components/Portfolio.jsx'
import Alerts from './components/Alerts.jsx'
import { fetchHistory, fetchLatest } from './lib/api.js'
import { CURRENCIES, KARATS, alertHit, convert, egpPer, fmt, goldGram, isValidAmount, pctChange, rangeStats } from './lib/calc.js'
import { load, save } from './lib/storage.js'

const REFRESH_MS = 5 * 60 * 1000
const FRESH_MS = 10 * 60 * 1000

function ChangeBadge({ pct }) {
  if (pct == null || !isFinite(pct)) return null
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium ${up ? 'bg-green-soft text-green' : 'bg-[#f7e3dc] text-down'}`}>
      {up ? '\u25B2' : '\u25BC'} {Math.abs(pct).toFixed(2)}%
    </span>
  )
}

function StatCard({ label, sub, value, unit, gold }) {
  return (
    <div className={`anim-rise rounded-2xl border border-line p-5 shadow-sm ${gold ? 'bg-gold-soft' : 'bg-card'}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-ink sm:text-3xl">
        {value}
        <span className="ml-1 text-sm font-normal text-muted">{unit}</span>
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

const selectCls = 'rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold outline-none focus:border-green'
const inputCls = 'w-full rounded-xl border border-line bg-paper px-4 py-3 font-mono text-lg outline-none focus:border-green'

export default function App() {
  const [latest, setLatest] = useState(() => {
    const c = load('egp-latest-v2', null)
    return c && c.rates ? c : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [range, setRange] = useState(90)
  const [chartCode, setChartCode] = useState('USD')
  const [history, setHistory] = useState({})
  const [histErr, setHistErr] = useState(false)
  const [holdings, setHoldings] = useState(() => load('egp-holdings', []))
  const [alerts, setAlerts] = useState(() => load('egp-alerts', []))

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const l = await fetchLatest()
      setLatest(l)
      save('egp-latest-v2', l)
    } catch {
      setError('Could not reach the rates service. Showing the last saved numbers.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!latest || Date.now() - latest.fetchedAt > FRESH_MS) refresh()
    const t = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { save('egp-holdings', holdings) }, [holdings])
  useEffect(() => { save('egp-alerts', alerts) }, [alerts])

  const loadHistory = useCallback((r) => {
    setHistErr(false)
    fetchHistory(r)
      .then((rows) => setHistory((h) => ({ ...h, [r]: rows })))
      .catch(() => setHistErr(true))
  }, [])
  useEffect(() => { if (!history[range]) loadHistory(range) }, [range])
  useEffect(() => { fetchHistory(30).then((rows) => setHistory((h) => ({ ...h, 30: h[30] || rows }))).catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // chart series: EGP per one unit of the chosen currency
  const pts = useMemo(() => {
    const rows = history[range]
    if (!rows) return []
    return rows
      .map((r) => ({ date: r.date, value: egpPer(chartCode, r.rates) }))
      .filter((p) => p.value != null)
  }, [history, range, chartCode])
  const stats = useMemo(() => rangeStats(pts), [pts])

  const rates = latest?.rates
  const nowRate = rates ? egpPer(chartCode, rates) : null
  const usdEgp = rates?.egp ?? null
  const ctx = latest ? { rates: latest.rates, goldOzUsd: latest.goldOzUsd } : null
  const g24 = latest ? goldGram(24, latest.goldOzUsd, usdEgp) : null

  const thirty = useMemo(() => {
    const rows = history[30]
    if (!rows || !rates) return null
    return pctChange(egpPer('USD', rows[0].rates), usdEgp)
  }, [history, rates, usdEgp])

  // converter
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('EGP')
  const [copied, setCopied] = useState(false)
  const codes = ['EGP', ...CURRENCIES.map((c) => c.code)]
  const amountOk = isValidAmount(amount)
  const out = rates && amountOk ? convert(Number(amount), from, to, { ...rates, usd: 1 }) : null
  const swap = () => { setFrom(to); setTo(from) }
  const copy = async () => {
    if (out == null) return
    try { await navigator.clipboard.writeText(out.toFixed(2)); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* blocked */ }
  }

  // gold calculator
  const [grams, setGrams] = useState('5')
  const [karat, setKarat] = useState(21)
  const gramsOk = isValidAmount(grams)
  const goldOut = latest && gramsOk ? Number(grams) * goldGram(karat, latest.goldOzUsd, usdEgp) : null

  const firedAlerts = alerts.filter((a) => alertHit(a, usdEgp))
  const updatedLabel = latest ? new Date(latest.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null
  const stale = latest && Date.now() - latest.fetchedAt > FRESH_MS

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">EGP <span className="text-green">Tracker</span></h1>
          <p className="text-sm text-muted">Dollar &amp; gold prices in Egypt, live</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedLabel && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`inline-block h-2 w-2 rounded-full ${stale ? 'bg-gold' : 'live-dot bg-green'}`} />
              {stale ? 'saved' : 'updated'} {updatedLabel}
            </span>
          )}
          <button onClick={refresh} disabled={loading} className="rounded-full border border-line bg-card px-4 py-1.5 text-sm font-medium text-green transition hover:border-green disabled:opacity-50">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <p role="alert" className="mt-4 rounded-lg bg-[#f7e3dc] px-4 py-2 text-sm text-down">{error}</p>}
      {firedAlerts.length > 0 && (
        <p className="mt-4 rounded-lg bg-green-soft px-4 py-2 text-sm font-medium text-green">
          Alert reached: dollar is at {fmt(usdEgp)} EGP ({firedAlerts.map((a) => `${a.dir === 'above' ? 'above' : 'below'} ${fmt(a.target)}`).join(', ')}).
        </p>
      )}

      <section className="anim-rise mt-6 rounded-3xl bg-green p-6 text-paper shadow-lg sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-soft/80">1 US Dollar</p>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="font-mono text-5xl font-semibold sm:text-6xl">{latest ? fmt(usdEgp) : '---'}</p>
          <p className="pb-2 text-lg text-green-soft/90">EGP</p>
          <span className="pb-2"><ChangeBadge pct={thirty} /></span>
        </div>
        <p className="mt-2 text-sm text-green-soft/80">30-day change{latest ? ` \u00B7 market rate for ${latest.fxDate}` : ''}</p>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Prices">
        <StatCard label="Euro" sub="1 EUR in Egyptian pounds" value={rates ? fmt(egpPer('EUR', rates)) : '---'} unit="EGP" />
        <StatCard label="Saudi Riyal" sub="1 SAR, for Umrah and Gulf work" value={rates ? fmt(egpPer('SAR', rates)) : '---'} unit="EGP" />
        <StatCard label="Gold ounce" sub="spot price, US dollars" value={latest ? fmt(latest.goldOzUsd, 0) : '---'} unit="USD" gold />
        <StatCard label="Gold gram 24K" sub="ayar 24, per gram" value={g24 ? fmt(g24, 0) : '---'} unit="EGP" gold />
        <StatCard label="Gold gram 21K" sub="ayar 21, the Egyptian standard" value={g24 ? fmt(goldGram(21, latest.goldOzUsd, usdEgp), 0) : '---'} unit="EGP" gold />
        <StatCard label="Gold gram 18K" sub="ayar 18, per gram" value={g24 ? fmt(goldGram(18, latest.goldOzUsd, usdEgp), 0) : '---'} unit="EGP" gold />
      </section>

      <section className="anim-rise mt-8 rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-7" aria-labelledby="chart-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="chart-title" className="font-display text-xl font-bold">{chartCode}/EGP chart</h2>
            <p className="text-sm text-muted">Scrub across the line for the exact rate</p>
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="Chart currency" value={chartCode} onChange={(e) => setChartCode(e.target.value)} className={selectCls}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <div className="flex rounded-full border border-line p-1" role="group" aria-label="Range">
              {[30, 90, 180, 365].map((r) => (
                <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`rounded-full px-3 py-1 text-sm font-medium transition sm:px-4 ${range === r ? 'bg-green text-paper' : 'text-muted hover:text-ink'}`}>{r === 365 ? '1Y' : `${r}D`}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          {pts.length > 1 ? <AreaChart points={pts} unit="EGP" /> : histErr ? (
            <div className="py-16 text-center text-sm text-muted">
              <p>Could not load the history.</p>
              <button onClick={() => loadHistory(range)} className="mt-3 rounded-full border border-line px-4 py-1.5 font-medium text-green hover:border-green">Try again</button>
            </div>
          ) : <p className="py-20 text-center text-sm text-muted">Loading chart data...</p>}
        </div>
        {stats && pts.length > 1 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['High', fmt(stats.high)], ['Low', fmt(stats.low)], ['Average', fmt(stats.avg)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-paper px-4 py-3"><dt className="text-xs text-muted">{k}</dt><dd className="font-mono text-lg font-semibold">{v}</dd></div>
            ))}
            <div className="rounded-xl bg-paper px-4 py-3"><dt className="text-xs text-muted">Change</dt><dd className={`font-mono text-lg font-semibold ${stats.change >= 0 ? 'text-green' : 'text-down'}`}>{stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}%</dd></div>
          </dl>
        )}
        {nowRate != null && stats && <p className="mt-3 text-xs text-muted">Now {fmt(nowRate)} EGP, which is {nowRate >= stats.avg ? 'above' : 'below'} the {range === 365 ? '1-year' : `${range}-day`} average.</p>}
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="anim-rise rounded-3xl border border-line bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">Currency converter</h2>
          <div className="mt-4">
            <input aria-label="Amount to convert" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-invalid={!amountOk} className={inputCls} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <select aria-label="From currency" value={from} onChange={(e) => setFrom(e.target.value)} className={`${selectCls} flex-1`}>{codes.map((c) => <option key={c}>{c}</option>)}</select>
            <button onClick={swap} aria-label="Swap currencies" className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-green hover:border-green">{'\u21C4'}</button>
            <select aria-label="To currency" value={to} onChange={(e) => setTo(e.target.value)} className={`${selectCls} flex-1`}>{codes.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="font-mono text-2xl font-semibold text-green">{out != null ? `${fmt(out, out < 1 ? 4 : 2)} ${to}` : '---'}</p>
            <button onClick={copy} disabled={out == null} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted hover:border-green hover:text-green disabled:opacity-40">{copied ? 'Copied' : 'Copy'}</button>
          </div>
          {!amountOk && <p role="alert" className="mt-2 text-xs text-down">Enter a number above zero.</p>}
        </div>

        <div className="anim-rise rounded-3xl border border-line bg-gold-soft p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">Gold calculator</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input aria-label="Grams of gold" value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" aria-invalid={!gramsOk} className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-3 font-mono text-lg outline-none focus:border-gold" />
            <span className="text-sm text-muted">grams</span>
            <div className="flex rounded-xl border border-line bg-card p-1" role="group" aria-label="Karat">
              {KARATS.map((k) => (
                <button key={k} onClick={() => setKarat(k)} aria-pressed={karat === k} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${karat === k ? 'bg-gold text-white' : 'text-muted hover:text-ink'}`}>{k}K</button>
              ))}
            </div>
          </div>
          <p className="mt-4 font-mono text-2xl font-semibold text-gold">{goldOut != null ? `${fmt(goldOut, 0)} EGP` : '---'}</p>
          {!gramsOk && <p role="alert" className="mt-1 text-xs text-down">Enter grams above zero.</p>}
          <p className="mt-1 text-xs text-muted">Gold price only. Workmanship (masna'eya) is extra at the jeweler.</p>
        </div>
      </section>

      <Portfolio holdings={holdings} setHoldings={setHoldings} ctx={ctx} />
      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Alerts alerts={alerts} setAlerts={setAlerts} usdEgp={usdEgp} />
        <div className="anim-rise rounded-3xl border border-line bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">About these numbers</h2>
          <p className="mt-2 text-sm text-muted">Dollar and other rates come from open currency-api daily snapshots. Gold is the live spot price from gold-api.com, converted at 31.1035 g per ounce and priced by karat. These are indicative market rates. Bank counters and the black market differ.</p>
          <p className="mt-2 text-sm text-muted">Your savings and alerts never leave this browser.</p>
        </div>
      </section>

      <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">
        <p>Built with React + Tailwind CSS. Chart hand-rolled in SVG, no chart library.</p>
      </footer>
    </div>
  )
}
