'use client'
import { useState, useEffect } from 'react'

interface CountdownProps {
  deadline: Date
  onExpired?: () => void
  compact?: boolean
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

function getTimeLeft(deadline: Date): TimeLeft {
  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  }
}

export default function Countdown({ deadline, onExpired, compact = false }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft(deadline))

  useEffect(() => {
    const tick = () => {
      const t = getTimeLeft(deadline)
      setTimeLeft(t)
      if (t.expired && onExpired) onExpired()
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadline, onExpired])

  if (timeLeft.expired) {
    return (
      <div className={`${compact ? 'text-sm' : ''} text-red-400 font-body font-bold flex items-center gap-2`}>
        <span>🔒</span>
        <span>Entries are closed — tournament has begun!</span>
      </div>
    )
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 font-body text-sm">
        <span className="text-maize-500">⏱</span>
        <span className="text-white/60">Closes in:</span>
        {timeLeft.days > 0 && <span className="text-chalk font-bold">{timeLeft.days}d</span>}
        <span className="text-chalk font-bold">{pad(timeLeft.hours)}h</span>
        <span className="text-chalk font-bold">{pad(timeLeft.minutes)}m</span>
        <span className="text-maize-400 font-bold tabular-nums">{pad(timeLeft.seconds)}s</span>
      </div>
    )
  }

  return (
    <div className="card p-5 text-center border-maize-500/30 bg-maize-500/5">
      <p className="text-white/50 font-body text-xs tracking-widest uppercase mb-3">
        Entries close at first tip-off
      </p>
      <div className="flex items-center justify-center gap-3">
        {timeLeft.days > 0 && (
          <div className="text-center">
            <div className="font-display text-4xl text-chalk tracking-wider tabular-nums">{timeLeft.days}</div>
            <div className="text-white/30 text-xs font-body uppercase tracking-widest">days</div>
          </div>
        )}
        {timeLeft.days > 0 && <div className="font-display text-3xl text-maize-500/50 mb-3">:</div>}
        <div className="text-center">
          <div className="font-display text-4xl text-chalk tracking-wider tabular-nums">{pad(timeLeft.hours)}</div>
          <div className="text-white/30 text-xs font-body uppercase tracking-widest">hrs</div>
        </div>
        <div className="font-display text-3xl text-maize-500/50 mb-3">:</div>
        <div className="text-center">
          <div className="font-display text-4xl text-chalk tracking-wider tabular-nums">{pad(timeLeft.minutes)}</div>
          <div className="text-white/30 text-xs font-body uppercase tracking-widest">min</div>
        </div>
        <div className="font-display text-3xl text-maize-500/50 mb-3">:</div>
        <div className="text-center">
          <div className="font-display text-4xl text-maize-400 tracking-wider tabular-nums">{pad(timeLeft.seconds)}</div>
          <div className="text-white/30 text-xs font-body uppercase tracking-widest">sec</div>
        </div>
      </div>
      <p className="text-white/30 font-body text-xs mt-3">
        Thu Mar 19 · 12:15 PM ET · First Round tip-off
      </p>
    </div>
  )
}
