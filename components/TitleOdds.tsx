'use client'

import { useState, useEffect } from 'react'

// ============================================
// TITLE ODDS (Kalshi)
// Shows live championship probabilities from Kalshi prediction
// markets. Hidden entirely when no markets are available
// (e.g. before Kalshi opens next season's tournament markets).
// ============================================

interface OddsRow {
  label: string
  probability: number
  teamId: string | null
  teamName: string | null
  seed: number | null
  eliminated: boolean
}

export default function TitleOdds() {
  const [odds, setOdds] = useState<OddsRow[]>([])
  const [available, setAvailable] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/kalshi-odds')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setOdds(data.odds || [])
        setAvailable(!!data.available)
      } catch {
        // leave hidden
      }
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (!available) return null

  const active = odds.filter(o => !o.eliminated && o.probability >= 0.5)
  const rows = showAll ? active : active.slice(0, 10)
  const maxProb = active.length > 0 ? active[0].probability : 100

  const arrowClass = 'inline-block transition-transform duration-200' + (collapsed ? '' : ' rotate-90')

  return (
    <div className="card p-4 mb-6">
      <button onClick={() => setCollapsed(c => !c)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={arrowClass}>▶</span>
          <span className="font-display text-xl text-maize-400 tracking-wider">TITLE ODDS</span>
        </div>
        <span className="text-white/30 text-xs font-body">via Kalshi · live market prices</span>
      </button>

      {!collapsed && (
        <div className="mt-4 space-y-1.5">
          {rows.map(o => <OddsBar key={o.label} row={o} maxProb={maxProb} />)}
          {active.length > 10 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="text-maize-400/80 hover:text-maize-300 text-xs font-body mt-2"
            >
              {showAll ? 'Show top 10' : 'Show all ' + active.length + ' teams'}
            </button>
          )}
          <p className="text-white/25 text-[10px] font-body pt-2">
            Implied championship probability from Kalshi prediction market prices. For entertainment only — not betting advice.
          </p>
        </div>
      )}
    </div>
  )
}

function OddsBar({ row, maxProb }: { row: OddsRow, maxProb: number }) {
  const widthPct = Math.max(2, Math.round((row.probability / Math.max(maxProb, 1)) * 100))
  const name = row.teamName || row.label
  const barStyle = { width: widthPct + '%' }

  return (
    <div className="flex items-center gap-2">
      <div className="w-36 flex items-center gap-1.5 shrink-0">
        {row.seed !== null && (
          <span className="text-white/40 text-xs font-body w-5 text-right">{row.seed}</span>
        )}
        <span className="text-white/80 text-sm font-body truncate">{name}</span>
      </div>
      <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
        <div className="h-full bg-maize-400/60 rounded" style={barStyle}></div>
      </div>
      <span className="text-chalk text-sm font-body tabular-nums w-12 text-right">{row.probability.toFixed(1)}%</span>
    </div>
  )
}
