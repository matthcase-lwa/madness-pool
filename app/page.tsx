'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { calculatePrizes } from '@/lib/scoring'

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const ENTRY_FEE = parseInt(process.env.NEXT_PUBLIC_ENTRY_FEE || '40')

export default function Home() {
  const [participantCount, setParticipantCount] = useState<number | null>(null)
  const [topPlayers, setTopPlayers] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('year', YEAR)
      setParticipantCount(count ?? 0)

      // Try to get leaderboard preview
      const { data } = await supabase
        .from('participant_scores')
        .select('*')
        .eq('year', YEAR)
        .order('rank')
        .limit(3)
      if (data) setTopPlayers(data)
    }
    load()
  }, [])

  const prizes = calculatePrizes(participantCount ?? 72, ENTRY_FEE)

  return (
    <div className="min-h-screen bg-hardwood court-texture grain relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-court-500/5 blur-3xl" />
        <div className="absolute top-1/2 -left-48 w-96 h-96 rounded-full bg-court-600/10 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-64 h-64 rounded-full bg-court-400/5 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl text-court-500 tracking-wider">🏀</span>
            <span className="font-display text-xl tracking-widest text-chalk">MADNESS POOL</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/history" className="nav-link">History</Link>
            <Link href="/enter" className="btn-primary text-sm py-2 px-4">Enter Pool</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="stagger-child animate-delay-100 mb-3">
          <span className="text-court-500 font-body text-sm tracking-[0.3em] uppercase font-bold">
            {YEAR} Season
          </span>
        </div>

        <h1 className="stagger-child animate-delay-200 font-display text-8xl md:text-[10rem] leading-none text-chalk mb-6 tracking-wider">
          MARCH<br />
          <span className="text-court-500">MADNESS</span>
        </h1>

        <p className="stagger-child animate-delay-300 text-white/50 text-lg max-w-xl mb-12 font-body leading-relaxed">
          Pick 8 teams. Survive the chaos. The annual pool where underdogs are rewarded
          and every upset matters.
        </p>

        <div className="stagger-child animate-delay-400 flex flex-wrap gap-4 mb-20">
          <Link href="/enter" className="btn-primary text-lg px-8 py-4">
            Submit Your Picks →
          </Link>
          <Link href="/leaderboard" className="btn-secondary text-lg px-8 py-4">
            View Leaderboard
          </Link>
        </div>

        {/* Stats row */}
        <div className="stagger-child animate-delay-500 grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { label: 'Entry Fee', value: `$${ENTRY_FEE}` },
            { label: 'Players', value: participantCount !== null ? participantCount.toString() : '—' },
            { label: 'Prize Pool', value: participantCount ? `$${prizes.pool.toLocaleString()}` : '—' },
            { label: 'Teams to Pick', value: '8' },
          ].map(stat => (
            <div key={stat.label} className="card p-5">
              <div className="font-display text-4xl text-court-400 tracking-wider">{stat.value}</div>
              <div className="text-white/40 text-xs mt-1 tracking-widest uppercase font-body">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Rules + Prizes side by side */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Rules */}
          <div className="card p-6">
            <h2 className="font-display text-3xl text-court-400 tracking-wider mb-5">THE RULES</h2>
            <div className="space-y-3 text-sm text-white/70 font-body">
              <div className="accent-line">
                <strong className="text-chalk">Pick 8 teams:</strong> 1 must be a #1 seed, 3 must be seeded #2–#4, and 4 must be seeded #5 or lower.
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Scoring:</strong> 1 pt per win, +1–6 pts for advancing (Sweet 16 through Championship), +3 pts per underdog win (seed #9+), +1 pt per 10-pt margin.
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Play-in teams:</strong> Pick the pair — you earn points for whichever makes it.
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Tiebreaker:</strong> Predict total points scored in the championship game. Closest wins; furthest wins last place.
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Payment:</strong> $40 via Venmo or Zelle to matthcase@gmail.com.
              </div>
            </div>
          </div>

          {/* Prizes */}
          <div className="card p-6">
            <h2 className="font-display text-3xl text-court-400 tracking-wider mb-5">PRIZE BREAKDOWN</h2>
            <div className="space-y-2">
              {prizes.places.map((p, i) => (
                <div key={p.place} className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${i === 0 ? 'bg-court-500/20 border border-court-500/30' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-display text-xl tracking-wider ${i === 0 ? 'text-court-400' : 'text-white/50'}`}>{p.place}</span>
                    <span className="text-white/40 text-xs font-body">{p.pct}</span>
                  </div>
                  <span className={`font-body font-bold ${i === 0 ? 'text-court-400 text-xl' : 'text-white/70'}`}>
                    ${p.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              {participantCount === null && (
                <p className="text-white/30 text-xs mt-2 font-body italic">Amounts update as entries come in</p>
              )}
            </div>
          </div>
        </div>

        {/* Live leaderboard preview */}
        {topPlayers.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-3xl text-court-400 tracking-wider">CURRENT LEADERS</h2>
              <Link href="/leaderboard" className="text-court-500 text-sm font-body hover:text-court-400 transition-colors">
                Full leaderboard →
              </Link>
            </div>
            <div className="space-y-2">
              {topPlayers.map((p, i) => (
                <div key={p.participant_id} className="flex items-center gap-4 py-3 px-4 bg-white/5 rounded-lg">
                  <span className={`font-display text-2xl tracking-wider w-8 ${i === 0 ? 'text-court-400' : 'text-white/40'}`}>
                    {i === 0 ? '🏆' : `#${i + 1}`}
                  </span>
                  <span className="font-body font-bold text-chalk flex-1">{p.nickname}</span>
                  <div className="text-right">
                    <div className="font-display text-2xl text-court-400 tracking-wide">{p.total_points}</div>
                    <div className="text-white/30 text-xs font-body">pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-6 mt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-white/30 text-xs font-body">
          <span>© {YEAR} March Madness Pool</span>
          <Link href="/admin" className="hover:text-white/50 transition-colors">Admin</Link>
        </div>
      </footer>
    </div>
  )
}
