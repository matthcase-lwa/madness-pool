'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { BRACKET_2026, BracketGame, BracketTeam, REGION_COLORS, ROUND_LABELS } from '@/lib/bracketData'

const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const NavCTA = dynamic(() => import('@/components/NavCTA'), { ssr: false })

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')

// ── Team cell component ──────────────────────────────────────────────────────
function TeamCell({
  team,
  isWinner,
  score,
  liveScore,
  gameStatus,
}: {
  team: BracketTeam | null
  isWinner?: boolean
  score?: number
  liveScore?: number
  gameStatus?: string
}) {
  const displayScore = liveScore ?? score
  const isEmpty = !team

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 min-h-[32px] ${
      isEmpty ? 'opacity-0' :
      isWinner ? 'bg-maize-500/15' :
      gameStatus === 'final' && !isWinner ? 'opacity-40' : ''
    }`}>
      {team && (
        <>
          {/* Seed */}
          <span className={`text-xs font-bold w-5 shrink-0 text-center ${
            team.seed === 1 ? 'text-white font-black' :
            team.seed <= 4 ? 'text-maize-400' :
            team.seed >= 9 ? 'text-emerald-400' :
            'text-white/40'
          }`}>
            {team.seed}
          </span>

          {/* Logo */}
          {team.espnId ? (
            <div className="w-5 h-5 shrink-0 flex items-center justify-center">
              <Image
                src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${team.espnId}.png`}
                alt={team.name}
                width={18}
                height={18}
                className={`object-contain ${gameStatus === 'final' && !isWinner ? 'grayscale' : ''}`}
                unoptimized
              />
            </div>
          ) : (
            <div className="w-5 h-5 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-xs font-bold">
              {team.name.charAt(0)}
            </div>
          )}

          {/* Name */}
          <span className={`text-xs font-body truncate flex-1 ${
            isWinner ? 'text-chalk font-bold' : 'text-white/70'
          }`}>
            {team.name}
          </span>

          {/* Score */}
          {displayScore !== undefined && (
            <span className={`text-xs font-bold shrink-0 tabular-nums ${
              isWinner ? 'text-maize-400' : 'text-white/40'
            }`}>
              {displayScore}
            </span>
          )}

          {/* Winner checkmark */}
          {isWinner && gameStatus === 'final' && (
            <span className="text-maize-500 text-xs shrink-0">✓</span>
          )}

          {/* Live indicator */}
          {gameStatus === 'live' && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          )}
        </>
      )}
      {isEmpty && <span className="text-white/10 text-xs font-body">TBD</span>}
    </div>
  )
}

// ── Game matchup card ────────────────────────────────────────────────────────
function GameCard({
  game,
  liveData,
  compact = false,
}: {
  game: BracketGame
  liveData?: any
  compact?: boolean
}) {
  const regionColor = REGION_COLORS[game.region] || ''
  const isLive = liveData?.status === 'in' || game.status === 'live'
  const isFinal = liveData?.status === 'post' || game.status === 'final'
  const gameStatus = isLive ? 'live' : isFinal ? 'final' : 'pre'

  const topScore = liveData?.awayScore ?? game.topScore
  const bottomScore = liveData?.homeScore ?? game.bottomScore
  const topWinner = liveData?.awayWinner ?? (game.winnerId === 'top')
  const bottomWinner = liveData?.homeWinner ?? (game.winnerId === 'bottom')

  return (
    <div className={`border rounded-lg overflow-hidden ${
      isLive ? 'border-red-500/50 shadow-lg shadow-red-500/10' :
      isFinal ? 'border-white/10' :
      'border-white/10'
    } ${compact ? 'min-w-[160px]' : 'min-w-[200px]'} bg-hardwood/80`}>
      {/* Status bar */}
      {(isLive || isFinal) && (
        <div className={`px-2 py-0.5 text-xs font-body text-center ${
          isLive ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/30'
        }`}>
          {isLive
            ? `LIVE · ${liveData?.clock || ''} ${liveData?.period ? `· Q${liveData.period}` : ''}`
            : liveData?.statusDetail || 'Final'
          }
        </div>
      )}

      <div className="divide-y divide-white/10">
        <TeamCell
          team={game.top}
          isWinner={topWinner}
          score={topScore}
          gameStatus={gameStatus}
        />
        <TeamCell
          team={game.bottom}
          isWinner={bottomWinner}
          score={bottomScore}
          gameStatus={gameStatus}
        />
      </div>
    </div>
  )
}

