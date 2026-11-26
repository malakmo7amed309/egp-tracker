import { useState } from 'react'
import { CURRENCIES, KARATS, fmt, holdingValue, isValidAmount, portfolioTotals } from '../lib/calc.js'

export default function Portfolio({ holdings, setHoldings, ctx }) {
  const [kind, setKind] = useState('currency')
  const [code, setCode] = useState('USD')
  const [karat, setKarat] = useState(21)
  const [amount, setAmount] = useState('')
  const [cost, setCost] = useState('')
  const [err, setErr] = useState('')
  const t = portfolioTotals(holdings, ctx)

  const add = (e) => {
    e.preventDefault()
    if (!isValidAmount(amount)) return setErr('Enter an amount above zero.')
    if (cost && !isValidAmount(cost)) return setErr('Cost must be a number above zero, or empty.')
    setErr('')
    const h = { id: Date.now(), kind, amount: Number(amount), cost: cost ? Number(cost) : 0 }
    if (kind === 'gold') h.karat = karat
    else h.code = code
    setHoldings([...holdings, h])
    setAmount('')
    setCost('')
  }
  const remove = (id) => setHoldings(holdings.filter((h) => h.id !== id))
  const input = 'rounded-xl border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-green'

  return (
    <section className="anim-rise mt-8 rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-7" aria-labelledby="pf-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pf-title" className="font-display text-xl font-bold">My savings</h2>
          <p className="text-sm text-muted">Dollars, euros, gold. Valued at today's rates. Saved only in this browser.</p>
        </div>
        {holdings.length > 0 && (
          <div className="text-right">
            <p className="font-mono text-2xl font-semibold text-green">{ctx ? fmt(t.value, 0) : '---'} EGP</p>
            {t.profit != null && (
              <p className={`font-mono text-xs ${t.profit >= 0 ? 'text-green' : 'text-down'}`}>
                {t.profit >= 0 ? '+' : ''}{fmt(t.profit, 0)} EGP ({t.profitPct >= 0 ? '+' : ''}{t.profitPct.toFixed(1)}%) vs what you paid
              </p>
            )}
          </div>
        )}
      </div>

      {holdings.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {holdings.map((h) => {
            const v = holdingValue(h, ctx)
            return (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-sm font-semibold">
                    {h.kind === 'gold' ? `${fmt(h.amount, h.amount % 1 ? 2 : 0)} g gold ${h.karat}K` : `${fmt(h.amount, h.amount % 1 ? 2 : 0)} ${h.code}`}
                  </p>
                  {h.cost > 0 && <p className="text-xs text-muted">paid {fmt(h.cost, 0)} EGP</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-green">{v != null ? `${fmt(v, 0)} EGP` : '---'}</span>
                  <button onClick={() => remove(h.id)} aria-label="Remove holding" className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-down hover:text-down">Remove</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2">
        <select aria-label="Holding type" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          <option value="currency">Currency</option>
          <option value="gold">Gold (grams)</option>
        </select>
        {kind === 'currency' ? (
          <select aria-label="Currency" value={code} onChange={(e) => setCode(e.target.value)} className={input}>
            {CURRENCIES.map((c) => <option key={c.code}>{c.code}</option>)}
          </select>
        ) : (
          <select aria-label="Karat" value={karat} onChange={(e) => setKarat(Number(e.target.value))} className={input}>
            {KARATS.map((k) => <option key={k} value={k}>{k}K</option>)}
          </select>
        )}
        <input aria-label="Amount" placeholder={kind === 'gold' ? 'Grams' : 'Amount'} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${input} w-28`} />
        <input aria-label="What you paid in EGP (optional)" placeholder="Paid, EGP (optional)" value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={`${input} w-44`} />
        <button className="rounded-full bg-green px-5 py-2 text-sm font-semibold text-paper hover:opacity-90">Add</button>
      </form>
      {err && <p role="alert" className="mt-2 text-sm text-down">{err}</p>}
      {holdings.length === 0 && <p className="mt-3 text-sm text-muted">Nothing added yet. Add what you hold to see what it is worth in EGP today.</p>}
    </section>
  )
}
