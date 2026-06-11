# 2027 Refresh — Deployment Notes

Three new features, built on the known-good production codebase:

## What's new

1. **Live Scoreboard (leaderboard page)** — polls NCAA.com's free scoreboard
   feed every 60 seconds. Shows live/upcoming/final tournament games with
   seeds, live clock, and "picked by N" pool context. The moment a game goes
   final, it automatically triggers the score sync — points land on the
   leaderboard with nobody touching the Admin panel.

2. **Trash Talk (leaderboard page)** — live pool chat via Supabase Realtime.
   Anyone can read; posting requires an entry PIN (verified server-side).
   The PIN saved on My Entries is reused automatically. "Madness Bot" posts
   automatic game finals, upset alerts, and "X entries lose a team 💀"
   messages. Admin can delete messages via the /api/chat delete action.

3. **Title Odds (leaderboard page)** — live championship probabilities from
   Kalshi prediction markets. Hidden automatically until markets exist for
   the season.

The Admin > Scores tab Sync Now button now syncs from NCAA.com, with an
"ESPN backup" button kept as a fallback source.

## Why NCAA.com instead of ESPN

The 2026 ESPN sync stalled on team-name matching (130-line hardcoded name
map). NCAA.com's feed includes each team's **seed** and a **stable slug**
(e.g. `ohio-st`) in every game. The new sync matches by slug, then by
seed + name, and **stores the slug back to the teams table the first time
it matches each team** — so matching becomes exact automatically. Anything
it can't match is reported in the sync result for manual entry, never
guessed.

## One-time setup (before next tournament)

1. **Run `migration-2027.sql`** in Supabase Dashboard > SQL Editor.
   Adds the `ncaa_slug` column, the `chat_messages` table, and enables
   realtime for chat. Safe to re-run.

2. **Vercel env vars** — no changes required. Two optional ones:
   - `KALSHI_CHAMP_SERIES_TICKER` — pin the Kalshi championship market
     series once 2027 markets open (find it in the kalshi.com URL of the
     "March Madness winner" market). Without it, the route tries known
     ticker patterns and hides the panel if nothing is found.
   - `NEXT_PUBLIC_SYNC_TOKEN` — already exists; used by the auto-sync.

3. **When loading the 2027 field**, enter teams as usual. No slug entry
   needed — the sync learns them. (Optional: run Sync Now during the
   Opening Round to pre-learn slugs before Round 1.)

## 2027 rule change to decide

The tournament expands to 76 teams in 2027. The First Four becomes a
12-game "Opening Round" (24 teams) feeding the usual 64-team bracket.
Impact here is the play-in workflow: there will be 12 play-in pairs
instead of 4. The existing `is_playin_pair` / `playin_partner` mechanism
still works — there are just more of them. Decide before entries open
whether Opening Round teams are pickable as pairs (current behavior) or
excluded until resolved.

## Files added
- `lib/ncaa.ts` — NCAA feed parsing + team matching
- `app/api/ncaa-scores/route.ts` — live scores (public, cached 30s)
- `app/api/ncaa-sync/route.ts` — completed-game sync + bot messages
- `app/api/chat/route.ts` — chat send/delete (PIN/admin verified)
- `app/api/kalshi-odds/route.ts` — Kalshi odds (public, cached 5 min)
- `components/LiveScoreboard.tsx`, `components/TrashTalk.tsx`,
  `components/TitleOdds.tsx`
- `migration-2027.sql`

## Files modified
- `app/leaderboard/page.tsx` — mounts the three new components
- `app/admin/page.tsx` — Sync Now uses NCAA.com, ESPN backup button,
  shows learned team IDs in sync results
