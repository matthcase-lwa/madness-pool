'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Team } from "./types"

export default function PicksEditor({
  participant,
  teams,
  year,
  adminPassword,
  onClose,
  onSaved,
}: {
  participant: { id: string; nickname: string; full_name: string }
  teams: { id: string; name: string; seed: number; region: string }[]
  year: number
  adminPassword: string
  onClose: () => void
  onSaved: () => void
}) {
  const [currentPicks, setCurrentPicks] = useState<any[]>([])
  const [addTeamId, setAddTeamId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<any>(null)

  async function refreshPicks() {
    setLoading(true)
    const res = await fetch('/api/admin-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, action: 'get', participantId: participant.id })
    })
    const { picks, error } = await res.json()
    if (error) setError(error)
    if (picks) setCurrentPicks(picks)
    setLoading(false)
  }

  useEffect(() => { refreshPicks() }, [participant.id])

  async function removePick(pickId: string) {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, action: 'delete', pickId })
    })
    const result = await res.json()
    if (result.error) {
      setError(result.error)
    } else {
      setCurrentPicks(prev => prev.filter(p => p.id !== pickId))
    }
    setConfirmRemove(null)
    setSaving(false)
  }

  async function addPick() {
    if (!addTeamId) return
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
    const res = await fetch('/api/admin-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, action: 'insert', participantId: participant.id, teamId: addTeamId, year })
    })
    const result = await res.json()
    if (result.error) {
      setError(result.error)
    } else {
      setAddTeamId('')
      // Reload from DB immediately so the full updated list is shown
      const refreshRes = await fetch('/api/admin-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, action: 'get', participantId: participant.id })
      })
      const { picks } = await refreshRes.json()
      if (picks) setCurrentPicks(picks)
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
            <p className="text-white/50 text-sm font-body">{participant.nickname}{participant.full_name ? ' · ' + participant.full_name : ''}</p>
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
                      <span className={pick.team.seed === 1 ? 'seed-1' : pick.team.seed <= 4 ? 'seed-2' : pick.team.seed >= 9 ? 'seed-badge seed-9plus' : 'seed-badge seed-5plus'}>
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
                  className={addTeamId ? 'px-4 py-2 rounded-lg font-bold font-body text-sm transition-all shrink-0 btn-primary' : 'px-4 py-2 rounded-lg font-bold font-body text-sm transition-all shrink-0 bg-white/10 text-white/30 cursor-not-allowed'}
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

