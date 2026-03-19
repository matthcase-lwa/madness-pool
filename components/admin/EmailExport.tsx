'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function EmailExport({ year }: { year: number }) {
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
      const unique = [...new Set(data.map(p => p.email).filter(Boolean))]
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

