-- ============================================
-- MARCH MADNESS POOL - SUPABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================

-- Teams table (populated each year by admin)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  name TEXT NOT NULL,
  seed INT NOT NULL CHECK (seed BETWEEN 1 AND 16),
  region TEXT, -- East, West, South, Midwest
  is_playin_pair BOOLEAN DEFAULT FALSE,
  playin_partner TEXT, -- for play-in pairs, e.g. "Texas/Xavier"
  eliminated_round INT, -- null = still in, 1 = lost R1, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  nickname TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  payment_received BOOLEAN DEFAULT FALSE,
  payment_method TEXT,
  tiebreaker INT, -- predicted total championship points
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, nickname)
);

-- Participant team picks
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  year INT NOT NULL,
  UNIQUE(participant_id, team_id)
);

-- Games / bracket results (admin enters after each game)
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  round INT NOT NULL CHECK (round BETWEEN 1 AND 6), -- 1=R64, 2=R32, 3=S16, 4=E8, 5=F4, 6=Championship
  winner_team_id UUID REFERENCES teams(id),
  loser_team_id UUID REFERENCES teams(id),
  winner_score INT,
  loser_score INT,
  margin INT GENERATED ALWAYS AS (ABS(winner_score - loser_score)) STORED,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical data table (for 10-year stats import)
CREATE TABLE historical_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  nickname TEXT NOT NULL,
  full_name TEXT,
  total_points INT,
  final_rank INT,
  teams_picked TEXT[], -- array of team names
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computed scores view (updated dynamically)
CREATE OR REPLACE VIEW participant_scores AS
WITH team_points AS (
  SELECT
    t.id as team_id,
    t.year,
    t.name,
    t.seed,
    -- Base round points
    COALESCE(SUM(
      CASE g.round
        WHEN 1 THEN 1
        WHEN 2 THEN 2
        WHEN 3 THEN 3
        WHEN 4 THEN 4
        WHEN 5 THEN 5
        WHEN 6 THEN 6
        ELSE 0
      END
      -- Underdog bonus: seed 9+ gets +3 per win
      + CASE WHEN t.seed >= 9 THEN 3 ELSE 0 END
      -- Margin bonus: +1 per 10 pts margin
      + FLOOR(g.margin / 10)
    ), 0) as points,
    MAX(g.round) as deepest_round,
    COUNT(g.id) as wins
  FROM teams t
  LEFT JOIN games g ON g.winner_team_id = t.id AND g.year = t.year
  GROUP BY t.id, t.year, t.name, t.seed
),
participant_totals AS (
  SELECT
    p.id as participant_id,
    p.year,
    p.nickname,
    p.full_name,
    p.tiebreaker,
    SUM(tp.points) as total_points,
    COUNT(CASE WHEN tp.deepest_round IS NOT NULL THEN 1 END) as teams_with_wins,
    -- Teams still alive (not eliminated)
    COUNT(CASE WHEN t2.eliminated_round IS NULL THEN 1 END) as teams_alive
  FROM participants p
  JOIN picks pk ON pk.participant_id = p.id
  JOIN teams t2 ON t2.id = pk.team_id
  JOIN team_points tp ON tp.team_id = pk.team_id
  GROUP BY p.id, p.year, p.nickname, p.full_name, p.tiebreaker
)
SELECT
  *,
  RANK() OVER (PARTITION BY year ORDER BY total_points DESC) as rank
FROM participant_totals;

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_results ENABLE ROW LEVEL SECURITY;

-- Public read access for leaderboard/scores
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read participants" ON participants FOR SELECT USING (true);
CREATE POLICY "Public read picks" ON picks FOR SELECT USING (true);
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);
CREATE POLICY "Public read history" ON historical_results FOR SELECT USING (true);

-- Only service role (admin) can write
CREATE POLICY "Admin insert teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin update teams" ON teams FOR UPDATE USING (true);
CREATE POLICY "Admin insert participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin update participants" ON participants FOR UPDATE USING (true);
CREATE POLICY "Admin insert picks" ON picks FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin insert games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin insert history" ON historical_results FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_teams_year ON teams(year);
CREATE INDEX idx_participants_year ON participants(year);
CREATE INDEX idx_picks_participant ON picks(participant_id);
CREATE INDEX idx_games_year_round ON games(year, round);
CREATE INDEX idx_historical_year ON historical_results(year);
CREATE INDEX idx_historical_nickname ON historical_results(nickname);

-- ============================================
-- SCHEMA UPDATES: Multiple entries per email
-- Run this if you already ran the original schema
-- ============================================

-- Add index on email for fast "my entries" lookups
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email, year);

-- Add index on nickname for fast lookups
CREATE INDEX IF NOT EXISTS idx_participants_nickname ON participants(year, nickname);

-- ============================================
-- ADD PIN COLUMN for My Entries auth
-- Run this in Supabase SQL Editor if already deployed
-- ============================================
ALTER TABLE participants ADD COLUMN IF NOT EXISTS entry_pin TEXT;
