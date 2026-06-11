import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================
// TRASH TALK CHAT API
// All writes go through here with the service role key.
// POST { action: 'send', pin, body }            -> verify PIN, insert message
// POST { action: 'delete', password, messageId } -> admin moderation
// GET  ?limit=100                                -> recent messages (public)
// ============================================

const YEAR = parseInt(process.env.NEXT_PUBLIC_POOL_YEAR || '2026')

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Per-instance rate limit: 1 message / 3 seconds per participant
const _lastPost: Record<string, number> = {}

export async function GET(req: NextRequest) {
  const supabase = getAdminClient()
  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = Math.min(parseInt(limitParam || '100') || 100, 200)

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, nickname, body, is_system, created_at, participant_id')
    .eq('year', YEAR)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: (data || []).reverse() })
}

export async function POST(req: NextRequest) {
  let payload: any = {}
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const action = payload.action || 'send'

  if (action === 'delete') {
    if (!payload.password || payload.password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!payload.messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })
    const { error } = await supabase.from('chat_messages').delete().eq('id', payload.messageId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // action === 'send'
  const pin = (payload.pin || '').trim()
  const body = (payload.body || '').trim()

  if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  if (!body) return NextResponse.json({ error: 'Message is empty' }, { status: 400 })
  if (body.length > 500) return NextResponse.json({ error: 'Keep it under 500 characters' }, { status: 400 })

  // Verify PIN belongs to a participant this year
  const { data: participant, error: pErr } = await supabase
    .from('participants')
    .select('id, nickname')
    .eq('year', YEAR)
    .eq('entry_pin', pin)
    .limit(1)
    .maybeSingle()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!participant) {
    return NextResponse.json({ error: 'PIN not recognized. Use the PIN from your entry confirmation.' }, { status: 403 })
  }

  // Rate limit
  const last = _lastPost[participant.id] || 0
  if (Date.now() - last < 3000) {
    return NextResponse.json({ error: 'Slow down! One message every few seconds.' }, { status: 429 })
  }
  _lastPost[participant.id] = Date.now()

  const { data: inserted, error: insErr } = await supabase
    .from('chat_messages')
    .insert({
      year: YEAR,
      participant_id: participant.id,
      nickname: participant.nickname,
      body: body,
      is_system: false,
    })
    .select('id, nickname, body, is_system, created_at, participant_id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: inserted })
}
