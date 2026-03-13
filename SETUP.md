# 🏀 March Madness Pool — Setup & Deployment Guide

## Overview
This is a Next.js 14 app with Supabase as the database, deployable to Vercel for free.

---

## Step 1: Set Up Supabase (Free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — give it a name like "madness-pool"
3. Choose a region close to you and set a database password
4. Once created, go to **SQL Editor** in the left sidebar
5. Paste the entire contents of `supabase-schema.sql` and click **Run**
6. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Deploy to Vercel (Free)

1. Push this project folder to a GitHub repo
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/madness-pool.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Click **New Project** → import your repo
4. Add these **Environment Variables** in Vercel:
   ```
   NEXT_PUBLIC_SUPABASE_URL        = (from Supabase)
   NEXT_PUBLIC_SUPABASE_ANON_KEY   = (from Supabase)
   SUPABASE_SERVICE_ROLE_KEY       = (from Supabase)
   ADMIN_PASSWORD                  = (choose something strong)
   NEXT_PUBLIC_POOL_YEAR           = 2026
   NEXT_PUBLIC_ENTRY_FEE           = 40
   ```
5. Click **Deploy** — it'll be live in ~2 minutes at a `.vercel.app` URL

---

## Step 3: Load the 2026 Tournament Teams

Once deployed, go to `yoursite.vercel.app/admin` and log in with your password.

Under **Teams**, add all 68 teams. For each team you need:
- **Name** (e.g. "Duke")
- **Seed** (1–16)
- **Region** (East / West / South / Midwest) — optional but nice for the submission form
- **Play-in pair** — check this box for play-in teams and enter the partner name

**Tip:** The bracket is typically announced on Selection Sunday (mid-March).

---

## Step 4: Share the Submission Link

Send participants to: `yoursite.vercel.app/enter`

They pick their 8 teams, enter their name/email, tiebreaker, and submit.
You'll see all entries in the Admin → Participants tab, where you can mark payments.

---

## Step 5: Enter Game Results During the Tournament

Go to **Admin → Enter Scores** after each game:
1. Select the round
2. Select the winner and loser
3. Enter the final scores
4. Hit **Save** — scores and leaderboard update instantly for everyone

The leaderboard at `yoursite.vercel.app/leaderboard` auto-refreshes every 60 seconds.

---

## Step 6: Import Historical Data (Optional but Fun)

To power the Hall of History page with 10 years of past results:

1. Go to **Admin → Import History**
2. For each past year, create a JSON array like this:

```json
[
  {
    "year": 2024,
    "nickname": "JCohen2",
    "full_name": "Josh Cohen",
    "total_points": 56,
    "final_rank": 1,
    "teams_picked": ["Duke", "MSU", "Texas Tech", "St. John's", "VCU", "Drake", "Arkansas", "McNeese"]
  },
  {
    "year": 2024,
    "nickname": "RBuganski1",
    "full_name": "Ryan Buganski",
    "total_points": 55,
    "final_rank": 2,
    "teams_picked": ["Duke", "St. John's", "Alabama", "MSU", "Michigan", "Gonzaga", "Drake", "Colorado St."]
  }
]
```

**Shortcut:** Share your old Excel files with me and I'll convert them to the right JSON format for you — ready to paste and import.

---

## Pages Summary

| URL | Purpose |
|-----|---------|
| `/` | Homepage with rules, prizes, leaderboard preview |
| `/enter` | Participant team submission form |
| `/leaderboard` | Live leaderboard with expandable picks |
| `/history` | Hall of History with player stats & fun facts |
| `/admin` | Password-protected admin dashboard |

---

## Scoring Logic (for reference)

| Event | Points |
|-------|--------|
| Win in Round of 64 | 1 |
| Win in Round of 32 | 2 |
| Win in Sweet 16 | 3 |
| Win in Elite 8 | 4 |
| Win in Final Four | 5 |
| Win Championship | 6 |
| Any win by seed #9 or higher | +3 bonus |
| Win margin 10–19 pts | +1 |
| Win margin 20–29 pts | +2 |
| Win margin 30–39 pts | +3 |
| (and so on...) | |

---

## Customizing for Future Years

At the start of each new year:
1. Update `NEXT_PUBLIC_POOL_YEAR` in Vercel environment variables to the new year
2. Re-deploy (Vercel does this automatically if you push to main)
3. Load the new bracket teams in Admin → Teams
4. That's it — all historical data stays intact

---

## Optional Custom Domain

In Vercel → Project → Settings → Domains, you can add a custom domain (e.g. `matthcasemadness.com`) for ~$10/year from any registrar.

---

## Getting Help

If anything breaks or you want new features, just share the error or request and I can update the code. Key areas for future enhancements:
- Email notifications after each round
- Automatic score pulling from a sports API
- Per-participant shareable stats pages
- Mobile push notifications
