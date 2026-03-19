'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ExportPicks({ year, adminPassword }: { year: number; adminPassword: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleExport() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, year, returnCsv: true }),
      })
      if (!res.ok) {
        const d = await res.json()
        setMsg(d.error || 'Export failed')
        setLoading(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bracketless-' + year + '-picks.csv'
      a.click()
      URL.revokeObjectURL(url)
      setMsg('Downloaded successfully')
    } catch (e: any) {
      setMsg('Export failed: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div>
      <button onClick={handleExport} disabled={loading} className="btn-primary">
        {loading ? 'Exporting...' : 'Download Picks CSV'}
      </button>
      {msg && (
        <p className={msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') ? 'text-sm font-body mt-3 text-red-400' : 'text-sm font-body mt-3 text-emerald-400'}>
          {msg}
        </p>
      )}
      <div className="mt-6 bg-black/20 rounded-lg p-4 text-xs font-body text-white/40 space-y-2">
        <p className="font-bold text-white/60">Before making any changes to teams or the database, download a backup first.</p>
        <p>1. Click the button above to download a fresh backup</p>
        <p>2. To fix a team name, use a targeted SQL update in Supabase</p>
      </div>
    </div>
  )
}


