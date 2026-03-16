'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const TOUR_KEY = 'bracketless_tour_seen'

const STEPS = [
  {
    icon: '🏀',
    title: 'Welcome to Bracketless Madness!',
    body: "This isn't your typical bracket pool. Instead of picking every game, you pick just 8 teams — and the deeper they go, the more points you earn. Underdogs are rewarded with bonus points, so bold picks actually pay off.",
    cta: null,
  },
  {
    icon: '🎯',
    title: 'Pick Your 8 Teams',
    body: 'You must pick exactly:\n• 1 team seeded #1\n• 3 teams seeded #2, #3, or #4\n• 4 teams seeded #5 or lower\n\nTip: picks seeded #9 or lower earn bonus points for every win — so bold underdog picks can pay off big if they go on a run.',
    cta: null,
  },
  {
    icon: '📊',
    title: 'How Points Work',
    body: 'Every win earns points, and later rounds are worth more:\n\n1st Round: 1pt · 2nd Round: 2pts · Sweet 16: 3pts\nElite 8: 4pts · Final Four: 5pts · Champ: 6pts\n\n+3 bonus for any win by a #9 seed or lower\n+1 bonus per 10-pt margin of victory',
    cta: null,
  },
  {
    icon: '💰',
    title: 'Prizes & Tiebreaker',
    body: 'The top finishers take home the prizes. If two or more people are tied at any prize position, the tiebreaker decides it — whoever predicted the closest total score for the championship game wins that spot.\n\nEveryone must submit a tiebreaker, so no one gets an unfair advantage. Last place gets their entry fee back. 🐢',
    cta: null,
  },
  {
    icon: '🔑',
    title: 'Tracking Your Entries',
    body: "After you submit, you'll get a PIN. Keep it safe — you'll need your email + PIN to view your picks and scores during the tournament on the \"My Entries\" page.\n\nEntering multiple times? Use a different nickname each time (Matt1, Matt2, etc.) with the same email.",
    cta: null,
  },
  {
    icon: '🚀',
    title: "You're Ready!",
    body: "Entries close at the first tip-off of the tournament. After that, the leaderboard updates live as games are played.\n\nGood luck — may your underdogs run deep! 🏆",
    cta: '/enter',
    ctaLabel: 'Submit My Picks →',
  },
]

export default function Tour() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Show tour if never seen before
    if (!localStorage.getItem(TOUR_KEY)) {
      // Small delay so page loads first
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(TOUR_KEY, 'true')
    setVisible(false)
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function prev() {
    setStep(s => Math.max(0, s - 1))
  }

  if (!visible) {
    return (
      <button
        onClick={() => { setStep(0); setVisible(true) }}
        className="text-white/30 hover:text-white/60 text-xs font-body transition-colors flex items-center gap-1"
        title="How to play"
      >
        <span>❓</span> How to play
      </button>
    )
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-0 overflow-hidden border-maize-500/30">

        {/* Progress bar */}
        <div className="w-full bg-white/10 h-1">
          <div
            className="bg-maize-500 h-1 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-7">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    i === step ? 'bg-maize-500 w-4' : i < step ? 'bg-maize-500/40' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={dismiss}
              className="text-white/30 hover:text-white/60 text-sm font-body transition-colors"
            >
              Skip tour ✕
            </button>
          </div>

          {/* Icon */}
          <div className="text-6xl mb-4">{current.icon}</div>

          {/* Title */}
          <h2 className="font-display text-3xl text-chalk tracking-wider mb-4 leading-tight">
            {current.title}
          </h2>

          {/* Body */}
          <div className="text-white/60 font-body text-sm leading-relaxed mb-8 whitespace-pre-line">
            {current.body}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={prev}
              disabled={step === 0}
              className={`font-body text-sm px-4 py-2 rounded-lg transition-all ${
                step === 0 ? 'text-white/20 cursor-default' : 'text-white/50 hover:text-white/80'
              }`}
            >
              ← Back
            </button>

            <div className="flex gap-3">
              {isLast && current.cta ? (
                <>
                  <button onClick={dismiss} className="btn-secondary text-sm py-2 px-4">
                    Got it
                  </button>
                  <Link href={current.cta} onClick={dismiss} className="btn-primary text-sm py-2 px-4">
                    {current.ctaLabel}
                  </Link>
                </>
              ) : (
                <button onClick={next} className="btn-primary text-sm py-2 px-5">
                  {isLast ? 'Done' : 'Next →'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
