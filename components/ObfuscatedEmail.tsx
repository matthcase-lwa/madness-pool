'use client'
import { useState, useEffect } from 'react'

// Email assembled client-side so bots scraping raw HTML never see it
const U = 'matthcase'
const D = 'gmail.com'

export default function ObfuscatedEmail({ className }: { className?: string }) {
  const [email, setEmail] = useState('')

  useEffect(() => {
    setEmail(`${U}@${D}`)
  }, [])

  if (!email) return <span className={className}>matthcase [at] gmail.com</span>

  return (
    <a
      href={`mailto:${email}`}
      className={className ?? 'text-maize-400 hover:text-maize-300 transition-colors underline underline-offset-2'}
    >
      {email}
    </a>
  )
}
