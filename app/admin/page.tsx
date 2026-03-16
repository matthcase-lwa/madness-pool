'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const SiteNav = dynamic(() => import('@/components/SiteNav'), { ssr: false })
import { supabase } from '@/lib/supabase'
import { ROUND_NAMES } from '@/lib/scoring'

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')

// Simple client-side admin auth (password stored in env)
const ADMIN_KEY = 'madness_admin_authed'

interface Team { id: string; name: string; seed: number; region: string; eliminated_round: number | null; playin_partner: string | null; is_playin_pair: boolean }
interface Participant { id: string; nickname: string; full_name: string; email: string; payment_received: boolean; payment_method: string; entry_pin: string | null }
interface Game { id: string; round: number; winner_team_id: string; loser_team_id: string; winner_score: number; loser_score: number }

function EmailExport({ year }: { year: number }) {
  const [emails, setEmails] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function loadEmails() {
    setLoading(true)
    const { data } = await supabase
      .from('participants')
      .select('email, nickname')
      .eq('year', year)
      .eq('payment_received', true)
      .not('email', 'is', null)
    if (data) {
      // Deduplicate emails
      const unique = [...new Set(data.map(p => p.email).filter(Boolean))] as string[]
      setEmails(unique.sort())
    }
    setLoading(false)
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(emails.join(', '))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <button onClick={loadEmails} disabled={loading} className="btn-primary text-sm py-2 px-4">
          {loading ? 'Loading...' : 'Load Email List'}
        </button>
        {emails.length > 0 && (
          <button onClick={copyToClipboard} className="btn-secondary text-sm py-2 px-4">
            {copied ? '✓ Copied!' : '📋 Copy All'}
          </button>
        )}
      </div>
      {emails.length > 0 && (
        <>
          <p className="text-white/30 text-xs font-body mb-2">{emails.length} unique email addresses (paid participants only)</p>
          <div className="bg-black/30 rounded-lg p-4 font-mono text-xs text-white/60 max-h-64 overflow-y-auto leading-relaxed">
            {emails.join(', ')}
          </div>
          <div className="mt-4 space-y-1">
            {emails.map(e => (
              <div key={e} className="text-white/50 text-sm font-body">{e}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ExportPicks({ year }: { year: number }) {
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState<number | null>(null)

  async function downloadCSV() {
    setLoading(true)
    try {
      // Fetch all participants
      const { data: participants } = await supabase
        .from('participants')
        .select('id, nickname, full_name, email, tiebreaker, entry_pin, payment_received')
        .eq('year', year)
        .order('nickname')

      if (!participants || participants.length === 0) {
        alert('No participants found.')
        setLoading(false)
        return
      }

      // Fetch all picks with team names
      const ids = participants.map(p => p.id)
      const { data: picks } = await supabase
        .from('picks')
        .select('participant_id, team:team_id(name, seed)')
        .in('participant_id', ids)

      // Group picks by participant
      const pickMap: Record<string, {name: string, seed: number}[]> = {}
      participants.forEach(p => { pickMap[p.id] = [] })
      picks?.forEach((pk: any) => {
        if (pk.team && pickMap[pk.participant_id]) {
          pickMap[pk.participant_id].push(pk.team)
        }
      })
      Object.keys(pickMap).forEach(id => {
        pickMap[id].sort((a, b) => a.seed - b.seed)
      })

      // Build CSV
      const headers = [
        'Nickname', 'Full Name', 'Email', 'Tiebreaker', 'PIN',
        'Paid', 'Pick 1', 'Pick 2', 'Pick 3', 'Pick 4',
        'Pick 5', 'Pick 6', 'Pick 7', 'Pick 8'
      ]

      const rows = participants.map(p => {
        const myPicks = pickMap[p.id] || []
        return [
          p.nickname,
          p.full_name || '',
          p.email || '',
          p.tiebreaker ?? '',
          p.entry_pin || '',
          p.payment_received ? 'Yes' : 'No',
          ...Array.from({ length: 8 }, (_, i) =>
            myPicks[i] ? `${myPicks[i].name} (#${myPicks[i].seed})` : ''
          )
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      })

      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bracketless-madness-${year}-picks-backup-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setCount(participants.length)
    } catch (e: any) {
      alert('Export failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={downloadCSV}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Exporting...' : '⬇️ Download Picks CSV'}
      </button>
      {count !== null && (
        <p className="text-emerald-400 text-sm font-body mt-3">
          ✓ Exported {count} participants successfully.
        </p>
      )}
      <div className="mt-6 bg-black/20 rounded-lg p-4 text-xs font-body text-white/40 space-y-2">
        <p className="font-bold text-white/60">⚠️ Before making any changes to teams or data:</p>
        <p>1. Click the button above to download a fresh backup</p>
        <p>2. To fix a team name, use a targeted SQL update in Supabase — never re-run the full seed script</p>
        <p className="font-mono bg-black/30 px-3 py-2 rounded text-white/50">
          UPDATE teams SET name = 'New Name' WHERE year = {year} AND name = 'Old Name';
        </p>
        <p>3. To fix a seed, similarly: UPDATE teams SET seed = 5 WHERE year = {year} AND name = 'Team';</p>
      </div>
    </div>
  )
}

function PicksEditor({
  participant,
  teams,
  year,
  onClose,
  onSaved,
}: {
  participant: { id: string; nickname: string; full_name: string }
  teams: { id: string; name: string; seed: number; region: string }[]
  year: number
  onClose: () => void
  onSaved: () => void
}) {
  const [currentPicks, setCurrentPicks] = useState<{ id: string; team: { id: string; name: string; seed: number; region: string } }[]>([])
  const [addTeamId, setAddTeamId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('picks')
      .select('id, team:team_id(id, name, seed, region)')
      .eq('participant_id', participant.id)
      .then(({ data }) => {
        if (data) setCurrentPicks(data as any)
        setLoading(false)
      })
  }, [participant.id])

  async function removePick(pickId: string) {
    setSaving(true)
    setError('')
    const { error } = await supabase.from('picks').delete().eq('id', pickId)
    if (error) {
      setError(error.message)
    } else {
      setCurrentPicks(prev => prev.filter(p => p.id !== pickId))
    }
    setConfirmRemove(null)
    setSaving(false)
  }

  async function addPick() {
    if (!addTeamId) return
    // Check not already picked
    if (currentPicks.some(p => p.team.id === addTeamId)) {
      setError('That team is already in this participant\'s picks.')
      return
    }
    if (currentPicks.length >= 8) {
      setError('This participant already has 8 picks. Remove one first.')
      return
    }
    setSaving(true)
    setError('')
    const { data, error } = await supabase
      .from('picks')
      .insert({ participant_id: participant.id, team_id: addTeamId, year })
      .select('id, team:team_id(id, name, seed, region)')
      .single()
    if (error) {
      setError(error.message)
    } else if (data) {
      setCurrentPicks(prev => [...prev, data as any].sort((a, b) => a.team.seed - b.team.seed))
      setAddTeamId('')
    }
    setSaving(false)
  }

  const sortedTeams = [...teams].sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name))
  const pickedIds = new Set(currentPicks.map(p => p.team.id))

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="card max-w-lg w-full p-0 overflow-hidden border-maize-500/40">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-maize-500/10">
          <div>
            <h2 className="font-display text-2xl text-chalk tracking-wider">EDIT PICKS</h2>
            <p className="text-white/50 text-sm font-body">{participant.nickname}{participant.full_name ? ` · ${participant.full_name}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-2xl">✕</button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-amber-400 text-xs font-body">
            ⚠️ Admin override only. Changes take effect immediately and affect scoring. Export a picks backup first if unsure.
          </div>

          {/* Current picks */}
          <div>
            <div className="text-white/40 text-xs font-body uppercase tracking-widest mb-3">
              Current Picks ({currentPicks.length}/8)
            </div>
            {loading ? (
              <div className="text-white/30 text-sm font-body text-center py-4">Loading...</div>
            ) : currentPicks.length === 0 ? (
              <div className="text-white/20 text-sm font-body italic text-center py-4">No picks on file</div>
            ) : (
              <div className="space-y-2">
                {currentPicks.map(pick => (
                  <div key={pick.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`seed-badge ${pick.team.seed === 1 ? 'seed-1' : pick.team.seed <= 4 ? 'seed-2' : pick.team.seed >= 9 ? 'seed-9plus' : 'seed-5plus'}`}>
                        #{pick.team.seed}
                      </span>
                      <div>
                        <div className="font-body font-bold text-chalk text-sm">{pick.team.name}</div>
                        <div className="text-white/30 text-xs font-body">{pick.team.region}</div>
                      </div>
                    </div>
                    {confirmRemove === pick.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xs font-body">Confirm?</span>
                        <button
                          onClick={() => removePick(pick.id)}
                          disabled={saving}
                          className="px-2 py-1 rounded text-xs font-bold font-body bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                        >
                          Yes, remove
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="px-2 py-1 rounded text-xs font-body text-white/40 hover:text-white/70"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(pick.id)}
                        className="px-3 py-1 rounded text-xs font-bold font-body text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add pick */}
          {currentPicks.length < 8 && (
            <div>
              <div className="text-white/40 text-xs font-body uppercase tracking-widest mb-3">Add a Pick</div>
              <div className="flex gap-2">
                <select
                  value={addTeamId}
                  onChange={e => { setAddTeamId(e.target.value); setError('') }}
                  className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-chalk font-body text-sm focus:outline-none focus:border-maize-500"
                >
                  <option value="">Select a team to add...</option>
                  {sortedTeams
                    .filter(t => !pickedIds.has(t.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        #{t.seed} {t.name} ({t.region})
                      </option>
                    ))
                  }
                </select>
                <button
                  onClick={addPick}
                  disabled={!addTeamId || saving}
                  className={`px-4 py-2 rounded-lg font-bold font-body text-sm transition-all shrink-0 ${addTeamId ? 'btn-primary' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-body">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-between items-center">
          <span className="text-white/30 text-xs font-body">Changes save instantly to the database</span>
          <button onClick={onSaved} className="btn-primary text-sm py-2 px-4">Done</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState<'teams' | 'participants' | 'scores' | 'import'>('teams')
  const [teams, setTeams] = useState<Team[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Team form
  const [teamForm, setTeamForm] = useState({ name: '', seed: '', region: '', is_playin_pair: false, playin_partner: '' })

  // Game form
  const [gameForm, setGameForm] = useState({ round: '1', winner_id: '', loser_id: '', winner_score: '', loser_score: '' })

  // Import form
  const [importJson, setImportJson] = useState('')

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_KEY) === 'true') setAuthed(true)
  }, [])

  useEffect(() => {
    if (!authed) return
    loadData()
  }, [authed])

  async function loadData() {
    setLoading(true)
    const [teamsRes, partsRes, gamesRes] = await Promise.all([
      supabase.from('teams').select('*').eq('year', YEAR).order('seed'),
      supabase.from('participants').select('id, nickname, full_name, email, payment_received, payment_method, entry_pin').eq('year', YEAR).order('nickname'),
      supabase.from('games').select('*').eq('year', YEAR).order('round'),
    ])
    if (teamsRes.data) setTeams(teamsRes.data)
    if (partsRes.data) setParticipants(partsRes.data)
    if (gamesRes.data) setGames(gamesRes.data)
    setLoading(false)
  }

  async function handleLogin() {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      sessionStorage.setItem(ADMIN_KEY, 'true')
      setAuthed(true)
    } else {
      setMsg('❌ Wrong password')
    }
  }

  async function addTeam() {
    if (!teamForm.name || !teamForm.seed) return
    const { error } = await supabase.from('teams').insert({
      year: YEAR,
      name: teamForm.name.trim(),
      seed: parseInt(teamForm.seed),
      region: teamForm.region.trim() || null,
      is_playin_pair: teamForm.is_playin_pair,
      playin_partner: teamForm.is_playin_pair ? teamForm.playin_partner.trim() : null,
    })
    if (!error) {
      setTeamForm({ name: '', seed: '', region: '', is_playin_pair: false, playin_partner: '' })
      setMsg('✓ Team added!')
      loadData()
    } else setMsg(`Error: ${error.message}`)
  }

  async function eliminateTeam(teamId: string, round: number) {
    await supabase.from('teams').update({ eliminated_round: round }).eq('id', teamId)
    loadData()
  }

  async function addGame() {
    if (!gameForm.winner_id || !gameForm.loser_id || !gameForm.winner_score || !gameForm.loser_score) return
    const { error } = await supabase.from('games').insert({
      year: YEAR,
      round: parseInt(gameForm.round),
      winner_team_id: gameForm.winner_id,
      loser_team_id: gameForm.loser_id,
      winner_score: parseInt(gameForm.winner_score),
      loser_score: parseInt(gameForm.loser_score),
    })
    // Also mark loser as eliminated
    if (!error) {
      await supabase.from('teams').update({ eliminated_round: parseInt(gameForm.round) }).eq('id', gameForm.loser_id)
      setGameForm({ round: '1', winner_id: '', loser_id: '', winner_score: '', loser_score: '' })
      setMsg('✓ Game result saved!')
      loadData()
    } else setMsg(`Error: ${error.message}`)
  }

  async function resetPin(participantId: string, nickname: string) {
    const newPin = prompt(`Reset PIN for ${nickname}. Enter new 4-digit PIN:`)
    if (!newPin) return
    if (!/^[0-9]{4}$/.test(newPin)) {
      setMsg('❌ PIN must be exactly 4 digits')
      return
    }
    const { error } = await supabase
      .from('participants')
      .update({ entry_pin: newPin })
      .eq('id', participantId)
    if (error) setMsg(`Error: ${error.message}`)
    else setMsg(`✓ PIN reset for ${nickname} — new PIN: ${newPin}`)
  }

  async function togglePayment(participantId: string, current: boolean) {
    await supabase.from('participants').update({ payment_received: !current }).eq('id', participantId)
    loadData()
  }

  async function importHistory() {
    try {
      const data = JSON.parse(importJson)
      if (!Array.isArray(data)) throw new Error('Must be an array')
      const { error } = await supabase.from('historical_results').insert(data)
      if (error) throw new Error(error.message)
      setMsg(`✓ Imported ${data.length} historical records!`)
      setImportJson('')
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    }
  }

  async function addParticipantManually() {
    const nickname = prompt('Nickname:')
    if (!nickname) return
    const fullName = prompt('Full name (optional):') || ''
    const email = prompt('Email (optional):') || ''
    await supabase.from('participants').insert({ year: YEAR, nickname, full_name: fullName, email })
    loadData()
  }

  const inputClass = "bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-chalk font-body text-sm focus:outline-none focus:border-maize-500 placeholder:text-white/20 w-full"

  // Still checking auth state (avoids SSR hydration mismatch)
  if (authed === null) {
    return <div className="min-h-screen bg-hardwood court-texture" />
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-hardwood court-texture flex items-center justify-center p-6">
        <div className="card p-8 max-w-sm w-full">
          <h1 className="font-display text-4xl text-maize-400 tracking-wider mb-6">ADMIN</h1>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            className={inputClass + ' mb-4'}
          />
          <button onClick={handleLogin} className="btn-primary w-full">Login</button>
          {msg && <p className="text-red-400 text-sm font-body mt-3">{msg}</p>}
          <Link href="/" className="text-white/30 text-xs font-body hover:text-white/50 mt-4 block text-center">← Back to site</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hardwood court-texture">
      <SiteNav />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {msg && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-body ${msg.startsWith('✓') ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
            {msg} <button onClick={() => setMsg('')} className="ml-2 opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Teams Loaded', value: teams.length },
            { label: 'Participants', value: participants.length },
            { label: 'Paid', value: participants.filter(p => p.payment_received).length },
            { label: 'Games Recorded', value: games.length },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="font-display text-4xl text-maize-400 tracking-wider">{s.value}</div>
              <div className="text-white/40 text-xs font-body mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'teams', label: '🏀 Teams' },
            { key: 'participants', label: '👥 Participants' },
            { key: 'scores', label: '📊 Enter Scores' },
            { key: 'import', label: '📥 Import History' },
            { key: 'export', label: '💾 Export Picks' },
            { key: 'email', label: '✉️ Email List' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-body font-bold transition-all ${tab === t.key ? 'bg-maize-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Teams tab */}
        {tab === 'teams' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-4">ADD TEAM</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <input className={inputClass} placeholder="Team name" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} />
                <input className={inputClass} placeholder="Seed (1-16)" type="number" value={teamForm.seed} onChange={e => setTeamForm(f => ({ ...f, seed: e.target.value }))} />
                <select className={inputClass} value={teamForm.region} onChange={e => setTeamForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="">Region (optional)</option>
                  {['East', 'West', 'South', 'Midwest'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="playin" checked={teamForm.is_playin_pair} onChange={e => setTeamForm(f => ({ ...f, is_playin_pair: e.target.checked }))} />
                  <label htmlFor="playin" className="text-white/60 text-sm font-body">Play-in pair</label>
                </div>
              </div>
              {teamForm.is_playin_pair && (
                <input className={inputClass + ' mb-3'} placeholder="Partner team name (e.g. Xavier)" value={teamForm.playin_partner} onChange={e => setTeamForm(f => ({ ...f, playin_partner: e.target.value }))} />
              )}
              <button onClick={addTeam} className="btn-primary">Add Team</button>
            </div>

            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-display text-2xl text-maize-400 tracking-wider">TEAMS ({teams.length})</h2>
              </div>
              <div className="divide-y divide-white/5">
                {teams.map(team => (
                  <div key={team.id} className="flex items-center gap-4 px-6 py-3">
                    <span className={`seed-badge ${team.seed === 1 ? 'seed-1' : team.seed <= 4 ? 'seed-2' : 'seed-5plus'}`}>#{team.seed}</span>
                    <span className="font-body text-chalk flex-1">{team.name}{team.playin_partner ? `/${team.playin_partner}` : ''}</span>
                    {team.region && <span className="text-white/30 text-xs font-body">{team.region}</span>}
                    {team.eliminated_round ? (
                      <span className="text-red-400 text-xs font-body">Out R{team.eliminated_round}</span>
                    ) : (
                      <select
                        className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white/50 text-xs font-body"
                        onChange={e => e.target.value && eliminateTeam(team.id, parseInt(e.target.value))}
                        defaultValue=""
                      >
                        <option value="">Eliminate after...</option>
                        {[1, 2, 3, 4, 5, 6].map(r => <option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Participants tab */}
        {tab === 'participants' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-display text-2xl text-maize-400 tracking-wider">PARTICIPANTS ({participants.length})</h2>
              <button onClick={addParticipantManually} className="btn-secondary text-sm py-2">+ Add Manually</button>
            </div>
            <div className="card overflow-hidden">
              <div className="divide-y divide-white/5">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="flex-1">
                      <div className="font-body font-bold text-chalk text-sm">{p.nickname}</div>
                      {p.full_name && <div className="text-white/30 text-xs font-body">{p.full_name}</div>}
                    </div>
                    {p.email && <div className="text-white/30 text-xs font-body hidden md:block">{p.email}</div>}
                    <div className="text-white/20 text-xs font-body hidden lg:block font-mono">
                      PIN: {p.entry_pin || <span className="text-red-400/50">none</span>}
                    </div>
                    <button
                      onClick={() => togglePayment(p.id, p.payment_received)}
                      className={`px-3 py-1 rounded-full text-xs font-bold font-body transition-all ${p.payment_received ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}
                    >
                      {p.payment_received ? '✓ Paid' : '✗ Unpaid'}
                    </button>
                    <button
                      onClick={() => resetPin(p.id, p.nickname)}
                      className="px-3 py-1 rounded-full text-xs font-bold font-body bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70 transition-all"
                      title="Reset PIN"
                    >
                      🔑 PIN
                    </button>
                    <button
                      onClick={() => setEditingParticipant(p)}
                      className="px-3 py-1 rounded-full text-xs font-bold font-body bg-maize-500/20 text-maize-400 border border-maize-500/30 hover:bg-maize-500/30 transition-all"
                      title="Edit Picks"
                    >
                      ✏️ Picks
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Picks editor modal */}
        {editingParticipant && (
          <PicksEditor
            participant={editingParticipant}
            teams={teams}
            year={YEAR}
            onClose={() => setEditingParticipant(null)}
            onSaved={() => { setEditingParticipant(null); setMsg(`✓ Picks updated for ${editingParticipant.nickname}`) }}
          />
        )}

        {/* Scores tab */}
        {tab === 'scores' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-4">RECORD GAME RESULT</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-white/40 text-xs font-body mb-1 block">Round</label>
                  <select className={inputClass} value={gameForm.round} onChange={e => setGameForm(f => ({ ...f, round: e.target.value }))}>
                    {[1, 2, 3, 4, 5, 6].map(r => <option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
                  </select>
                </div>
                <div />
                <div>
                  <label className="text-white/40 text-xs font-body mb-1 block">Winner</label>
                  <select className={inputClass} value={gameForm.winner_id} onChange={e => setGameForm(f => ({ ...f, winner_id: e.target.value }))}>
                    <option value="">Select winner...</option>
                    {teams.filter(t => !t.eliminated_round || t.eliminated_round >= parseInt(gameForm.round)).map(t => (
                      <option key={t.id} value={t.id}>#{t.seed} {t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-xs font-body mb-1 block">Loser</label>
                  <select className={inputClass} value={gameForm.loser_id} onChange={e => setGameForm(f => ({ ...f, loser_id: e.target.value }))}>
                    <option value="">Select loser...</option>
                    {teams.filter(t => t.id !== gameForm.winner_id && (!t.eliminated_round || t.eliminated_round >= parseInt(gameForm.round))).map(t => (
                      <option key={t.id} value={t.id}>#{t.seed} {t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-xs font-body mb-1 block">Winner Score</label>
                  <input className={inputClass} type="number" placeholder="e.g. 78" value={gameForm.winner_score} onChange={e => setGameForm(f => ({ ...f, winner_score: e.target.value }))} />
                </div>
                <div>
                  <label className="text-white/40 text-xs font-body mb-1 block">Loser Score</label>
                  <input className={inputClass} type="number" placeholder="e.g. 65" value={gameForm.loser_score} onChange={e => setGameForm(f => ({ ...f, loser_score: e.target.value }))} />
                </div>
              </div>
              <button onClick={addGame} className="btn-primary">Save Game Result</button>
            </div>

            {/* Recent games */}
            {games.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h3 className="font-display text-xl text-maize-400 tracking-wider">RECORDED GAMES</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {[...games].reverse().map(game => {
                    const winner = teams.find(t => t.id === game.winner_team_id)
                    const loser = teams.find(t => t.id === game.loser_team_id)
                    return (
                      <div key={game.id} className="px-6 py-3 flex items-center gap-4 text-sm font-body">
                        <span className="text-white/30 text-xs">{ROUND_NAMES[game.round]}</span>
                        <span className="text-emerald-400 font-bold">{winner?.name}</span>
                        <span className="text-white/50">{game.winner_score}–{game.loser_score}</span>
                        <span className="text-white/30">{loser?.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Email list tab */}
        {tab === 'email' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-2">EMAIL LIST</h2>
              <p className="text-white/40 text-sm font-body mb-6">
                Unique email addresses for all paid participants — ready to paste into your email client for round updates.
              </p>
              <EmailExport year={YEAR} />
            </div>
          </div>
        )}

        {/* Import tab */}
        {tab === 'export' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-2">EXPORT PICKS BACKUP</h2>
              <p className="text-white/40 text-sm font-body mb-2">
                Download a complete CSV of all participant picks. Run this before making any changes to teams or the database.
              </p>
              <p className="text-white/30 text-xs font-body mb-6">
                The CSV includes: nickname, full name, email, tiebreaker, PIN, payment status, and all 8 team selections.
              </p>
              <ExportPicks year={YEAR} />
            </div>
          </div>
        )}

        {tab === 'import' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-2">IMPORT HISTORICAL DATA</h2>
              <p className="text-white/40 text-sm font-body mb-6">
                Paste a JSON array of past results. Each record should have: year, nickname, full_name, total_points, final_rank, teams_picked (array of team names).
              </p>
              <div className="bg-black/30 rounded-lg p-4 mb-4 text-xs font-mono text-white/40">
                {`[
  {
    "year": 2024,
    "nickname": "JCohen2",
    "full_name": "Josh Cohen",
    "total_points": 56,
    "final_rank": 1,
    "teams_picked": ["Duke", "MSU", "Texas Tech", ...]
  },
  ...
]`}
              </div>
              <textarea
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                placeholder="Paste JSON here..."
                className={inputClass + ' h-48 resize-none font-mono text-xs mb-4'}
              />
              <button onClick={importHistory} disabled={!importJson.trim()} className="btn-primary">
                Import Historical Data
              </button>
            </div>

            <div className="card p-6">
              <h3 className="font-display text-xl text-maize-400 tracking-wider mb-3">HOW TO IMPORT PAST YEARS</h3>
              <div className="text-white/50 text-sm font-body space-y-2">
                <p>1. Open your Excel tool for a past year</p>
                <p>2. From the "Ranks" or "Current Place" sheet, note each participant's final score and rank</p>
                <p>3. From the "Participants Teams and Scores" sheet, note each person's 8 team picks</p>
                <p>4. Format as JSON and paste above — I can help you convert an Excel export if you share it</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
