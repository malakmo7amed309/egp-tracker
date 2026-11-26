import { useState } from 'react'
import { alertHit, fmt, isValidAmount } from '../lib/calc.js'

export default function Alerts({ alerts, setAlerts, usdEgp }) {
  const [dir, setDir] = useState('above')
  const [target, setTarget] = useState('')
  const [err, setErr] = useState('')
  const add = (e) => {
    e.preventDefault()
    if (!isValidAmount(target)) return setErr('Enter a target rate above zero.')
    setErr('')
    setAlerts([...alerts, { id: Date.now(), dir, target: Number(target) }])
    setTarget('')
  }
  return (
    <div className="anim-rise rounded-3xl border border-line bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold">Price alerts</h2>
      <p className="mt-1 text-xs text-muted">USD/EGP. Checked each time rates refresh while the page is open.</p>
      <ul className="mt-3 space-y-2">
        {alerts.map((a) => {
          const hit = alertHit(a, usdEgp)
          return (
            <li key={a.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${hit ? 'border-green bg-green-soft' : 'border-line'}`}>
              <span className="font-mono">Dollar {a.dir === 'above' ? '\u2265' : '\u2264'} {fmt(a.target)}</span>
              <span className="flex items-center gap-2">
                {hit && <span className="text-xs font-semibold text-green">Reached</span>}
                <button onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))} aria-label="Delete alert" className="text-xs text-muted hover:text-down">Delete</button>
              </span>
            </li>
          )
        })}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <select aria-label="Alert direction" value={dir} onChange={(e) => setDir(e.target.value)} className="rounded-xl border border-line bg-paper px-3 py-2 text-sm">
          <option value="above">Goes above</option>
          <option value="below">Drops below</option>
        </select>
        <input aria-label="Target rate" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 55" inputMode="decimal" className="w-24 rounded-xl border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-green" />
        <button className="rounded-full bg-green px-4 py-2 text-sm font-semibold text-paper">Set</button>
      </form>
      {err && <p role="alert" className="mt-2 text-sm text-down">{err}</p>}
    </div>
  )
}
