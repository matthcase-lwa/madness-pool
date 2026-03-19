import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { participantId, pin, removeTeamId, addTeamId, year } = await req.json()

    if (!participantId || !pin || !removeTeamId || !addTeamId || !year) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Verify deadline
    const deadline = new Date('2026-03-19T16:15:00Z')
    if (new Date() >= deadline) {
      return NextResponse.json({ error: 'Entries are locked after tip-off.' }, { status: 403 })
    }

    // Verify PIN
    const { data: participant } = await adminSupabase
      .from('participants')
      .select('id, entry_pin')
      .eq('id', participantId)
      .eq('year', year)
      .single()

    if (!participant || participant.entry_pin !== pin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
    }

    // Delete old pick
    const { error: delErr } = await adminSupabase
      .from('picks')
      .delete()
      .eq('participant_id', participantId)
      .eq('team_id', removeTeamId)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // Insert new pick
    const { error: insErr } = await adminSupabase
      .from('picks')
      .insert({ participant_id: participantId, team_id: addTeamId, year })

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
