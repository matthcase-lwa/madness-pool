'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================
// TRASH TALK
// Live pool chat powered by Supabase Realtime.
// - Anyone can read; posting requires your entry PIN (verified
//   server-side via /api/chat, never with the anon key).
// - Reuses the PIN saved by the My Entries page when available.
// - Madness Bot posts automatic game alerts (finals + upsets).
// ============================================

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')
const PIN_KEY = 'my_entries_pin'
const NICK_KEY = 'trash_talk_nickname'

interface ChatMessage {
  id: string
  nickname: string
  body: string
  is_system: boolean
  created_at: string
  participant_id: string | null
}

export default function TrashTalk() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [draft, setDraft] = useState('')
  const [pin, setPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [myNickname, setMyNickname] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [unread, setUnread] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const collapsedRef = useRef(false)

  // Load saved identity
  useEffect(() => {
    const savedPin = sessionStorage.getItem(PIN_KEY) || localStorage.getItem(PIN_KEY) || ''
    const savedNick = localStorage.getItem(NICK_KEY) || ''
    if (savedPin) {
      setPin(savedPin)
      setPinSaved(true)
    }
    if (savedNick) setMyNickname(savedNick)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      try {
        const res = await fetch('/api/chat?limit=100')
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        if (cancelled) return
        setMessages(data.messages || [])
        setLoading(false)
        setTimeout(scrollToBottom, 50)
      } catch {
        setLoading(false)
      }
    }
    loadHistory()

    const channel = supabase
      .channel('trash-talk')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'year=eq.' + YEAR },
        (payload: any) => {
          const msg = payload.new as ChatMessage
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (collapsedRef.current) {
            setUnread(u => u + 1)
          } else {
            setTimeout(scrollToBottom, 50)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const deletedId = payload.old ? payload.old.id : null
          if (deletedId) setMessages(prev => prev.filter(m => m.id !== deletedId))
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [scrollToBottom])

  useEffect(() => {
    collapsedRef.current = collapsed
    if (!collapsed) {
      setUnread(0)
      setTimeout(scrollToBottom, 50)
    }
  }, [collapsed, scrollToBottom])

  async function send() {
    const body = draft.trim()
    const pinVal = pin.trim()
    if (!body || !pinVal || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', pin: pinVal, body: body }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        if (res.status === 403) setPinSaved(false)
      } else {
        setDraft('')
        if (!pinSaved) {
          localStorage.setItem(PIN_KEY, pinVal)
          setPinSaved(true)
        }
        if (data.message) {
          const msg = data.message as ChatMessage
          localStorage.setItem(NICK_KEY, msg.nickname)
          setMyNickname(msg.nickname)
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          setTimeout(scrollToBottom, 50)
        }
      }
    } catch (e: any) {
      setError('Could not send. Check your connection.')
    }
    setSending(false)
  }

  function handleKeyDown(e: any) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const arrowClass = 'inline-block transition-transform duration-200' + (collapsed ? '' : ' rotate-90')
  const headerBadge = unread > 0 && collapsed
    ? <span className="bg-maize-400 text-navy-900 text-xs font-bold rounded-full px-2 py-0.5">{unread} new</span>
    : null

  return (
    <div className="card p-4 mb-6">
      <button onClick={() => setCollapsed(c => !c)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={arrowClass}>▶</span>
          <span className="font-display text-xl text-maize-400 tracking-wider">TRASH TALK</span>
          {headerBadge}
        </div>
        <span className="text-white/30 text-xs font-body">live pool chat</span>
      </button>

      {!collapsed && (
        <div className="mt-4">
          <div
            ref={listRef}
            className="h-72 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 space-y-2"
          >
            {loading && <p className="text-white/30 text-sm font-body text-center py-4">Loading the smack...</p>}
            {!loading && messages.length === 0 && (
              <p className="text-white/30 text-sm font-body text-center py-4">
                Nothing yet. Be the first to talk some smack. 🏀
              </p>
            )}
            {messages.map(m => <MessageRow key={m.id} msg={m} mine={m.nickname === myNickname && !m.is_system} />)}
          </div>

          <div className="mt-3">
            {!pinSaved && (
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Your entry PIN (to post as your pool name)"
                className="w-full mb-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm font-body text-chalk placeholder-white/30 focus:outline-none focus:border-maize-400/50"
              />
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
                placeholder={pinSaved ? 'Talk your talk...' : 'Enter PIN above, then talk your talk...'}
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm font-body text-chalk placeholder-white/30 focus:outline-none focus:border-maize-400/50"
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim() || !pin.trim()}
                className="rounded-lg bg-maize-400 text-navy-900 font-semibold font-body text-sm px-4 py-2 disabled:opacity-40 hover:bg-maize-300 transition-colors"
              >
                {sending ? '...' : 'Send'}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs font-body mt-2">{error}</p>}
            <p className="text-white/25 text-[10px] font-body mt-2">
              Keep it fun. The commissioner can delete anything that crosses the line.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageRow({ msg, mine }: { msg: ChatMessage, mine: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (msg.is_system) {
    return (
      <div className="rounded-lg bg-maize-400/10 border border-maize-400/20 px-3 py-2">
        <p className="text-maize-300 text-sm font-body">{msg.body}</p>
        <p className="text-white/25 text-[10px] font-body mt-0.5">{msg.nickname} · {time}</p>
      </div>
    )
  }

  const nameClass = mine
    ? 'text-maize-400 text-xs font-semibold font-body'
    : 'text-chalk/90 text-xs font-semibold font-body'

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={nameClass}>{msg.nickname}</span>
        <span className="text-white/25 text-[10px] font-body">{time}</span>
      </div>
      <p className="text-white/80 text-sm font-body break-words">{msg.body}</p>
    </div>
  )
}
