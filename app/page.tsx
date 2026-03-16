'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { calculatePrizes } from '@/lib/scoring'
import dynamic from 'next/dynamic'

const Countdown = dynamic(() => import('@/components/Countdown'), { ssr: false })
const Tour = dynamic(() => import('@/components/Tour'), { ssr: false })
const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const NavCTA = dynamic(() => import('@/components/NavCTA'), { ssr: false })

const DEADLINE = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')
const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const ENTRY_FEE = parseInt(process.env.NEXT_PUBLIC_ENTRY_FEE || '40')

export default function Home() {
  const [participantCount, setParticipantCount] = useState<number | null>(null)
  const [topPlayers, setTopPlayers] = useState<any[]>([])
  const [entriesOpen, setEntriesOpen] = useState(new Date() < DEADLINE)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('year', YEAR)
      setParticipantCount(count ?? 0)

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
    <div className="min-h-screen bg-hardwood court-texture grain relative">
      <Tour />

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-maize-500/5 blur-3xl" />
        <div className="absolute top-1/2 -left-48 w-96 h-96 rounded-full bg-maize-600/10 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-64 h-64 rounded-full bg-maize-400/5 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/10 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="font-display text-xl text-maize-500 tracking-wider">🏀</span>
            <span className="font-display text-sm sm:text-base lg:text-xl tracking-widest text-chalk">
              March "Bracketless" Madness
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/bracket" className="nav-link">Bracket</Link>
            <Link href="/picks" className="nav-link">All Picks</Link>
            <Link href="/history" className="nav-link">History</Link>
            <NavCTA />
            <ParticipantCount />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="md:hidden text-white/60 hover:text-white transition-colors p-1"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 mt-3 pt-3 pb-2 px-4 space-y-3">
            {[
              { href: '/leaderboard', label: 'Leaderboard' },
              { href: '/bracket', label: 'Bracket' },
              { href: '/picks', label: 'All Picks' },
              { href: '/history', label: 'History' },
            ].map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-white/60 hover:text-maize-400 font-body text-sm py-1 transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <NavCTA />
              <ParticipantCount />
            </div>
          </div>
        )}
      </nav>

      {/* Hero + content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 lg:pt-8 pb-10">

        {/* Season tag */}
        <div className="mb-2">
          <span className="text-maize-500 font-body text-xs sm:text-sm tracking-[0.3em] uppercase font-bold">
            {YEAR} Season
          </span>
        </div>

        {/* Hero heading — scales from mobile to desktop */}
        <h1 className="font-display text-4xl sm:text-6xl lg:text-8xl xl:text-9xl leading-none text-chalk mb-3 tracking-wider">
          BRACKETLESS<br />
          <span className="text-maize-500">MADNESS</span>
        </h1>

        <p className="text-white/50 text-sm sm:text-base lg:text-lg max-w-xl mb-4 font-body leading-relaxed">
          Pick 8 teams. Survive the chaos. The annual pool where underdogs are rewarded
          and every upset matters.
        </p>

        {/* Countdown */}
        <div className="mb-4">
          <Countdown deadline={DEADLINE} compact onExpired={() => setEntriesOpen(false)} />
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          {entriesOpen ? (
            <Link href="/enter" className="btn-primary px-6 py-3 text-sm sm:text-base">
              Submit Your Picks →
            </Link>
          ) : (
            <Link href="/picks" className="btn-primary px-6 py-3 text-sm sm:text-base">
              View All Picks →
            </Link>
          )}
          <Link href="/leaderboard" className="btn-secondary px-6 py-3 text-sm sm:text-base">
            View Leaderboard
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Entry Fee', value: 'Ask Matt' },
            { label: 'Players', value: participantCount !== null ? participantCount.toString() : '—' },
            { label: 'Prize Pool', value: 'TBD' },
            { label: 'Teams to Pick', value: '8' },
          ].map(stat => (
            <div key={stat.label} className="card p-3 sm:p-5">
              <div className="font-display text-2xl sm:text-4xl text-maize-400 tracking-wider">{stat.value}</div>
              <div className="text-white/40 text-xs mt-1 tracking-widest uppercase font-body">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Rules + Prizes — stack on mobile, side by side on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="card p-4 sm:p-6">
            <h2 className="font-display text-2xl sm:text-3xl text-maize-400 tracking-wider mb-4">THE RULES</h2>
            <div className="space-y-3 text-xs sm:text-sm text-white/70 font-body">
              <div className="accent-line">
                <strong className="text-chalk">Pick 8 teams:</strong> 1 must be a #1 seed, 3 must be seeded #2–#4, and 4 must be seeded #5 or lower.
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Scoring — every win earns points, and deeper runs earn more:</strong>
                <div className="mt-2 space-y-1 text-xs text-white/50">
                  <div className="grid grid-cols-2 gap-x-4">
                    <span>Round of 64 win</span><span className="text-chalk font-bold">1 pt</span>
                    <span>Round of 32 win</span><span className="text-chalk font-bold">2 pts</span>
                    <span>Sweet 16 win</span><span className="text-chalk font-bold">3 pts</span>
                    <span>Elite 8 win</span><span className="text-chalk font-bold">4 pts</span>
                    <span>Final Four win</span><span className="text-chalk font-bold">5 pts</span>
                    <span>Championship win</span><span className="text-chalk font-bold">6 pts</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                    <div><span className="text-emerald-400 font-bold">+3 pts</span> for every win by a #9 seed or lower <span className="text-white/30">(e.g. a #12 seed beating a #5 earns 1 + 3 = 4 pts)</span></div>
                    <div><span className="text-maize-400 font-bold">+1 pt</span> per 10-point margin of victory <span className="text-white/30">(win by 23 = +2 pts · win by 31 = +3 pts)</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10 text-white/40 italic">
                    Example: your #11 seed wins by 15 in the Round of 64 → 1 pt + 3 pts (underdog) + 1 pt (margin) = 5 pts total
                  </div>
                </div>
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Play-in teams:</strong> Pick the pair — you earn points for whichever makes it.
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Tiebreaker:</strong> Predict total points scored in the championship game. Closest wins; furthest wins last place.
              </div>
              <div className="accent-line">
                <strong className="text-chalk">Payment:</strong> Entry fee via Venmo or Zelle to matthcase@gmail.com.
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <h2 className="font-display text-2xl sm:text-3xl text-maize-400 tracking-wider mb-4">PRIZE BREAKDOWN</h2>
            <div className="space-y-2">
              {prizes.places.map((p, i) => (
                <div key={p.place} className={`flex items-center justify-between py-2 px-3 rounded-lg ${i === 0 ? 'bg-maize-500/20 border border-maize-500/30' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-display text-lg sm:text-xl tracking-wider ${i === 0 ? 'text-maize-400' : 'text-white/50'}`}>{p.place}</span>
                    <span className="text-white/40 text-xs font-body">{p.pct}</span>
                  </div>
                  <span className={`font-body font-bold text-right ${i === 0 ? 'text-maize-400' : 'text-white/50'} text-xs`}>
                    {i === prizes.places.length - 1 ? 'Entry fee back' : 'Updates at tip-off'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live leaderboard preview */}
        {topPlayers.length > 0 && (
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl sm:text-3xl text-maize-400 tracking-wider">CURRENT LEADERS</h2>
              <Link href="/leaderboard" className="text-maize-500 text-sm font-body hover:text-maize-400 transition-colors">
                Full leaderboard →
              </Link>
            </div>
            <div className="space-y-2">
              {topPlayers.map((p, i) => (
                <div key={p.participant_id} className="flex items-center gap-3 py-2.5 px-4 bg-white/5 rounded-lg">
                  <span className={`font-display text-xl tracking-wider w-8 ${i === 0 ? 'text-maize-400' : 'text-white/40'}`}>
                    {i === 0 ? '🏆' : `#${i + 1}`}
                  </span>
                  <span className="font-body font-bold text-chalk flex-1 text-sm">{p.nickname}</span>
                  <div className="text-right">
                    <div className="font-display text-xl text-maize-400 tracking-wide">{p.total_points}</div>
                    <div className="text-white/30 text-xs font-body">pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-4 sm:px-6 py-4 mt-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-white/30 text-xs font-body">
          <span>© {YEAR} Bracketless Madness</span>
          <div className="flex items-center gap-4">
            <Tour />
            <Link href="/admin" className="hover:text-white/50 transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
