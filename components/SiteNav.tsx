'use client'
import Link from 'next/link'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const ParticipantCount = dynamic(() => import('@/components/ParticipantCount'), { ssr: false })
const NavCTA = dynamic(() => import('@/components/NavCTA'), { ssr: false })
const Tour = dynamic(() => import('@/components/Tour'), { ssr: false })

const NAV_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/bracket',     label: 'Bracket' },
  { href: '/picks',       label: 'All Picks' },
  { href: '/history',     label: 'History' },
]

export default function SiteNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
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
        <div className="hidden md:flex items-center gap-4 lg:gap-5">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="nav-link">
              {l.label}
            </Link>
          ))}
          <Tour />
          <NavCTA />
          <ParticipantCount />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="md:hidden text-white/60 hover:text-white transition-colors p-1 text-xl"
          aria-label="Toggle menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 mt-3 pt-3 pb-3 px-4 space-y-3">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block text-white/60 hover:text-maize-400 font-body text-sm py-1 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
            <Tour />
            <NavCTA />
            <ParticipantCount />
          </div>
        </div>
      )}
    </nav>
  )
}