// ── Region column ────────────────────────────────────────────────────────────
function RegionBracket({
  region,
  games,
  liveData,
  flip = false,
}: {
  region: string
  games: BracketGame[]
  liveData: Record<string, any>
  flip?: boolean
}) {
  const rounds = [1, 2, 3, 4]
  const colorClass = REGION_COLORS[region] || ''
  const borderColor = colorClass.split(' ').find(c => c.startsWith('border-')) || 'border-white/10'

  return (
    <div className={`${flip ? 'flex-row-reverse' : 'flex-row'} flex gap-2`}>
      {rounds.map(round => {
        const roundGames = games.filter(g => g.round === round)
        // Space out games vertically to align with bracket lines
        const spacingMap: Record<number, string> = {
          1: 'gap-2',
          2: 'gap-10',
          3: 'gap-28',
          4: 'gap-64',
        }
        return (
          <div key={round} className={`flex flex-col justify-around ${spacingMap[round]} min-w-0`}>
            {roundGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                liveData={liveData[game.id]}
                compact={round > 2}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Main bracket page ────────────────────────────────────────────────────────
export default function BracketPage() {
  const [bracketGames, setBracketGames] = useState<BracketGame[]>(BRACKET_2026)
  const [liveData, setLiveData] = useState<Record<string, any>>({})
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('')
  const [view, setView] = useState<'full' | 'East' | 'West' | 'Midwest' | 'South'>('full')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadScores = useCallback(async () => {
    try {
      // First load our own DB results (manual entries)
      const { data: dbGames } = await supabase
        .from('games')
        .select(`
          round,
          winner_score,
          loser_score,
          winner_team:winner_team_id(name, seed),
          loser_team:loser_team_id(name, seed)
        `)
        .eq('year', YEAR)
        .order('round')

      // Try ESPN auto-pull
      const espnRes = await fetch('/api/espn-scores')
      const espnData = await espnRes.json()

      if (espnData.source !== 'unavailable' && espnData.source !== 'error') {
        setLiveData(espnData.liveGames || {})
        setSource(espnData.source)
      }

      // Merge DB results into bracket
      if (dbGames && dbGames.length > 0) {
        setBracketGames(prev => {
          const updated = [...prev]
          // Update games we have results for in the DB
          // This is simplified — a full implementation would match by team names
          return updated
        })
        setSource(s => s ? `${s} + manual` : 'manual')
      }

      setLastUpdated(new Date().toLocaleTimeString())
    } catch {
      // Silently fail — bracket still shows static data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadScores()
    if (!autoRefresh) return
    const interval = setInterval(loadScores, 90000) // refresh every 90s
    return () => clearInterval(interval)
  }, [loadScores, autoRefresh])

  const eastGames = bracketGames.filter(g => g.region === 'East')
  const southGames = bracketGames.filter(g => g.region === 'South')
  const midwestGames = bracketGames.filter(g => g.region === 'Midwest')
  const westGames = bracketGames.filter(g => g.region === 'West')
  const ff1 = bracketGames.find(g => g.id === 'FF1')
  const ff2 = bracketGames.find(g => g.id === 'FF2')
  const champ = bracketGames.find(g => g.id === 'CHAMP')

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <SiteNav />

      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-5xl text-chalk tracking-wider">2026 BRACKET</h1>
            <div className="flex items-center gap-3 mt-1">
              {source && (
                <span className="text-white/30 text-xs font-body">
                  {source.includes('espn') ? '📡 ESPN live' : '📋 Manual'}
                  {lastUpdated && ` · ${lastUpdated}`}
                </span>
              )}
              {source?.includes('espn') && (
                <span className="flex items-center gap-1 text-xs font-body">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400">Auto-updating</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadScores}
              className="btn-secondary text-xs py-2 px-3"
            >
              ↻ Refresh
            </button>
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className={`text-xs font-body px-3 py-2 rounded-lg border transition-all ${autoRefresh ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-white/30'}`}
            >
              {autoRefresh ? '⏸ Auto-refresh on' : '▶ Auto-refresh off'}
            </button>
          </div>
        </div>

        {/* View switcher — useful on mobile */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['full', 'East', 'South', 'Midwest', 'West'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-xs font-body font-bold transition-all ${
                view === v ? 'bg-maize-500 text-blue-500' : 'bg-white/10 text-white/50 hover:bg-white/20'
              }`}
            >
              {v === 'full' ? '🏀 Full Bracket' : v}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-white/30 font-body text-sm animate-pulse">Loading bracket...</div>
          </div>
        ) : view !== 'full' ? (
          // Single region view (mobile friendly)
          <div className="overflow-x-auto pb-4">
            <div className="inline-flex gap-4 min-w-max">
              <RegionBracket
                region={view}
                games={view === 'East' ? eastGames : view === 'South' ? southGames : view === 'Midwest' ? midwestGames : westGames}
                liveData={liveData}
              />
            </div>
          </div>
        ) : (
          // Full bracket view
          <div className="overflow-x-auto pb-8">
            <div className="inline-block min-w-max">
              {/* Region labels */}
              <div className="flex gap-4 mb-3 justify-center">
                {(['East', 'South', 'Midwest', 'West'] as const).map(r => (
                  <div key={r} className={`text-xs font-display tracking-widest px-3 py-1 rounded border ${REGION_COLORS[r]} flex-1 text-center`}>
                    {r.toUpperCase()}
                  </div>
                ))}
              </div>

              {/* Main bracket layout */}
              <div className="flex gap-3 items-center">
                {/* LEFT SIDE — East + South */}
                <div className="flex gap-3">
                  {/* East */}
                  <div>
                    <div className={`text-xs font-display tracking-widest mb-2 text-center ${REGION_COLORS['East'].split(' ')[0]}`}>EAST</div>
                    <RegionBracket region="East" games={eastGames} liveData={liveData} />
                  </div>

                  {/* South */}
                  <div>
                    <div className={`text-xs font-display tracking-widest mb-2 text-center ${REGION_COLORS['South'].split(' ')[0]}`}>SOUTH</div>
                    <RegionBracket region="South" games={southGames} liveData={liveData} />
                  </div>
                </div>

                {/* CENTER — Final Four + Championship */}
                <div className="flex flex-col items-center gap-4 px-4 shrink-0">
                  <div className="text-xs font-display tracking-widest text-purple-400 mb-2">FINAL FOUR</div>

                  {ff1 && (
                    <GameCard game={ff1} liveData={liveData['FF1']} />
                  )}

                  <div className="my-2">
                    {champ && (
                      <div>
                        <div className="text-xs font-display tracking-widest text-yellow-400 text-center mb-2">CHAMPION</div>
                        <GameCard game={champ} liveData={liveData['CHAMP']} />
                      </div>
                    )}
                  </div>

                  {ff2 && (
                    <GameCard game={ff2} liveData={liveData['FF2']} />
                  )}
                </div>

                {/* RIGHT SIDE — Midwest + West (flipped) */}
                <div className="flex gap-3 flex-row-reverse">
                  {/* Midwest */}
                  <div>
                    <div className={`text-xs font-display tracking-widest mb-2 text-center ${REGION_COLORS['Midwest'].split(' ')[0]}`}>MIDWEST</div>
                    <RegionBracket region="Midwest" games={midwestGames} liveData={liveData} flip />
                  </div>

                  {/* West */}
                  <div>
                    <div className={`text-xs font-display tracking-widest mb-2 text-center ${REGION_COLORS['West'].split(' ')[0]}`}>WEST</div>
                    <RegionBracket region="West" games={westGames} liveData={liveData} flip />
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 justify-center text-xs font-body text-white/30">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live game</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-maize-500/20 rounded border border-maize-500/30 block" /> Winner / Advancing</div>
                <div className="flex items-center gap-1.5"><span className="text-emerald-400 font-bold text-sm">#9+</span> Underdog bonus eligible</div>
                <div className="flex items-center gap-1.5"><span className="text-white/20">faded</span> Eliminated</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
