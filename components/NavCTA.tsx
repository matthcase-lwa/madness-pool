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
    setHasEntered(!!localStorage.getItem(ENTERED_KEY))
    const interval = setInterval(() => setPastDeadline(new Date() >= DEADLINE), 10000)
    return () => clearInterval(interval)
  }, [])

  // After tipoff — just My Entries
  if (pastDeadline) {
    return (
      <Link href="/my-entries" className="btn-primary text-sm py-2 px-4">
        My Entries
      </Link>
    )
  }

  // Before tipoff — already submitted: My Entries primary
  if (hasEntered) {
    return (
      <Link href="/my-entries" className="btn-primary text-sm py-2 px-4">
        My Entries
      </Link>
    )
  }

  // Before tipoff — not yet submitted: Submit Entries
  return (
    <Link href="/enter" className="btn-primary text-sm py-2 px-4">
      Submit Entries
    </Link>
  )
}
