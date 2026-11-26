import { useMemo, useRef, useState } from 'react'
import { fmt } from '../lib/calc.js'

export default function AreaChart({ points, height = 260, unit = "EGP" }) {
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
          <p className="font-mono text-sm font-semibold text-ink">{fmt(hp.value)} {unit}</p>
          <p className="text-[11px] text-muted">{hp.date}</p>
        </div>
      )}
    </div>
  )
}

