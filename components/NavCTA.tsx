'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const DEADLINE = new Date(process.env.NEXT_PUBLIC_ENTRY_DEADLINE || '2026-03-19T16:15:00Z')
const ENTERED_KEY = 'bracketless_entered'

export default function NavCTA() {
  const [pastDeadline, setPastDeadline] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)

  useEffect(() => {
    setPastDeadline(new Date() >= DEADLINE)
    setHasEntered(!!sessionStorage.getItem(ENTERED_KEY))

    const interval = setInterval(() => {
      setPastDeadline(new Date() >= DEADLINE)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // After tipoff — always show My Entries
  if (pastDeadline) {
    return (
      <Link href="/my-entries" className="btn-primary text-sm py-2 px-4">
        My Entries
      </Link>
    )
  }

  // Before tipoff — show My Entries if they've already submitted, Enter Pool if not
  if (hasEntered) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/my-entries" className="btn-secondary text-sm py-2 px-4">
          My Entries
        </Link>
        <Link href="/enter" className="btn-primary text-sm py-2 px-4">
          Enter Pool
        </Link>
      </div>
    )
  }

  return (
    <Link href="/enter" className="btn-primary text-sm py-2 px-4">
      Enter Pool
    </Link>
  )
}
