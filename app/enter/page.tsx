'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { validateSelections } from '@/lib/scoring'
import Countdown from '@/components/Countdown'
const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const NavCTA = dynamic(() => import('@/components/NavCTA'), { ssr: false })
const ObfuscatedEmail = dynamic(() => import('@/components/ObfuscatedEmail'), { ssr: false })
const TeamBadge = dynamic(() => import('@/components/TeamBadge'), { ssr: false })
const SiteNav = dynamic(() => import('@/components/SiteNav'), { ssr: false })

const DEADLINE = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const POOL_PASSWORD = 'mgoblue'
const PASS_KEY = 'bracketless_auth'

interface Team {
  id: string
  name: string
  seed: number
  region: string
  is_playin_pair: boolean
  playin_partner: string | null
}

function SeedBadge({ seed }: { seed: number }) {
  const cls = seed === 1 ? 'seed-1' : seed <= 4 ? 'seed-2' : seed >= 9 ? 'seed-9plus' : 'seed-5plus'
  return <span className={`seed-badge ${cls}`}>#{seed}</span>
}

export default function EnterPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [form, setForm] = useState({ nickname: '', fullName: '', email: '', tiebreaker: '', pin: '' })
  const [step, setStep] = useState<'picks' | 'info' | 'done'>('picks')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | '1' | '2-4' | '5+'>('all')
  const [unlocked, setUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [entriesOpen, setEntriesOpen] = useState(new Date() < DEADLINE)
  const [showScoring, setShowScoring] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(PASS_KEY) === 'true' || localStorage.getItem(PASS_KEY) === 'true') setUnlocked(true)
  }, [])

  useEffect(() => {
    supabase.from('teams').select('*').eq('year', YEAR).order('seed').then(({ data }) => {
      if (data) setTeams(data)
    })
  }, [])

  const selectedTeams = teams.filter(t => selected.includes(t.id))

  const validationResult = validateSelections(
    selectedTeams.map(t => ({ teamId: t.id, seed: t.seed }))
  )

  function toggleTeam(teamId: string) {
    setSelected(prev => {
      if (prev.includes(teamId)) return prev.filter(id => id !== teamId)
      if (prev.length >= 8) return prev
      return [...prev, teamId]
    })
  }

  const filteredTeams = teams.filter(t => {
    if (filter === '1') return t.seed === 1
    if (filter === '2-4') return t.seed >= 2 && t.seed <= 4
    if (filter === '5+') return t.seed >= 5
    return true
  })

  // Group by region
  const regions = ['East', 'West', 'South', 'Midwest']
  const byRegion = regions.map(region => ({
    region,
    teams: filteredTeams.filter(t => t.region === region),
  })).filter(g => g.teams.length > 0)

  // If no regions assigned, just show flat list
  const hasRegions = teams.some(t => t.region)

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      // Check for duplicate nickname
      const { data: existing } = await supabase
        .from('participants')
        .select('id')
        .eq('year', YEAR)
        .eq('nickname', form.nickname.trim())
        .single()

      if (existing) {
        setError(`The nickname "${form.nickname.trim()}" is already taken. Try adding a number like ${form.nickname.trim()}2.`)
        setLoading(false)
        return
      }

      // Create participant
      const { data: participant, error: pErr } = await supabase
        .from('participants')
        .insert({
          year: YEAR,
          nickname: form.nickname.trim(),
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          tiebreaker: form.tiebreaker ? parseInt(form.tiebreaker) : null,
          entry_pin: form.pin.trim(),
        })
        .select()
        .single()

      if (pErr) throw new Error(pErr.message)

      // Insert picks
      const picks = selected.map(teamId => ({
        participant_id: participant.id,
        team_id: teamId,
        year: YEAR,
      }))

      const { error: pickErr } = await supabase.from('picks').insert(picks)
      if (pickErr) throw new Error(pickErr.message)

      sessionStorage.setItem('bracketless_entered', 'true')
      localStorage.setItem('bracketless_entered', 'true')
      setStep('done')
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function isPinValid(pin: string) {
    return /^[0-9]{4}$/.test(pin)
  }

  function handlePasswordSubmit() {
    if (passwordInput.toLowerCase().trim() === POOL_PASSWORD) {
      sessionStorage.setItem(PASS_KEY, 'true')
      localStorage.setItem(PASS_KEY, 'true')
      setUnlocked(true)
    } else {
      setPasswordError('Wrong password. Ask Matt for the password!')
      setPasswordInput('')
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-hardwood court-texture flex items-center justify-center p-6">
        <div className="card max-w-sm w-full p-5 sm:p-8 text-center">
          <div className="text-6xl mb-4">🏀</div>
          <h1 className="font-display text-4xl text-chalk tracking-wider mb-2">SUBMIT YOUR ENTRIES</h1>
          <p className="text-white/40 font-body text-sm mb-6">You need the password to participate. Ask Matt if you don't have it!</p>
          <input
            type="password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="Enter password..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-chalk font-body text-center text-lg focus:outline-none focus:border-maize-500 placeholder:text-white/20 mb-4 tracking-widest"
          />
          {passwordError && (
            <p className="text-red-400 text-sm font-body mb-4">{passwordError}</p>
          )}
          <button
            onClick={handlePasswordSubmit}
            className="btn-primary w-full text-lg py-3 mb-4"
          >
            Submit Entries →
          </button>

          {/* Returning visitor path */}
          <div className="border-t border-white/10 pt-4 mt-2">
            <p className="text-white/30 text-xs font-body mb-3">Already submitted? View or edit your picks:</p>
            <Link
              href="/my-entries"
              className="block w-full py-2.5 rounded-lg font-bold font-body text-sm bg-white/10 text-white/60 hover:bg-white/20 hover:text-chalk transition-all"
            >
              Go to My Entries →
            </Link>
          </div>

          <Link href="/" className="block mt-4 text-white/30 text-xs font-body hover:text-white/50 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (!entriesOpen) {
    return (
      <div className="min-h-screen bg-hardwood court-texture flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="font-display text-4xl text-chalk tracking-wider mb-3">ENTRIES CLOSED</h1>
          <p className="text-white/50 font-body mb-6">
            The entry window closed at the first tip-off of the tournament.
            Check the leaderboard to see how everyone is doing!
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/leaderboard" className="btn-primary">View Leaderboard</Link>
            <Link href="/picks" className="btn-secondary">View All Picks</Link>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-hardwood court-texture flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">🏀</div>
          <h1 className="font-display text-6xl text-maize-400 tracking-wider mb-4">YOU'RE IN!</h1>
          <p className="text-white/60 mb-2 font-body">
            <strong className="text-chalk">{form.nickname}</strong>'s picks have been submitted.
          </p>
          <div className="card p-4 mb-6 border-maize-500/30 bg-maize-500/5">
            <div className="text-maize-400 font-bold font-body text-sm mb-1">🔑 Remember your PIN: <span className="font-display text-2xl tracking-widest">{form.pin}</span></div>
            <div className="text-white/40 text-xs font-body">Your picks are private until tip-off. Use this PIN + your email to view them beforehand on the My Entries page.</div>
          </div>
          <p className="text-white/40 text-sm mb-8 font-body">
            Don't forget to send your entry fee via Venmo or Zelle to <ObfuscatedEmail />
          </p>
          <div className="card p-5 mb-8 text-left">
            <h3 className="font-display text-xl text-maize-400 tracking-wider mb-3">YOUR PICKS</h3>
            <div className="space-y-2">
              {selectedTeams.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <span className="font-body text-chalk">{t.is_playin_pair ? `${t.name}/${t.playin_partner}` : t.name}</span>
                  <SeedBadge seed={t.seed} />
                </div>
              ))}
            </div>
            {form.tiebreaker && (
              <div className="mt-3 pt-3 border-t border-white/10 text-white/50 text-sm font-body">
                Tiebreaker: {form.tiebreaker} total points
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/leaderboard" className="btn-primary">View Leaderboard</Link>
            <button
              onClick={() => {
                setStep('picks')
                setSelected([])
                setForm(f => ({ ...f, nickname: '', tiebreaker: '' }))
              }}
              className="btn-secondary"
            >
              Submit Another Entry
            </button>
            <Link href="/my-entries" className="btn-secondary">My Entries</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      {/* Nav */}
      <SiteNav />

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="font-display text-6xl text-chalk tracking-wider mb-2">SUBMIT YOUR PICKS</h1>
          <p className="text-white/50 font-body">Select 8 teams following the seed rules below.</p>
        </div>

        {/* Countdown */}
        <div className="mb-6">
          <Countdown deadline={DEADLINE} onExpired={() => setEntriesOpen(false)} />
        </div>

        {/* Scoring quick reference */}
        <div className="mb-6">
          <button
            onClick={() => setShowScoring(s => !s)}
            className="flex items-center gap-2 text-sm font-body text-maize-400 hover:text-maize-300 transition-colors"
          >
            <span className={`transition-transform duration-200 ${showScoring ? 'rotate-90' : ''}`}>▶</span>
            {showScoring ? 'Hide' : 'Show'} scoring guide
          </button>

          {showScoring && (
            <div className="mt-3 card p-5 border-maize-500/20">
              <h3 className="font-display text-lg text-maize-400 tracking-wider mb-3">HOW SCORING WORKS</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-body mb-4">
                <div className="text-white/40">Round of 64 win</div><div className="text-chalk font-bold">1 pt</div>
                <div className="text-white/40">Round of 32 win</div><div className="text-chalk font-bold">2 pts</div>
                <div className="text-white/40">Sweet 16 win</div><div className="text-chalk font-bold">3 pts</div>
                <div className="text-white/40">Elite 8 win</div><div className="text-chalk font-bold">4 pts</div>
                <div className="text-white/40">Final Four win</div><div className="text-chalk font-bold">5 pts</div>
                <div className="text-white/40">Championship win</div><div className="text-chalk font-bold">6 pts</div>
              </div>
              <div className="space-y-2 text-xs font-body border-t border-white/10 pt-3">
                <div><span className="text-emerald-400 font-bold">+3 pts</span> <span className="text-white/50">for any win by seed #9 or lower</span> <span className="text-white/30 italic">— this is why picking underdogs matters!</span></div>
                <div><span className="text-maize-400 font-bold">+1 pt</span> <span className="text-white/50">per 10-point margin of victory</span> <span className="text-white/30 italic">(win by 22 = +2 pts)</span></div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 bg-white/5 rounded-lg px-3 py-2 text-xs font-body text-white/40 italic">
                💡 Example: your #12 seed wins the Round of 64 by 18 points → 1 pt + 3 pts (underdog) + 1 pt (margin) = <span className="text-chalk font-bold not-italic">5 pts</span>
              </div>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="flex gap-2 mb-8">
          {['picks', 'info'].map((s, i) => (
            <div key={s} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body ${step === s ? 'bg-maize-500 text-white' : 'bg-white/10 text-white/40'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-white text-maize-500' : 'bg-white/20'}`}>{i + 1}</span>
              {s === 'picks' ? 'Select Teams' : 'Your Info'}
            </div>
          ))}
        </div>

        {step === 'picks' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Team selector */}
            <div className="lg:col-span-2">
              {/* Seed filter */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {[
                  { key: 'all', label: 'All Teams' },
                  { key: '1', label: '#1 Seeds' },
                  { key: '2-4', label: '#2–4 Seeds' },
                  { key: '5+', label: '#5+ Seeds' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key as any)}
                    className={`px-4 py-1.5 rounded-full text-sm font-body transition-all ${filter === f.key ? 'bg-maize-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {teams.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="text-white/30 text-4xl mb-3">⏳</div>
                  <p className="text-white/40 font-body">Teams haven't been loaded yet.</p>
                  <p className="text-white/30 text-sm font-body mt-1">Check back once the tournament bracket is set.</p>
                </div>
              ) : hasRegions ? (
                <div className="space-y-6">
                  {byRegion.map(({ region, teams: rTeams }) => (
                    <div key={region}>
                      <h3 className="font-display text-xl text-maize-500/70 tracking-widest mb-3">{region.toUpperCase()}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rTeams.map(team => {
                          const isSelected = selected.includes(team.id)
                          const canSelect = selected.length < 8 || isSelected
                          return (
                            <button
                              key={team.id}
                              onClick={() => canSelect && toggleTeam(team.id)}
                              disabled={!canSelect}
                              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-150 font-body
                                ${isSelected
                                  ? 'bg-maize-500/20 border-maize-500 text-chalk'
                                  : canSelect
                                    ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                                    : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                                }`}
                            >
                              <SeedBadge seed={team.seed} />
                              <span className="font-medium text-sm flex-1">
                                {team.is_playin_pair ? `${team.name}/${team.playin_partner}` : team.name}
                              </span>
                              {isSelected && <span className="text-maize-400 text-xs">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredTeams.map(team => {
                    const isSelected = selected.includes(team.id)
                    const canSelect = selected.length < 8 || isSelected
                    return (
                      <button
                        key={team.id}
                        onClick={() => canSelect && toggleTeam(team.id)}
                        disabled={!canSelect}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-150 font-body
                          ${isSelected
                            ? 'bg-maize-500/20 border-maize-500 text-chalk'
                            : canSelect
                              ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                              : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                          }`}
                      >
                        <SeedBadge seed={team.seed} />
                        <span className="font-medium text-sm flex-1">
                          {team.is_playin_pair ? `${team.name}/${team.playin_partner}` : team.name}
                        </span>
                        {isSelected && <span className="text-maize-400 text-xs">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selection summary */}
            <div className="space-y-4">
              <div className="card p-5 sticky top-6">
                <h3 className="font-display text-2xl text-maize-400 tracking-wider mb-4">
                  YOUR PICKS ({selected.length}/8)
                </h3>

                {/* Requirements checklist */}
                <div className="space-y-2 mb-5">
                  {[
                    { label: '#1 Seed', check: selectedTeams.filter(t => t.seed === 1).length === 1, count: `${selectedTeams.filter(t => t.seed === 1).length}/1` },
                    { label: '#2–4 Seeds', check: selectedTeams.filter(t => t.seed >= 2 && t.seed <= 4).length === 3, count: `${selectedTeams.filter(t => t.seed >= 2 && t.seed <= 4).length}/3` },
                    { label: '#5+ Seeds', check: selectedTeams.filter(t => t.seed >= 5).length === 4, count: `${selectedTeams.filter(t => t.seed >= 5).length}/4` },
                  ].map(req => (
                    <div key={req.label} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-body ${req.check ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                      <span>{req.check ? '✓' : '○'} {req.label}</span>
                      <span className="font-bold">{req.count}</span>
                    </div>
                  ))}
                </div>

                {/* Selected teams list */}
                <div className="space-y-1.5 mb-5 min-h-[120px]">
                  {selectedTeams.length === 0 && (
                    <p className="text-white/20 text-sm font-body italic text-center py-4">No teams selected yet</p>
                  )}
                  {selectedTeams.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-1.5 px-2 bg-white/5 rounded text-sm font-body">
                      <span className="text-chalk">{t.is_playin_pair ? `${t.name}/${t.playin_partner}` : t.name}</span>
                      <div className="flex items-center gap-2">
                        <SeedBadge seed={t.seed} />
                        <button onClick={() => toggleTeam(t.id)} className="text-white/30 hover:text-red-400 transition-colors text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Validation errors */}
                {selected.length > 0 && !validationResult.valid && (
                  <div className="mb-4">
                    {validationResult.errors.map(err => (
                      <p key={err} className="text-red-400 text-xs font-body mb-1">⚠ {err}</p>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setStep('info')}
                  disabled={!validationResult.valid}
                  className={`w-full py-3 rounded-lg font-bold font-body transition-all ${validationResult.valid
                    ? 'btn-primary'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'info' && (
          <div className="max-w-xl">
            <button onClick={() => setStep('picks')} className="text-white/40 hover:text-white/70 text-sm font-body mb-6 flex items-center gap-2">
              ← Back to picks
            </button>

            <div className="card p-6 mb-6">
              <h3 className="font-display text-2xl text-maize-400 tracking-wider mb-1">YOUR PICKS</h3>
              <div className="space-y-2 mt-3">
                {selectedTeams.map(t => (
                  <TeamBadge key={t.id} name={t.name} seed={t.seed} showRecord={true} size="sm" />
                ))}
              </div>
            </div>

            <div className="card p-6 space-y-5">
              <h3 className="font-display text-2xl text-maize-400 tracking-wider">YOUR DETAILS</h3>

              <div>
                <label className="text-white/50 text-sm font-body block mb-1">Nickname / Display Name *</label>
                <p className="text-white/30 text-xs font-body mb-2">Must be unique. Entering multiple times? Use Matt1, Matt2, etc.</p>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                  placeholder="e.g. MattCase1"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body focus:outline-none focus:border-maize-500 transition-colors placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="text-white/50 text-sm font-body block mb-2">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="First Last"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body focus:outline-none focus:border-maize-500 transition-colors placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="text-white/50 text-sm font-body block mb-1">Email</label>
                <p className="text-white/30 text-xs font-body mb-2">Used for round-by-round score updates. Multiple entries can share the same email.</p>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body focus:outline-none focus:border-maize-500 transition-colors placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="text-white/50 text-sm font-body block mb-1">
                  Tiebreaker: Total points in Championship Game *
                </label>
                <p className="text-white/30 text-xs font-body mb-2">Predict the combined score of both teams in the final game</p>
                <input
                  type="number"
                  value={form.tiebreaker}
                  onChange={e => setForm(f => ({ ...f, tiebreaker: e.target.value }))}
                  placeholder="e.g. 145"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body focus:outline-none focus:border-maize-500 transition-colors placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="text-white/50 text-sm font-body block mb-1">4-Digit PIN *</label>
                <p className="text-white/30 text-xs font-body mb-2">Keeps your picks private until tip-off — so no one can see your selections before the tournament begins.</p>
                <input
                  type="number"
                  value={form.pin}
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value.slice(0, 4) }))}
                  placeholder="e.g. 1234"
                  maxLength={4}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body focus:outline-none focus:border-maize-500 transition-colors placeholder:text-white/20 tracking-[0.5em] text-center text-xl"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-body">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!form.nickname.trim() || !isPinValid(form.pin) || loading}
                className={form.nickname.trim() && form.email.trim() ? 'w-full py-4 rounded-lg font-bold font-body text-lg transition-all btn-primary' : 'w-full py-4 rounded-lg font-bold font-body text-lg transition-all bg-white/10 text-white/30 cursor-not-allowed'}
              >
                {loading ? 'Submitting...' : 'Submit My Picks 🏀'}
              </button>

              <p className="text-white/30 text-xs font-body text-center">
                <>After submitting, send your entry fee via Venmo/Zelle to <ObfuscatedEmail /></>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
