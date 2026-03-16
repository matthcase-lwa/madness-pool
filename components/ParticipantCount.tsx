'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')

export default function ParticipantCount() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const load = () => {
      supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('year', YEAR)
        .then(({ count: c }) => setCount(c ?? 0))
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (count === null) return null

  return (
    <div className="flex items-center gap-2 text-sm font-body">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-white/50">{count}</span>
      <span className="text-white/30">entered</span>
    </div>
  )
}
