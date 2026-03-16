'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
const Countdown = dynamic(() => import('@/components/Countdown'), { ssr: false })
const TeamBadge = dynamic(() => import('@/components/TeamBadge'), { ssr: false })

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const DEADLINE = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')

interface Team {
  id: string
  name: string
  seed: number
  region: string
  eliminated_round: number | null
}

interface Participant {
  id: string
  nickname: string
  full_name: string
}

interface Pick {
  participant_id: string
  team: Team
}

interface TeamStat {
  team: Team
  count: number
  pct: number
  participants: string[]
}

export default function PicksPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [allPicks, setAllPicks] = useState<Record<string, Team[]>>({})
  const [teamStats, setTeamStats] = useState<TeamStat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null)
  const [view, setView] = useState<'participants' | 'teams'>('participants')
  const [isOpen, setIsOpen] = useState(new Date() < DEADLINE)
  const [participantCount, setParticipantCount] = useState<number>(0)

  useEffect(() => {
    setIsOpen(new Date() < DEADLINE)
    // Always load participant count regardless of deadline
    supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('year', YEAR)
      .then(({ count }) => setParticipantCount(count ?? 0))

    // Auto-refresh count every 30 seconds while entries are open
    const interval = setInterval(() => {
      supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('year', YEAR)
        .then(({ count }) => setParticipantCount(count ?? 0))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isOpen) return // Don't load picks until entries close
    async function load() {
      // Load all participants
      const { data: parts } = await supabase
        .from('participants')
        .select('id, nickname, full_name')
        .eq('year', YEAR)
        .order('nickname')

      if (!parts) { setLoading(false); return }
      setParticipants(parts)

      // Load all picks with team details
      const { data: picks } = await supabase
        .from('picks')
        .select(`participant_id, team:team_id(id, name, seed, region, eliminated_round)`)
        .eq('year', YEAR)

      if (!picks) { setLoading(false); return }

      // Group picks by participant
      const byParticipant: Record<string, Team[]> = {}
      parts.forEach(p => { byParticipant[p.id] = [] })
      picks.forEach((pick: any) => {
        if (pick.team && byParticipant[pick.participant_id]) {
          byParticipant[pick.participant_id].push(pick.team)
        }
      })
      // Sort each participant's picks by seed
      Object.keys(byParticipant).forEach(id => {
        byParticipant[id].sort((a, b) => a.seed - b.seed)
      })
      setAllPicks(byParticipant)

      // Build team popularity stats
      const teamMap: Record<string, TeamStat> = {}
      picks.forEach((pick: any) => {
        if (!pick.team) return
        const t = pick.team as Team
        const part = parts.find(p => p.id === pick.participant_id)
        if (!teamMap[t.id]) {
          teamMap[t.id] = { team: t, count: 0, pct: 0, participants: [] }
        }
        teamMap[t.id].count++
        if (part) teamMap[t.id].participants.push(part.nickname)
      })
      const total = parts.length || 1
      const stats = Object.values(teamMap).map(s => ({
        ...s,
        pct: Math.round((s.count / total) * 100)
      })).sort((a, b) => b.count - a.count)
      setTeamStats(stats)
      setLoading(false)
    }
    load()
  }, [isOpen])

  // Still open — show countdown with friendly message
  if (isOpen) {
    return (
      <div className="min-h-screen bg-hardwood court-texture">
        <nav className="border-b border-white/10 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-display text-xl tracking-widest text-chalk">
              🏀 March "Bracketless" Madness
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/bracket" className="nav-link">Bracket</Link>
              <Link href="/history" className="nav-link">History</Link>
            <Link href="/my-entries" className="nav-link">My Entries</Link>
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="text-7xl mb-6">🏀</div>
          <h1 className="font-display text-6xl text-chalk tracking-wider mb-4">ALL PICKS</h1>
          <p className="text-white/60 font-body text-lg mb-2">
            Everyone's selections will be revealed the moment the tournament tips off.
          </p>
          <p className="text-white/40 font-body text-sm mb-10">
            Until then, your picks are your secret weapon. 🤫
          </p>

          {/* Live participant count */}
          <div className="card p-6 mb-8 inline-block min-w-64">
            <div className="font-display text-6xl text-maize-400 tracking-wider">{participantCount}</div>
            <div className="text-white/40 text-sm font-body uppercase tracking-widest mt-1">
              {participantCount === 1 ? 'Participant Entered' : 'Participants Entered'}
            </div>
            <div className="text-white/20 text-xs font-body mt-2">updates every 30 seconds</div>
          </div>

          {/* Countdown */}
          <div className="mb-10">
            <Countdown deadline={DEADLINE} onExpired={() => setIsOpen(false)} />
          </div>

          <div className="flex gap-3 justify-center">
            <Link href="/enter" className="btn-primary px-8 py-3">Submit Your Picks →</Link>
            <Link href="/" className="btn-secondary px-8 py-3">Home</Link>
          </div>
        </div>
      </div>
    )
  }

  const filteredParticipants = participants.filter(p =>
    p.nickname.toLowerCase().includes(search.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const selected = selectedParticipant
    ? participants.find(p => p.id === selectedParticipant)
    : null
  const selectedPicks = selectedParticipant ? allPicks[selectedParticipant] || [] : []

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display text-xl tracking-widest text-chalk">
            🏀 March "Bracketless" Madness
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/bracket" className="nav-link">Bracket</Link>
            <Link href="/history" className="nav-link">History</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-6xl text-chalk tracking-wider">ALL PICKS</h1>
          <p className="text-white/40 font-body mt-2">{participants.length} participants · {YEAR} Tournament</p>
        </div>

        {/* View toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('participants')}
            className={`px-5 py-2 rounded-lg font-body font-bold text-sm transition-all ${view === 'participants' ? 'bg-maize-500 text-blue-500' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >
            👤 By Participant ({participants.length})
          </button>
          <button
            onClick={() => setView('teams')}
            className={`px-5 py-2 rounded-lg font-body font-bold text-sm transition-all ${view === 'teams' ? 'bg-maize-500 text-blue-500' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
          >
            🏀 By Team Popularity ({teamStats.length})
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="card p-5 h-40 shimmer" />
            ))}
          </div>
        ) : view === 'participants' ? (
          <>
            {/* Search */}
            <input
              type="text"
              placeholder="Search participant..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-chalk font-body text-sm focus:outline-none focus:border-maize-500 placeholder:text-white/20 w-64 mb-6"
            />

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParticipants.map(participant => {
                const picks = allPicks[participant.id] || []
                return (
                  <button
                    key={participant.id}
                    onClick={() => setSelectedParticipant(
                      selectedParticipant === participant.id ? null : participant.id
                    )}
                    className={`card-hover p-5 text-left transition-all ${selectedParticipant === participant.id ? 'border-maize-500/50 bg-maize-500/10' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-body font-bold text-chalk">{participant.nickname}</div>
                        {participant.full_name && (
                          <div className="text-white/30 text-xs font-body">{participant.full_name}</div>
                        )}
                      </div>
                      <div className="text-white/20 text-xs font-body">{picks.length} picks</div>
                    </div>
                    {picks.length > 0 ? (
                      <div className="space-y-1.5">
                        {picks.map(team => (
                          <TeamBadge
                            key={team.id}
                            name={team.name}
                            seed={team.seed}
                            showRecord={true}
                            size="sm"
                            eliminated={!!team.eliminated_round}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/20 text-xs font-body italic">No picks recorded</p>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          /* Team popularity view */
          <div className="space-y-3">
            {/* Seed filter */}
            <div className="grid gap-3">
              {/* #1 seeds */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(seed => {
                const seedTeams = teamStats.filter(s => s.team.seed === seed)
                if (seedTeams.length === 0) return null
                return (
                  <div key={seed}>
                    <div className="flex items-center gap-3 mb-2">
                      <SeedBadge seed={seed} />
                      <span className="text-white/30 text-xs font-body uppercase tracking-wider">
                        Seed {seed} {seed >= 9 ? '· +3 underdog bonus' : ''}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 mb-1">
                      {seedTeams.map(({ team, count, pct, participants: pList }) => (
                        <div key={team.id} className="card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <TeamBadge name={team.name} seed={team.seed} showRecord={true} showSeed={false} size="sm" />
                            <div className="text-right">
                              <span className="font-display text-2xl text-maize-400 tracking-wider">{pct}%</span>
                              <span className="text-white/30 text-xs font-body ml-1">({count})</span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                            <div
                              className="bg-maize-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {/* Who picked them */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pList.slice(0, 8).map(nick => (
                              <span key={nick} className="text-white/40 text-xs font-body bg-white/5 px-1.5 py-0.5 rounded">
                                {nick}
                              </span>
                            ))}
                            {pList.length > 8 && (
                              <span className="text-white/30 text-xs font-body">+{pList.length - 8} more</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Participant detail modal */}
        {selected && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedParticipant(null)}
          >
            <div
              className="card max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display text-4xl text-chalk tracking-wider">{selected.nickname}</h2>
                  {selected.full_name && (
                    <p className="text-white/40 font-body text-sm">{selected.full_name}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedParticipant(null)}
                  className="text-white/30 hover:text-white/70 text-2xl"
                >✕</button>
              </div>

              <h3 className="font-display text-xl text-maize-400 tracking-wider mb-4">
                THEIR 8 PICKS
              </h3>

              <div className="space-y-2 mb-6">
                {selectedPicks.map(team => (
                  <div key={team.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                    team.eliminated_round
                      ? 'bg-white/5 border-white/10 opacity-50'
                      : 'bg-maize-500/5 border-maize-500/20'
                  }`}>
                    <div className="flex items-center gap-3">
                      <SeedBadge seed={team.seed} />
                      <span className={`font-body font-bold ${team.eliminated_round ? 'line-through text-white/40' : 'text-chalk'}`}>
                        {team.name}
                      </span>
                      {team.seed >= 9 && !team.eliminated_round && (
                        <span className="text-emerald-400 text-xs font-body">+3 bonus</span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-white/30 text-xs font-body">{team.region}</div>
                      {team.eliminated_round && (
                        <div className="text-red-400 text-xs font-body">Out R{team.eliminated_round}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* How popular were their picks? */}
              <div className="card p-4">
                <h4 className="text-white/40 text-xs font-body uppercase tracking-widest mb-3">Pick Popularity</h4>
                <div className="space-y-1.5">
                  {selectedPicks.map(team => {
                    const stat = teamStats.find(s => s.team.id === team.id)
                    return (
                      <div key={team.id} className="flex items-center justify-between text-sm font-body">
                        <span className="text-white/60 truncate mr-4">{team.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 bg-white/10 rounded-full h-1">
                            <div
                              className="bg-maize-500/60 h-1 rounded-full"
                              style={{ width: `${stat?.pct || 0}%` }}
                            />
                          </div>
                          <span className="text-maize-400 font-bold w-10 text-right">
                            {stat?.pct || 0}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
