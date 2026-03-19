'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AutoScoreImporter({ adminPassword, year }: { adminPassword: string; year: number }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [customDates, setCustomDates] = useState('')

  async function runImport() {
    setLoading(true)
    setResult(null)
    let dates: string[] | undefined = undefined
    if (customDates.trim()) {
      dates = customDates.trim().split(',').map(d => d.trim().replace(/-/g, '')).filter(d => d.length > 0)
    }
    try {
      const res = await fetch('/api/auto-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, year, dates }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setResult({ imported: 0, skipped: 0, unmatched: [], results: [], skippedList: [], error: e.message })
    }
    setLoading(false)
  }

  const importCount = result?.imported ?? 0
  const unmatchedCount = result?.unmatched?.length ?? 0

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-display text-2xl text-maize-400 tracking-wider mb-2">AUTO-IMPORT SCORES</h2>
        <p className="text-white/40 text-sm font-body mb-6">
          Pulls completed NCAA Tournament games from ESPN and automatically records results,
          eliminates teams, and updates the leaderboard. Run this after each session of games.
        </p>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-amber-400 text-xs font-body mb-6">
          Only imports completed games. Skips games already in the database. Safe to run multiple times.
        </div>

        <div className="mb-4">
          <label className="text-white/50 text-sm font-body block mb-2">
            Dates (optional — defaults to today)
          </label>
          <input
            type="text"
            value={customDates}
            onChange={e => setCustomDates(e.target.value)}
            placeholder="e.g. 20260320, 20260321"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-chalk font-body text-sm focus:outline-none focus:border-maize-500 placeholder:text-white/20"
          />
          <p className="text-white/20 text-xs font-body mt-1">Format: YYYYMMDD, comma separated</p>
        </div>

        <button
          onClick={runImport}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Importing from ESPN...' : 'Import Results from ESPN'}
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className={importCount > 0 ? 'rounded-lg p-4 text-center border bg-emerald-500/10 border-emerald-500/30' : 'rounded-lg p-4 text-center border bg-white/5 border-white/10'}>
                <div className={importCount > 0 ? 'font-display text-3xl text-emerald-400' : 'font-display text-3xl text-white/30'}>{importCount}</div>
                <div className="text-white/40 text-xs font-body mt-1">imported</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="font-display text-3xl text-white/30">{result.skipped}</div>
                <div className="text-white/40 text-xs font-body mt-1">skipped</div>
              </div>
              <div className={unmatchedCount > 0 ? 'rounded-lg p-4 text-center border bg-red-500/10 border-red-500/30' : 'rounded-lg p-4 text-center border bg-white/5 border-white/10'}>
                <div className={unmatchedCount > 0 ? 'font-display text-3xl text-red-400' : 'font-display text-3xl text-white/30'}>{unmatchedCount}</div>
                <div className="text-white/40 text-xs font-body mt-1">unmatched</div>
              </div>
            </div>

            {result.results && result.results.length > 0 && (
              <div>
                <div className="text-emerald-400 text-xs font-body font-bold uppercase tracking-widest mb-2">Imported</div>
                <div className="bg-black/20 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                  {result.results.map((r: string, i: number) => (
                    <div key={i} className="text-emerald-400/70 text-xs font-body font-mono">{r}</div>
                  ))}
                </div>
              </div>
            )}

            {result.unmatched && result.unmatched.length > 0 && (
              <div>
                <div className="text-red-400 text-xs font-body font-bold uppercase tracking-widest mb-2">Teams not matched — enter manually</div>
                <div className="bg-black/20 rounded-lg p-3 space-y-1">
                  {result.unmatched.map((u: string, i: number) => (
                    <div key={i} className="text-red-400/70 text-xs font-body font-mono">{u}</div>
                  ))}
                </div>
                <p className="text-white/30 text-xs font-body mt-2">Use the Enter Scores tab to record these manually.</p>
              </div>
            )}

            {result.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-body">
                {result.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


