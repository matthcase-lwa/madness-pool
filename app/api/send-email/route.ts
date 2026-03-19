import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { password, subject, body, previewOnly, previewEmail, unpaidOnly, year } = await req.json()

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured in Vercel environment variables' }, { status: 500 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    if (previewOnly) {
      const { error } = await resend.emails.send({
        from: 'Bracketless Madness <onboarding@resend.dev>',
        to: [previewEmail],
        subject: `[PREVIEW] ${subject}`,
        html: htmlWrap(body),
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ sent: 1, message: 'Preview sent to your email' })
    }

    // Get recipients — all or unpaid only
    let query = adminSupabase
      .from('participants')
      .select('email, payment_received')
      .eq('year', year)
      .not('email', 'is', null)

    if (unpaidOnly) {
      query = query.eq('payment_received', false)
    }

    const { data: participants } = await query

    if (!participants || participants.length === 0) {
      return NextResponse.json({
        error: unpaidOnly
          ? 'No unpaid participants with email addresses found'
          : 'No participants with email addresses found'
      }, { status: 400 })
    }

    const uniqueEmails = [...new Set(
      participants.map((p: any) => p.email).filter(Boolean)
    )] as string[]

    // Send in batches of 50
    let totalSent = 0
    for (let i = 0; i < uniqueEmails.length; i += 50) {
      const batch = uniqueEmails.slice(i, i + 50)
      const { error } = await resend.emails.send({
        from: 'Bracketless Madness <onboarding@resend.dev>',
        to: batch,
        subject,
        html: htmlWrap(body),
      })
      if (error) return NextResponse.json({ error: error.message, sentSoFar: totalSent }, { status: 500 })
      totalSent += batch.length
    }

    return NextResponse.json({
      sent: totalSent,
      message: `Email sent to ${totalSent} ${unpaidOnly ? 'unpaid ' : ''}participants`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function htmlWrap(body: string): string {
  const htmlBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Georgia, serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #00172e; border-radius: 12px; overflow: hidden; }
    .header { background: #FFCB05; padding: 24px 32px; }
    .header h1 { margin: 0; color: #00172e; font-size: 24px; font-family: Arial Black, sans-serif; letter-spacing: 2px; }
    .header p { margin: 4px 0 0; color: #00172e; opacity: 0.7; font-size: 13px; }
    .body { padding: 32px; color: #e8e8e8; font-size: 15px; line-height: 1.7; }
    .footer { padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); font-size: 12px; }
    a { color: #FFCB05; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏀 BRACKETLESS MADNESS</h1>
      <p>2026 Annual Tournament Pool</p>
    </div>
    <div class="body">${htmlBody}</div>
    <div class="footer">
      <p>You're receiving this because you're in the 2026 Bracketless Madness pool.</p>
      <p><a href="https://madness-pool.vercel.app">madness-pool.vercel.app</a></p>
    </div>
  </div>
</body>
</html>`
}
