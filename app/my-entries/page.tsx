'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

const TeamBadge = dynamic(() => import('@/components/TeamBadge'), { ssr: false })
const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const NavCTA = dynamic(() => import('@/components/NavCTA'), { ssr: false })
const SiteNav = dynamic(() => import('@/components/SiteNav'), { ssr: false })

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const DEADLINE = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')
const ENTRY_FEE = parseInt(process.env.NEXT_PUBLIC_ENTRY_FEE || '40')

interface Team {
  id: string
  name: string
  seed: number
  region: string
  eliminated_round: number | null
}

interface Entry {
  id: string
  nickname: string
  full_name: string
  tiebreaker: number | null
  total_points: number
  rank: number
  teams_alive: number
  teams: Team[]
  payment_received: boolean
}

const ROUND_NAMES: Record<number, string> = {
  1: 'R64', 2: 'R32', 3: 'S16', 4: 'E8', 5: 'F4', 6: 'Champ'
}

export default function MyEntriesPage() {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [printEntry, setPrintEntry] = useState<Entry | null>(null)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [allTeams, setAllTeams] = useState<Team[]>([])

  // Restore email from session
  useEffect(() => {
    const saved = sessionStorage.getItem('my_entries_email')
    const savedEmail = sessionStorage.getItem('my_entries_email')
    const savedPin = sessionStorage.getItem('my_entries_pin')
    if (savedEmail && savedPin) {
      setEmail(savedEmail)
      setPin(savedPin)
      loadEntries(savedEmail, savedPin)
    }
  }, [])

  const loadEntries = useCallback(async (emailAddr: string, pin: string) => {
    setLoading(true)
    setError('')

    // Find all participants with this email + PIN for this year
    const { data: participants } = await supabase
      .from('participants')
      .select('id, nickname, full_name, tiebreaker, entry_pin, payment_received')
      .eq('year', YEAR)
      .ilike('email', emailAddr.trim())

    if (!participants || participants.length === 0) {
      setError('No entries found for that email address.')
      setLoading(false)
      setSubmitted(true)
      return
    }

    // Only enforce PIN before tipoff — after tipoff picks are public
    const pastDeadline = new Date() >= DEADLINE
    if (!pastDeadline) {
      const pinMatches = participants.some(p => p.entry_pin === pin.trim())
      if (!pinMatches) {
        setError('Incorrect PIN. Check your confirmation screen or contact Matt to reset it.')
        setLoading(false)
        return
      }
    }

    // Get scores from view
    const ids = participants.map(p => p.id)
    const { data: scores } = await supabase
      .from('participant_scores')
      .select('participant_id, total_points, rank, teams_alive')
      .in('participant_id', ids)

    // Get picks for all entries
    const { data: picks } = await supabase
      .from('picks')
      .select(`participant_id, team:team_id(id, name, seed, region, eliminated_round)`)
      .in('participant_id', ids)

    // Build entries
    const built: Entry[] = participants.map(p => {
      const score = scores?.find(s => s.participant_id === p.id)
      const myPicks = (picks || [])
        .filter(pk => pk.participant_id === p.id)
        .map((pk: any) => pk.team as Team)
        .filter(Boolean)
        .sort((a, b) => a.seed - b.seed)

      return {
        id: p.id,
        nickname: p.nickname,
        full_name: p.full_name,
        tiebreaker: p.tiebreaker,
        total_points: score?.total_points ?? 0,
        rank: score?.rank ?? 0,
        teams_alive: score?.teams_alive ?? myPicks.filter(t => !t.eliminated_round).length,
        teams: myPicks,
        payment_received: p.payment_received ?? false,
      }
    }).sort((a, b) => a.rank - b.rank || b.total_points - a.total_points)

    setEntries(built)
    setSubmitted(true)
    setLoading(false)

    // Load all available teams for the edit modal
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, seed, region')
      .eq('year', YEAR)
      .order('seed')
    if (teams) setAllTeams(teams as Team[])
    sessionStorage.setItem('my_entries_email', emailAddr.trim())
    sessionStorage.setItem('my_entries_pin', pin.trim())
  }, [])

  function handleLookup() {
    if (!email.trim()) return
    const pastDeadline = new Date() >= DEADLINE
    if (!pastDeadline && pin.length !== 4) return
    loadEntries(email, pin)
  }

  // ── Edit Picks modal ────────────────────────────────────────────────────────
  // Load picks via secure API route (uses service role to bypass RLS deadline)
  // PIN is verified server-side before picks are returned
  async function loadPicksForEntry(participantId: string): Promise<Team[]> {
    try {
      const res = await fetch('/api/my-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, pin, year: YEAR })
      })
      if (!res.ok) return []
      const { teams } = await res.json()
      return (teams || []).sort((a: Team, b: Team) => a.seed - b.seed)
    } catch {
      return []
    }
  }

  async function savePickChange(entryId: string, removeTeamId: string, addTeamId: string) {
    // Remove old pick
    const { error: delErr } = await supabase
      .from('picks')
      .delete()
      .eq('participant_id', entryId)
      .eq('team_id', removeTeamId)
    if (delErr) return { error: delErr.message }

    // Add new pick
    const { error: insErr } = await supabase
      .from('picks')
      .insert({ participant_id: entryId, team_id: addTeamId, year: YEAR })
    if (insErr) return { error: insErr.message }

    // Refresh entries
    await loadEntries(email, pin)
    return { error: null }
  }

  // ── Print view ──────────────────────────────────────────────────────────────
  if (printEntry) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-8 print:p-4">
        <div className="max-w-2xl mx-auto">
          {/* Print header */}
          <div className="flex items-start justify-between mb-6 print:mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">{printEntry.nickname}</h1>
              {printEntry.full_name && (
                <p className="text-gray-500 text-sm">{printEntry.full_name}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">{YEAR} March "Bracketless" Madness</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-blue-900">{printEntry.total_points}</div>
              <div className="text-gray-400 text-xs uppercase tracking-widest">Total Points</div>
              {printEntry.rank > 0 && (
                <div className="text-blue-700 font-bold text-sm mt-1">Rank #{printEntry.rank}</div>
              )}
            </div>
          </div>

          <hr className="border-gray-200 mb-6" />

          {/* Teams */}
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Team Selections</h2>
          <div className="space-y-2 mb-8">
            {printEntry.teams.map(team => (
              <div
                key={team.id}
                className={`flex items-center justify-between py-3 px-4 rounded-lg border ${
                  team.eliminated_round
                    ? 'bg-gray-50 border-gray-100'
                    : 'bg-blue-50 border-blue-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${
                    team.seed === 1
                      ? 'bg-yellow-400 text-blue-900 ring-1 ring-yellow-600'
                      : team.seed <= 4
                        ? 'bg-yellow-300 text-blue-900'
                        : team.seed >= 9
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                  }`}>
                    #{team.seed}
                  </span>
                  <span className={`font-bold ${team.eliminated_round ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {team.name}
                  </span>
                  {team.seed >= 9 && !team.eliminated_round && (
                    <span className="text-green-600 text-xs font-bold">+3 underdog bonus</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs">{team.region}</div>
                  {team.eliminated_round
                    ? <div className="text-red-500 text-xs font-bold">Out after {ROUND_NAMES[team.eliminated_round]}</div>
                    : <div className="text-green-600 text-xs font-bold">Still alive ●</div>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Points', value: printEntry.total_points },
              { label: 'Teams Alive', value: `${printEntry.teams_alive} / 8` },
              { label: 'Tiebreaker', value: printEntry.tiebreaker ?? 'N/A' },
            ].map(s => (
              <div key={s.label} className="text-center bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="text-2xl font-black text-blue-900">{s.value}</div>
                <div className="text-gray-400 text-xs uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Scoring rules reminder */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-xs text-gray-400">
            <strong className="text-gray-600">Scoring:</strong> 1pt/win · +1–6pts per round advancement (S16 through Champ) · +3pts per underdog win (seed #9+) · +1pt per 10-pt margin
          </div>

          {/* Print button - hidden when printing */}
          <div className="mt-8 flex gap-3 print:hidden">
            <button onClick={() => window.print()} className="bg-blue-900 text-yellow-400 font-bold px-6 py-3 rounded-lg hover:bg-blue-800 transition-colors">
              🖨️ Print This Entry
            </button>
            <button onClick={() => setPrintEntry(null)} className="bg-gray-100 text-gray-700 font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors">
              ← Back to My Entries
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Edit Picks Modal ────────────────────────────────────────────────────────
  function EditPicksModal({ entry }: { entry: Entry }) {
    const [swapping, setSwapping] = useState<string | null>(null) // team id being swapped out
    const [replacementId, setReplacementId] = useState('')
    const [saving, setSaving] = useState(false)
    const [localError, setLocalError] = useState('')

    // Seed rules: must have 1×#1, 3×#2-4, 4×#5+
    function getSeedGroup(seed: number) {
      if (seed === 1) return '1'
      if (seed <= 4) return '2-4'
      return '5+'
    }

    function getEligibleReplacements(removingSeed: number) {
      const group = getSeedGroup(removingSeed)
      const currentIds = new Set(entry.teams.map(t => t.id))
      return allTeams.filter(t => {
        if (currentIds.has(t.id)) return false // already picked
        return getSeedGroup(t.seed) === group // same seed group
      })
    }

    async function handleSwap(removeTeamId: string) {
      if (!replacementId) return
      setSaving(true)
      setLocalError('')
      const { error } = await savePickChange(entry.id, removeTeamId, replacementId)
      if (error) {
        setLocalError(error)
      } else {
        setSwapping(null)
        setReplacementId('')
        setEditingEntry(null) // close modal — entries reloaded by savePickChange
      }
      setSaving(false)
    }

    const removingTeam = entry.teams.find(t => t.id === swapping)
    const eligible = swapping ? getEligibleReplacements(removingTeam!.seed) : []

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="card max-w-lg w-full p-0 overflow-hidden border-maize-500/40">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-maize-500/10">
            <div>
              <h2 className="font-display text-2xl text-chalk tracking-wider">EDIT PICKS</h2>
              <p className="text-white/50 text-sm font-body">{entry.nickname} · closes at tip-off</p>
            </div>
            <button onClick={() => setEditingEntry(null)} className="text-white/30 hover:text-white/70 text-2xl">✕</button>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3">
            <p className="text-white/40 text-xs font-body">
              Click <strong className="text-white/60">Swap</strong> next to any team to replace it with another from the same seed group. Seed rules still apply.
            </p>

            {entry.teams.map(team => (
              <div key={team.id} className={`rounded-lg border overflow-hidden ${swapping === team.id ? 'border-maize-500/50 bg-maize-500/5' : 'border-white/10 bg-white/5'}`}>
                {/* Team row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <TeamBadge name={team.name} seed={team.seed} showRecord={true} size="sm" />
                  {swapping === team.id ? (
                    <button
                      onClick={() => { setSwapping(null); setReplacementId('') }}
                      className="text-white/40 hover:text-white/70 text-xs font-body shrink-0 ml-2"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => { setSwapping(team.id); setReplacementId('') }}
                      disabled={saving}
                      className="px-3 py-1 rounded-full text-xs font-bold font-body bg-white/10 text-white/50 hover:bg-maize-500/20 hover:text-maize-400 transition-all shrink-0 ml-2"
                    >
                      Swap
                    </button>
                  )}
                </div>

                {/* Replacement selector — shown when this team is being swapped */}
                {swapping === team.id && (
                  <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
                    <p className="text-white/40 text-xs font-body">
                      Replace with a #{team.seed <= 1 ? '1' : team.seed <= 4 ? '2–4' : '5+'} seed:
                    </p>
                    <select
                      value={replacementId}
                      onChange={e => { setReplacementId(e.target.value); setLocalError('') }}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-chalk font-body text-sm focus:outline-none focus:border-maize-500"
                    >
                      <option value="">Choose a replacement team...</option>
                      {eligible.map(t => (
                        <option key={t.id} value={t.id}>
                          #{t.seed} {t.name} ({t.region})
                        </option>
                      ))}
                    </select>
                    {localError && <p className="text-red-400 text-xs font-body">{localError}</p>}
                    <button
                      onClick={() => handleSwap(team.id)}
                      disabled={!replacementId || saving}
                      className={`w-full py-2 rounded-lg font-bold font-body text-sm transition-all ${replacementId && !saving ? 'btn-primary' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                    >
                      {saving ? 'Saving...' : `Swap ${team.name} → selected team`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-white/10">
            <p className="text-white/20 text-xs font-body">Changes save instantly. You can make as many swaps as you like before tip-off.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Main page ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <SiteNav />

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-6xl text-chalk tracking-wider">MY ENTRIES</h1>
          <p className="text-white/40 font-body mt-2">Before tip-off, use your PIN to keep your picks private. After tip-off, everyone can see all picks openly.</p>
        </div>

        {/* Edit Picks modal */}
      {editingEntry && new Date() < DEADLINE && (
        <EditPicksModal entry={editingEntry} />
      )}

      {/* Email lookup */}
        {(!submitted || entries.length === 0) && (
          <div className="card p-6 mb-8 max-w-md">
            <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-4">FIND YOUR ENTRIES</h2>
            <p className="text-white/50 font-body text-sm mb-4">
              Enter the email you used when submitting your picks.
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleLookup()}
              placeholder="your@email.com"
              className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body focus:outline-none focus:border-maize-500 placeholder:text-white/20 mb-4"
            />
{new Date() < DEADLINE && <label className="text-white/50 text-sm font-body block mb-2">4-Digit PIN <span className="text-white/30 font-normal">(keeps picks private until tip-off)</span></label>}
{new Date() < DEADLINE && (
              <>
                <input
                  type="number"
                  value={pin}
                  onChange={e => setPin(e.target.value.slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  placeholder="••••"
                  maxLength={4}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body focus:outline-none focus:border-maize-500 placeholder:text-white/20 mb-4 tracking-[0.5em] text-center text-xl"
                />
                <p className="text-white/20 text-xs font-body mb-4">Your PIN was set when you submitted picks. It keeps your selections private until tip-off. Contact Matt if you've forgotten it.</p>
              </>
            )}
            {error && <p className="text-red-400 text-sm font-body mb-3">{error}</p>}
            <button
              onClick={handleLookup}
              disabled={!email.trim() || (new Date() < DEADLINE && pin.length !== 4) || loading}
              className={`w-full py-3 rounded-lg font-bold font-body transition-all ${email.trim() && (new Date() >= DEADLINE || pin.length === 4) ? 'btn-primary' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
            >
              {loading ? 'Looking up...' : 'View My Entries →'}
            </button>
          </div>
        )}

        {/* Results */}
        {submitted && entries.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white/50 font-body text-sm">
                  Showing <strong className="text-chalk">{entries.length}</strong> {entries.length === 1 ? 'entry' : 'entries'} for <strong className="text-maize-400">{email}</strong>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSubmitted(false); setEntries([]); setError(''); setPin('') }}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  Look up different email
                </button>
                <button
                  onClick={() => loadEntries(email)}
                  className="btn-secondary text-sm py-2 px-4"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {entries.map((entry, idx) => {
                const alive = entry.teams.filter(t => !t.eliminated_round)
                const eliminated = entry.teams.filter(t => t.eliminated_round)

                return (
                  <div key={entry.id} className={`card overflow-hidden ${idx === 0 && entry.rank > 0 ? 'border-maize-500/30' : ''}`}>
                    {/* Entry header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <div className="flex items-center gap-4">
                        {entry.rank > 0 && (
                          <div className={`font-display text-3xl tracking-wider ${
                            entry.rank === 1 ? 'text-yellow-400' :
                            entry.rank === 2 ? 'text-slate-300' :
                            entry.rank === 3 ? 'text-amber-600' : 'text-white/30'
                          }`}>
                            {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
                          </div>
                        )}
                        <div>
                          <div className="font-body font-bold text-chalk text-lg">{entry.nickname}</div>
                          {entry.full_name && <div className="text-white/30 text-xs font-body">{entry.full_name}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="font-display text-4xl text-maize-400 tracking-wider">{entry.total_points}</div>
                          <div className="text-white/30 text-xs font-body">pts</div>
                        </div>
                        <div className="text-center">
                          <div className="font-display text-2xl text-white/60 tracking-wider">{entry.teams_alive}</div>
                          <div className="text-white/30 text-xs font-body">alive</div>
                        </div>
                        {new Date() < DEADLINE && (
                          <button
                            onClick={async () => {
                              // Load fresh picks directly so RLS timing doesn't matter
                              const freshTeams = await loadPicksForEntry(entry.id)
                              setEditingEntry({ ...entry, teams: freshTeams })
                            }}
                            className="btn-primary text-xs py-2 px-3"
                            title="Edit picks before tip-off"
                          >
                            ✏️ Edit Picks
                          </button>
                        )}
                        <button
                          onClick={() => setPrintEntry(entry)}
                          className="btn-secondary text-xs py-2 px-3"
                          title="Print this entry"
                        >
                          🖨️ Print
                        </button>
                      </div>
                    </div>

                    {/* Teams */}
                    <div className="px-6 py-5">
                      {/* Still alive */}
                      {alive.length > 0 && (
                        <div className="mb-4">
                          <div className="text-emerald-400 text-xs font-body font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                            Still in the tournament ({alive.length})
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {alive.map(team => (
                              <div key={team.id} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5">
                                <TeamBadge name={team.name} seed={team.seed} showRecord={true} size="sm" />
                                <span className="text-emerald-400 text-xs font-body shrink-0 ml-2">
                                  {team.seed >= 9 ? '+3 bonus ●' : '●'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Eliminated */}
                      {eliminated.length > 0 && (
                        <div>
                          <div className="text-white/30 text-xs font-body font-bold uppercase tracking-widest mb-3">
                            Eliminated ({eliminated.length})
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {eliminated.map(team => (
                              <div key={team.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 opacity-50">
                                <TeamBadge name={team.name} seed={team.seed} showRecord={false} size="sm" eliminated />
                                <span className="text-red-400 text-xs font-body shrink-0 ml-2">
                                  Out {ROUND_NAMES[team.eliminated_round!]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No picks yet */}
                      {entry.teams.length === 0 && (
                        <p className="text-white/20 text-sm font-body italic">Picks not loaded yet.</p>
                      )}
                    </div>

                    {/* Footer */}
                    {entry.tiebreaker && (
                      <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-white/30 text-xs font-body">Tiebreaker: {entry.tiebreaker} total pts in championship</span>
                        <Link href={`/leaderboard`} className="text-maize-500 text-xs font-body hover:text-maize-400 transition-colors">
                          Full leaderboard →
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Submit another entry CTA */}
            <div className="card p-5 mt-8 flex items-center justify-between">
              <div>
                <div className="font-body font-bold text-chalk">Want to enter again?</div>
                <div className="text-white/40 text-sm font-body">Submit another set of 8 picks under a new nickname</div>
              </div>
              <Link href="/enter" className="btn-primary shrink-0">Submit Another Entry →</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
