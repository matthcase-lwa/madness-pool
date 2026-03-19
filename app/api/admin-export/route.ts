import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function csvCell(val: unknown): string {
  const s = String(val == null ? '' : val)
  return '"' + s.split('"').join('""') + '"'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password, year, returnCsv } = body

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: participants } = await adminSupabase
      .from('participants')
      .select('id, nickname, full_name, email, tiebreaker, entry_pin, payment_received')
      .eq('year', year)
      .order('nickname')

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: 'No participants found' }, { status: 400 })
    }

    const ids = participants.map((p: any) => p.id)
    const { data: picks } = await adminSupabase
      .from('picks')
      .select('participant_id, team:team_id(name, seed)')
      .in('participant_id', ids)

    // If returnCsv, build and return as file
    if (returnCsv) {
      const pickMap: Record<string, { name: string; seed: number }[]> = {}
      participants.forEach((p: any) => { pickMap[p.id] = [] })
      picks?.forEach((pk: any) => {
        if (pk.team && pickMap[pk.participant_id]) {
          pickMap[pk.participant_id].push(pk.team)
        }
      })
      Object.keys(pickMap).forEach(id => {
        pickMap[id].sort((a: any, b: any) => a.seed - b.seed)
      })

      const headers = ['Nickname','Full Name','Email','Tiebreaker','PIN','Paid',
        'Pick 1','Pick 2','Pick 3','Pick 4','Pick 5','Pick 6','Pick 7','Pick 8']

      const rows = participants.map((p: any) => {
        const mp = pickMap[p.id] || []
        const cells = [
          p.nickname, p.full_name || '', p.email || '',
          p.tiebreaker ?? '', p.entry_pin || '',
          p.payment_received ? 'Yes' : 'No',
          ...Array.from({ length: 8 }, (_: unknown, i: number) =>
            mp[i] ? mp[i].name + ' (#' + mp[i].seed + ')' : ''
          ),
        ]
        return cells.map(csvCell).join(',')
      })

      const csv = [headers.join(','), ...rows].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="bracketless-' + year + '-picks.csv"',
        },
      })
    }

    // Otherwise return JSON (used by email composer)
    return NextResponse.json({ participants, picks: picks || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
