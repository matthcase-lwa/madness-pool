'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export function getEmailTemplates(participantCount: number, paidCount: number, timeLeft: string, hoursLeft: number, leaderLines: string) {
  const hypeBody = [
    'Hey everyone,',
    '',
    "Just wanted to give you a quick update on this year's pool!",
    '',
    'Pool Update:',
    '- Entries submitted: ' + participantCount,
    '- Payments confirmed: ' + paidCount + ' of ' + participantCount,
    '- Time until tip-off: ' + timeLeft,
    '',
    hoursLeft > 0
      ? "There's still time to submit your picks or make changes before tip-off. Head to the site and use your PIN to edit your selections."
      : 'Picks are now locked — let the madness begin!',
    '',
    'Visit the site: https://madness-pool.vercel.app',
    '',
    'Good luck everyone — may your underdogs run deep!',
    '',
    'Matt',
  ].join('\n')

  const paymentBody = [
    'Hey,',
    '',
    "Just a quick reminder that I haven't received your entry fee yet for this year's pool.",
    '',
    'Please send your entry fee via Venmo or Zelle to matthcase@gmail.com',
    '',
    "If I don't receive payment before tip-off, I'll need to remove your entry from the pool.",
    '',
    "If you've already paid and received this by mistake, please ignore it — I may just be running behind on tracking payments.",
    '',
    'Visit the site: https://madness-pool.vercel.app',
    '',
    'Thanks!',
    'Matt',
  ].join('\n')

  const roundBody = [
    'Hey everyone,',
    '',
    "Here's your Bracketless Madness update!",
    '',
    'Current Leaderboard:',
    leaderLines,
    '',
    'Check the full leaderboard to see where you stand and which of your teams are still alive.',
    '',
    'Visit the site: https://madness-pool.vercel.app',
    '',
    'Matt',
  ].join('\n')

  return {
    hype: {
      label: 'Hype / Pool Update',
      subject: 'Bracketless Madness 2026 — ' + participantCount + ' entries and counting!',
      body: hypeBody,
    },
    payment: {
      label: 'Payment Reminder',
      subject: 'Action needed: Bracketless Madness 2026 payment',
      body: paymentBody,
    },
    round: {
      label: 'Round Update',
      subject: 'Bracketless Madness — Round Update',
      body: roundBody,
    },
  }
}


export function GmailCopyButton({ year, unpaidOnly }: { year: number; unpaidOnly: boolean }) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  async function copyEmails() {
    setLoading(true)
    const { data } = await supabase
      .from('participants')
      .select('email, payment_received')
      .eq('year', year)
      .not('email', 'is', null)
    if (data) {
      const filtered = unpaidOnly ? data.filter((p: any) => !p.payment_received) : data
      const unique = [...new Set(filtered.map((p: any) => p.email).filter(Boolean))] as string[]
      await navigator.clipboard.writeText(unique.join(', '))
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={copyEmails}
      disabled={loading}
      className="btn-secondary text-sm py-2 px-4"
    >
      {loading ? 'Loading...' : copied ? 'Copied!' : 'Copy ' + (unpaidOnly ? 'unpaid' : 'all') + ' emails for Gmail'}
    </button>
  )
}

export default function EmailComposer({ year, adminPassword, participantCount, paidCount, topPlayers }: {
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
  const timeLeft = hoursLeft > 48 ? daysLeft + ' days' : hoursLeft > 0 ? hoursLeft + ' hours' : 'Tip-off has passed'
  const unpaidCount = participantCount - paidCount

  const leaderLines = topPlayers.length > 0
    ? topPlayers.slice(0, 3).map((p, i) => ['1.','2.','3.'][i] + ' ' + p.nickname + ' - ' + p.total_points + ' pts').join('\n')
    : '  Leaderboard updates after games begin'

  const TEMPLATES = getEmailTemplates(participantCount, paidCount, timeLeft, hoursLeft, leaderLines)

  const [template, setTemplate] = useState<string>('hype')
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
                className={template === key ? 'px-4 py-2 rounded-lg text-sm font-body font-bold transition-all bg-maize-500 text-blue-900' : 'px-4 py-2 rounded-lg text-sm font-body font-bold transition-all bg-white/10 text-white/60 hover:bg-white/20'}
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
            className={!unpaidOnly ? 'px-3 py-1.5 rounded-lg text-xs font-bold font-body transition-all bg-maize-500 text-blue-900' : 'px-3 py-1.5 rounded-lg text-xs font-bold font-body transition-all bg-white/10 text-white/50'}
          >
            All {participantCount} participants
          </button>
          <button
            onClick={() => setUnpaidOnly(true)}
            className={unpaidOnly ? 'px-3 py-1.5 rounded-lg text-xs font-bold font-body transition-all bg-amber-500 text-white' : 'px-3 py-1.5 rounded-lg text-xs font-bold font-body transition-all bg-white/10 text-white/50'}
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
              className={previewEmail && !sending ? 'px-4 py-2 rounded-lg font-bold font-body text-sm shrink-0 transition-all btn-secondary' : 'px-4 py-2 rounded-lg font-bold font-body text-sm shrink-0 transition-all bg-white/10 text-white/30 cursor-not-allowed'}
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

        {/* Gmail fallback */}
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-white/30 text-xs font-body mb-2">
            Prefer to send from Gmail? Copy the email list and paste into BCC:
          </p>
          <GmailCopyButton year={year} unpaidOnly={unpaidOnly} />
        </div>

        {result && (
          <div className={result.startsWith('✓') ? 'mt-4 px-4 py-3 rounded-lg text-sm font-body bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'mt-4 px-4 py-3 rounded-lg text-sm font-body bg-red-500/15 text-red-400 border border-red-500/30'}>
            {result}
          </div>
        )}
      </div>
    </div>
  )
}

const JSON_EXAMPLE = '[\n  {\n    "year": 2024,\n    "nickname": "JCohen2",\n    "total_points": 56,\n    "final_rank": 1,\n    "teams_picked": ["Duke", "MSU", ...]\n  }\n]'

