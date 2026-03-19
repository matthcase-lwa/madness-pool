import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { password, year } = await req.json()

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: participants } = await adminSupabase
      .from('participants')
      .select('id, nickname, full_name, email, tiebreaker, entry_pin, payment_received')
      .eq('year', year)
      .order('nickname')

    if (!participants || participants.length === 0) {
      return NextResponse.json({ participants: [], picks: [] })
    }

    const ids = participants.map((p: any) => p.id)
    const { data: picks } = await adminSupabase
      .from('picks')
      .select('participant_id, team:team_id(name, seed)')
      .in('participant_id', ids)

    return NextResponse.json({ participants, picks: picks || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
