import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client bypasses RLS — safe here because we verify PIN first
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { participantId, pin, year } = await req.json()

    if (!participantId || !pin || !year) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Verify PIN before returning picks
    const { data: participant } = await adminSupabase
      .from('participants')
      .select('id, entry_pin')
      .eq('id', participantId)
      .eq('year', year)
      .single()

    if (!participant || participant.entry_pin !== pin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
    }

    // Fetch picks — service role bypasses the deadline RLS policy
    const { data: picks, error } = await adminSupabase
      .from('picks')
      .select(`team:team_id(id, name, seed, region, eliminated_round)`)
      .eq('participant_id', participantId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const teams = (picks || []).map((pk: any) => pk.team).filter(Boolean)
    return NextResponse.json({ teams })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
