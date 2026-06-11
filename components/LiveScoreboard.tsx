'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================
// LIVE SCOREBOARD
// Polls /api/ncaa-scores (free NCAA.com data feed) every 60s.
// Shows live, upcoming, and final tournament games with
// "picked by N" pool context. When a game goes final that isn't
// recorded yet, it auto-triggers /api/ncaa-sync so points land
// without the commissioner doing anything, then refreshes the
// leaderboard via onGameFinalized.
// ============================================

const SYNC_TOKEN = process.env.NEXT_PUBLIC_SYNC_TOKEN || 'madness-sync-2026'

interface LiveTeam {
  espnName: string
  score: number
  dbId: string | null
  dbName: string | null
  seed: number | null
  pickedBy: number
}

interface LiveGame {
  eventId: string
  round: number
  roundLabel: string
  state: string
  statusDetail: string
  startTime: string | null
  home: LiveTeam
  away: LiveTeam
}

export default function LiveScoreboard({ onGameFinalized }: { onGameFinalized?: () => void }) {
  const [games, setGames] = useState<LiveGame[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const syncingRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ncaa-scores')
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setGames(data.games || [])
      setLastFetch(new Date())
      if (data.pendingSync && !syncingRef.current) {
        // A game just went final and isn't recorded yet — sync it now
        syncingRef.current = true
        try {
          await fetch('/api/ncaa-sync', {
            headers: { Authorization: 'Bearer ' + SYNC_TOKEN },
          })
          if (onGameFinalized) onGameFinalized()
        } catch {
          // sync will retry on next poll
        }
        syncingRef.current = false
      }
    } catch {
      // network hiccup - keep last known state
    }
    setLoading(false)
  }, [onGameFinalized])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return null
  if (games.length === 0) return null

  const liveCount = games.filter(g => g.state === 'in').length
  const headerLabel = liveCount > 0
    ? 'LIVE SCOREBOARD'
    : 'TODAY\u2019S GAMES'

  const updatedLabel = lastFetch
    ? 'Updated ' + lastFetch.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''

  const arrowClass = 'inline-block transition-transform duration-200' + (collapsed ? '' : ' rotate-90')

  return (
    <div className="card p-4 mb-6">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className={arrowClass}>▶</span>
          <span className="font-display text-xl text-maize-400 tracking-wider">{headerLabel}</span>
          {liveCount > 0 && (
            <span className="flex items-center gap-1 text-red-400 text-xs font-body">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              {liveCount} LIVE
            </span>
          )}
        </div>
        <span className="text-white/30 text-xs font-body">{updatedLabel}</span>
      </button>

      {!collapsed && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {games.map(g => <GameCard key={g.eventId} game={g} />)}
        </div>
      )}
    </div>
  )
}

function GameCard({ game }: { game: LiveGame }) {
  const isLive = game.state === 'in'
  const isFinal = game.state === 'post'

  const awayWinning = game.away.score > game.home.score
  const homeWinning = game.home.score > game.away.score

  let statusEl = null
  if (isLive) {
    statusEl = <span className="text-red-400 font-semibold">{game.statusDetail}</span>
  } else if (isFinal) {
    statusEl = <span className="text-white/50">FINAL</span>
  } else {
    statusEl = <span className="text-white/50">{game.statusDetail}</span>
  }

  const borderClass = isLive
    ? 'rounded-lg border border-red-500/40 bg-white/5 p-3'
    : 'rounded-lg border border-white/10 bg-white/5 p-3'

  return (
    <div className={borderClass}>
      <div className="flex items-center justify-between text-xs font-body mb-2">
        <span className="text-maize-400/80">{game.roundLabel}</span>
        {statusEl}
      </div>
      <TeamRow team={game.away} bold={isFinal ? awayWinning : false} showScore={!(!isLive && !isFinal)} winning={isLive && awayWinning} />
      <TeamRow team={game.home} bold={isFinal ? homeWinning : false} showScore={!(!isLive && !isFinal)} winning={isLive && homeWinning} />
    </div>
  )
}

function TeamRow({ team, bold, showScore, winning }: { team: LiveTeam, bold: boolean, showScore: boolean, winning: boolean }) {
  const name = team.dbName || team.espnName
  const nameClass = bold
    ? 'text-chalk font-semibold font-body text-sm truncate'
    : 'text-white/80 font-body text-sm truncate'
  const scoreClass = (bold || winning)
    ? 'text-chalk font-bold font-body text-sm tabular-nums'
    : 'text-white/60 font-body text-sm tabular-nums'

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        {team.seed !== null && (
          <span className="text-white/40 text-xs font-body w-5 text-right shrink-0">{team.seed}</span>
        )}
        <span className={nameClass}>{name}</span>
        {team.pickedBy > 0 && (
          <span className="text-maize-400/70 text-[10px] font-body bg-maize-400/10 rounded px-1.5 py-0.5 shrink-0">
            {team.pickedBy} {team.pickedBy === 1 ? 'pick' : 'picks'}
          </span>
        )}
      </div>
      {showScore && <span className={scoreClass}>{team.score}</span>}
    </div>
  )
}
