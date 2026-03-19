import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { password, action, participantId, pickId, teamId, year } = await req.json()

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // GET picks for a participant
    if (action === 'get') {
      const { data, error } = await adminSupabase
        .from('picks')
        .select('id, team:team_id(id, name, seed, region)')
        .eq('participant_id', participantId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ picks: data })
    }

    // DELETE a pick by its row ID
    if (action === 'delete') {
      const { error } = await adminSupabase
        .from('picks')
        .delete()
        .eq('id', pickId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // INSERT a pick
    if (action === 'insert') {
      const { data, error } = await adminSupabase
        .from('picks')
        .insert({ participant_id: participantId, team_id: teamId, year })
        .select('id, team:team_id(id, name, seed, region)')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ pick: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
