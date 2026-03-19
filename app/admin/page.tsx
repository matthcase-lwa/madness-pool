'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { ROUND_NAMES } from '@/lib/scoring'
const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const SiteNav = dynamic(() => import('@/components/SiteNav'), { ssr: false })

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')

// Simple client-side admin auth (password stored in env)
const ADMIN_KEY = 'madness_admin_authed'
let _adminPasswordCache = ''

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
      // Use service role API to bypass RLS deadline restriction
      const res = await fetch('/api/admin-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password, year })
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        alert(result.error || 'Export failed')
        setLoading(false)
        return
      }

      const { participants, picks } = result

      if (!participants || participants.length === 0) {
        alert('No participants found.')
        setLoading(false)
        return
      }

      // Group picks by participant
      const pickMap: Record<string, {name: string, seed: number}[]> = {}
      participants.forEach((p: any) => { pickMap[p.id] = [] })
      picks?.forEach((pk: any) => {
        if (pk.team && pickMap[pk.participant_id]) {
          pickMap[pk.participant_id].push(pk.team)
        }
      })
      Object.keys(pickMap).forEach(id => {
        pickMap[id].sort((a: any, b: any) => a.seed - b.seed)
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
  const [currentPicks, setCurrentPicks] = useState<{ id: string; team: { id: string; name: string; seed: number; region: string } }[]>([])
  const [addTeamId, setAddTeamId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  async function refreshPicks() {
    setLoading(true)
    const res = await fetch('/api/admin-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, action: 'get', participantId: participant.id })
    })
    const { picks, error } = await res.json()
    if (error) setError(error)
    if (picks) setCurrentPicks(picks as any)
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
      if (picks) setCurrentPicks(picks as any)
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

function EmailComposer({ year, adminPassword, participantCount, paidCount, topPlayers }: {
  year: number
  adminPassword: string
  participantCount: number
  paidCount: number
  topPlayers: { nickname: string; total_points: number; rank: number }[]
}) {
  const deadline = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')
  const now = new Date()
  const hoursLeft = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 3600000))
  const daysLeft = Math.floor(hoursLeft / 24)
  const timeLeft = hoursLeft > 48 ? `${daysLeft} days` : hoursLeft > 0 ? `${hoursLeft} hours` : 'Tip-off has passed'
  const unpaidCount = participantCount - paidCount

  const leaderLines = topPlayers.length > 0
    ? topPlayers.slice(0, 3).map((p, i) => ['1.','2.','3.'][i] + ' ' + p.nickname + ' - ' + p.total_points + ' pts').join('\n')
    : '  Leaderboard updates after games begin'

  const TEMPLATES = {
    hype: {
      label: '🏀 Hype / Pool Update',
      subject: `🏀 Bracketless Madness 2026 — ${participantCount} entries and counting!`,
      body: `Hey everyone,

Just wanted to give you a quick update on this year's pool!

📊 Pool Update:
• Entries submitted: ${participantCount}
• Payments confirmed: ${paidCount} of ${participantCount}
• Time until tip-off: ${timeLeft}

${hoursLeft > 0 ? `There's still time to submit your picks or make changes before tip-off. Head to the site and use your PIN to edit your selections.` : `Picks are now locked — let the madness begin!`}

🏀 Visit the site: https://madness-pool.vercel.app

Good luck everyone — may your underdogs run deep!

Matt`
    },
    payment: {
      label: '💰 Payment Reminder',
      subject: `Action needed: Bracketless Madness 2026 payment`,
      body: `Hey,

Just a quick reminder that I haven't received your entry fee yet for this year's pool.

💵 Please send your entry fee via Venmo or Zelle to matthcase@gmail.com

If I don't receive payment before tip-off, I'll need to remove your entry from the pool.

If you've already paid and received this by mistake, please ignore it — I may just be running behind on tracking payments.

🏀 Visit the site: https://madness-pool.vercel.app

Thanks!
Matt`
    },
    round: {
      label: '📊 Round Update',
      subject: `🏀 Bracketless Madness — Round Update`,
      body: `Hey everyone,

Here's your Bracketless Madness update!

🏆 Current Leaderboard:
${leaderLines}

Check the full leaderboard to see where you stand and which of your teams are still alive.

🏀 Visit the site: https://madness-pool.vercel.app

Matt`
    }
  }

  type TemplateKey = keyof typeof TEMPLATES
  const [template, setTemplate] = useState<TemplateKey>('hype')
  const [subject, setSubject] = useState(TEMPLATES.hype.subject)
  const [body, setBody] = useState(TEMPLATES.hype.body)
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [previewEmail, setPreviewEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  function applyTemplate(key: TemplateKey) {
    setTemplate(key)
    setSubject(TEMPLATES[key].subject)
    setBody(TEMPLATES[key].body)
    // Auto-select unpaid only for payment reminder
    setUnpaidOnly(key === 'payment')
    setResult('')
    setShowConfirm(false)
  }

  const recipientCount = unpaidOnly ? unpaidCount : participantCount

  async function sendEmail(previewOnly: boolean) {
    if (!previewOnly && !showConfirm) {
      setShowConfirm(true)
      return
    }
    setSending(true)
    setResult('')
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          subject,
          body,
          previewOnly,
          previewEmail,
          unpaidOnly,
          year
        })
      })
      const data = await res.json()
      if (data.error) {
        setResult(`❌ ${data.error}`)
      } else {
        setResult(`✓ ${data.message}`)
        setShowConfirm(false)
      }
    } catch (e: any) {
      setResult(`❌ ${e.message}`)
    }
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-2">SEND EMAIL</h2>
        <p className="text-white/40 text-sm font-body mb-6">
          Choose a template, customize it, preview it in your inbox, then send.
        </p>

        {/* Template picker */}
        <div className="mb-5">
          <label className="text-white/50 text-sm font-body block mb-2">Choose a template</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(TEMPLATES) as TemplateKey[]).map(key => (
              <button
                key={key}
                onClick={() => applyTemplate(key)}
                className={`px-4 py-2 rounded-lg text-sm font-body font-bold transition-all ${template === key ? 'bg-maize-500 text-blue-900' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
              >
                {TEMPLATES[key].label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'All participants', value: participantCount },
            { label: 'Paid', value: paidCount },
            { label: 'Unpaid', value: unpaidCount },
            { label: 'Until tip-off', value: timeLeft },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
              <div className="font-display text-xl text-maize-400 tracking-wider">{s.value}</div>
              <div className="text-white/30 text-xs font-body mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recipient toggle */}
        <div className="flex items-center gap-3 mb-5 p-3 bg-white/5 rounded-lg border border-white/10">
          <span className="text-white/50 text-sm font-body">Send to:</span>
          <button
            onClick={() => setUnpaidOnly(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-body transition-all ${!unpaidOnly ? 'bg-maize-500 text-blue-900' : 'bg-white/10 text-white/50'}`}
          >
            All {participantCount} participants
          </button>
          <button
            onClick={() => setUnpaidOnly(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-body transition-all ${unpaidOnly ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/50'}`}
          >
            Unpaid only ({unpaidCount})
          </button>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <label className="text-white/50 text-sm font-body block mb-2">Subject line</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body text-sm focus:outline-none focus:border-maize-500"
          />
        </div>

        {/* Body + Preview side by side */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-white/50 text-sm font-body block mb-2">Email body</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={18}
              className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body text-sm focus:outline-none focus:border-maize-500 resize-none"
            />
          </div>
          <div>
            <label className="text-white/50 text-sm font-body block mb-2">Preview</label>
            <div className="rounded-lg overflow-hidden border border-white/10 bg-gray-100 text-gray-900 text-sm" style={{minHeight: '420px'}}>
              <div style={{background: '#00172e', borderRadius: '8px 8px 0 0'}}>
                <div style={{background: '#FFCB05', padding: '14px 20px'}}>
                  <div style={{fontWeight: 900, fontSize: '16px', letterSpacing: '2px', color: '#00172e'}}>🏀 BRACKETLESS MADNESS</div>
                  <div style={{fontSize: '11px', color: '#00172e', opacity: 0.7}}>2026 Annual Tournament Pool</div>
                </div>
                <div style={{padding: '20px', color: '#e8e8e8', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap'}}>
                  {body}
                </div>
                <div style={{padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: '11px'}}>
                  madness-pool.vercel.app
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Send preview */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
          <div className="font-body font-bold text-chalk text-sm mb-2">Step 1 — Send preview to yourself</div>
          <div className="flex gap-2">
            <input
              type="email"
              value={previewEmail}
              onChange={e => setPreviewEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-chalk font-body text-sm focus:outline-none focus:border-maize-500 placeholder:text-white/20"
            />
            <button
              onClick={() => sendEmail(true)}
              disabled={!previewEmail || sending}
              className={`px-4 py-2 rounded-lg font-bold font-body text-sm shrink-0 transition-all ${previewEmail && !sending ? 'btn-secondary' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
            >
              {sending ? 'Sending...' : 'Send Preview'}
            </button>
          </div>
        </div>

        {/* Send to all */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="font-body font-bold text-chalk text-sm mb-1">Step 2 — Send to {recipientCount} {unpaidOnly ? 'unpaid' : ''} participants</div>
          <p className="text-white/30 text-xs font-body mb-3">Once you're happy with the preview, send to everyone.</p>
          {showConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-amber-400 text-sm font-body">Send to {recipientCount} {unpaidOnly ? 'unpaid ' : ''}participants?</span>
              <button onClick={() => sendEmail(false)} disabled={sending} className="btn-primary text-sm py-2 px-4">
                {sending ? 'Sending...' : 'Yes, send now'}
              </button>
              <button onClick={() => setShowConfirm(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => sendEmail(false)}
              disabled={sending}
              className="btn-primary"
            >
              Send to All Participants →
            </button>
          )}
        </div>

        {result && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm font-body ${result.startsWith('✓') ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
            {result}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState<'teams' | 'participants' | 'scores' | 'import' | 'export' | 'email'>('teams')
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [scores, setScores] = useState<{nickname: string; total_points: number; rank: number}[]>([])
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
    // Always resolve to true or false — null causes blank page
    if (sessionStorage.getItem(ADMIN_KEY) === 'true') {
      const savedPw = sessionStorage.getItem('madness_admin_pw') || ''
      _adminPasswordCache = savedPw
      setPassword(savedPw)  // restore password state so props work after refresh
      setAuthed(true)
    } else {
      setAuthed(false)
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    loadData()
  }, [authed])

  async function loadData() {
    setLoading(true)
    const [teamsRes, partsRes, gamesRes, scoresRes] = await Promise.all([
      supabase.from('teams').select('*').eq('year', YEAR).order('seed'),
      supabase.from('participants').select('id, nickname, full_name, email, payment_received, payment_method, entry_pin').eq('year', YEAR).order('nickname'),
      supabase.from('games').select('*').eq('year', YEAR).order('round'),
      supabase.from('participant_scores').select('nickname, total_points, rank').eq('year', YEAR).order('rank').limit(3),
    ])
    if (teamsRes.data) setTeams(teamsRes.data)
    if (partsRes.data) setParticipants(partsRes.data)
    if (gamesRes.data) setGames(gamesRes.data)
    if (scoresRes.data) setScores(scoresRes.data)
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
      sessionStorage.setItem('madness_admin_pw', password)
      _adminPasswordCache = password
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

  async function deleteGame(gameId: string, loserId: string, round: number) {
    if (!confirm('Delete this game? The losing team will be un-eliminated and scores will recalculate.')) return
    await supabase.from('games').delete().eq('id', gameId)
    await supabase.from('teams').update({ eliminated_round: null }).eq('id', loserId)
    setMsg('Game deleted.')
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

  async function deleteParticipant(participantId: string, nickname: string) {
    if (!confirm(`Delete "${nickname}" and all their picks? This cannot be undone.`)) return
    // picks cascade-delete automatically via FK constraint
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId)
    if (error) {
      setMsg(`Error: ${error.message}`)
    } else {
      setMsg(`✓ Deleted ${nickname} and all their picks.`)
      setParticipants(prev => prev.filter(p => p.id !== participantId))
    }
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
    const tiebreaker = prompt('Tiebreaker (championship total pts):') || ''
    const pin = prompt('4-digit PIN:') || '0000'

    const { data, error } = await supabase
      .from('participants')
      .insert({
        year: YEAR,
        nickname,
        full_name: fullName,
        email,
        tiebreaker: tiebreaker ? parseInt(tiebreaker) : null,
        entry_pin: pin,
        payment_received: true
      })
      .select()
      .single()

    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }

    await loadData()
    setMsg(`✓ Added ${nickname} — now use ✏️ Picks to add their team selections.`)
    // Auto-open picks editor for the new participant
    if (data) setEditingParticipant(data as Participant)
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
            { key: 'compose', label: '📨 Send Email' },
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
                    <button
                      onClick={() => deleteParticipant(p.id, p.nickname)}
                      className="px-3 py-1 rounded-full text-xs font-bold font-body bg-red-500/10 text-red-400/60 border border-red-500/20 hover:bg-red-500/20 hover:text-red-400 transition-all"
                      title="Delete entry"
                    >
                      🗑️
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
            adminPassword={password}
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
                        <span className="text-white/30 text-xs w-20 shrink-0">{ROUND_NAMES[game.round]}</span>
                        <span className="text-emerald-400 font-bold flex-1">{winner?.name}</span>
                        <span className="text-white/50 shrink-0">{game.winner_score}–{game.loser_score}</span>
                        <span className="text-white/30 flex-1">{loser?.name}</span>
                        <button onClick={() => deleteGame(game.id, game.loser_team_id, game.round)} className="text-red-400/40 hover:text-red-400 text-xs ml-2 shrink-0" title="Delete">✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Email list tab */}
        {tab === 'compose' && (
          <EmailComposer
            year={YEAR}
            adminPassword={password}
            participantCount={participants.length}
            paidCount={participants.filter(p => p.payment_received).length}
            topPlayers={scores.slice(0, 3)}
          />
        )}

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
