-- ============================================
-- 2026 NCAA TOURNAMENT TEAMS — VERIFIED CORRECT
-- Source: Yahoo Sports / CBS Sports / NBC Sports bracket reveals March 15 2026
-- Run this in Supabase SQL Editor
-- ============================================

DELETE FROM picks WHERE team_id IN (SELECT id FROM teams WHERE year = 2026);
DELETE FROM teams WHERE year = 2026;

-- ══════════════════════════════════════════
-- EAST REGION — Duke #1 overall seed
-- ══════════════════════════════════════════
INSERT INTO teams (year, name, seed, region) VALUES
  (2026, 'Duke',               1,  'East'),
  (2026, 'UConn',              2,  'East'),
  (2026, 'Michigan State',     3,  'East'),
  (2026, 'Kansas',             4,  'East'),
  (2026, 'St. John''s',        5,  'East'),
  (2026, 'Louisville',         6,  'East'),
  (2026, 'UCLA',               7,  'East'),
  (2026, 'Ohio State',         8,  'East'),
  (2026, 'TCU',                9,  'East'),
  (2026, 'UCF',                10, 'East'),
  (2026, 'South Florida',      11, 'East'),
  (2026, 'Northern Iowa',      12, 'East'),
  (2026, 'Cal Baptist',        13, 'East'),
  (2026, 'North Dakota State', 14, 'East'),
  (2026, 'Furman',             15, 'East'),
  (2026, 'Siena',              16, 'East');

-- ══════════════════════════════════════════
-- WEST REGION — Arizona #2 overall seed
-- ══════════════════════════════════════════
INSERT INTO teams (year, name, seed, region) VALUES
  (2026, 'Arizona',            1,  'West'),
  (2026, 'Purdue',             2,  'West'),
  (2026, 'Gonzaga',            3,  'West'),
  (2026, 'Arkansas',           4,  'West'),
  (2026, 'Wisconsin',          5,  'West'),
  (2026, 'BYU',                6,  'West'),
  (2026, 'Miami (FL)',         7,  'West'),
  (2026, 'Villanova',          8,  'West'),
  (2026, 'Utah State',         9,  'West'),
  (2026, 'Missouri',           10, 'West'),
  (2026, 'High Point',         12, 'West'),
  (2026, 'Hawaii',             13, 'West'),
  (2026, 'Kennesaw State',     14, 'West'),
  (2026, 'Queens',             15, 'West'),
  (2026, 'LIU',                16, 'West');

-- West 11: First Four play-in — Texas vs NC State, winner plays BYU
INSERT INTO teams (year, name, seed, region, is_playin_pair, playin_partner) VALUES
  (2026, 'Texas', 11, 'West', TRUE, 'NC State');

-- ══════════════════════════════════════════
-- MIDWEST REGION — Michigan #3 overall seed
-- ══════════════════════════════════════════
INSERT INTO teams (year, name, seed, region) VALUES
  (2026, 'Michigan',           1,  'Midwest'),
  (2026, 'Iowa State',         2,  'Midwest'),
  (2026, 'Virginia',           3,  'Midwest'),
  (2026, 'Alabama',            4,  'Midwest'),
  (2026, 'Texas Tech',         5,  'Midwest'),
  (2026, 'Tennessee',          6,  'Midwest'),
  (2026, 'Kentucky',           7,  'Midwest'),
  (2026, 'Georgia',            8,  'Midwest'),
  (2026, 'Saint Louis',        9,  'Midwest'),
  (2026, 'Santa Clara',        10, 'Midwest'),
  (2026, 'Akron',              12, 'Midwest'),
  (2026, 'Hofstra',            13, 'Midwest'),
  (2026, 'Wright State',       14, 'Midwest'),
  (2026, 'Tennessee State',    15, 'Midwest');

-- Midwest 11: First Four play-in — SMU vs Miami (OH), winner plays Tennessee
INSERT INTO teams (year, name, seed, region, is_playin_pair, playin_partner) VALUES
  (2026, 'SMU', 11, 'Midwest', TRUE, 'Miami (OH)');

-- Midwest 16: First Four play-in — UMBC vs Howard, winner plays Michigan
INSERT INTO teams (year, name, seed, region, is_playin_pair, playin_partner) VALUES
  (2026, 'UMBC', 16, 'Midwest', TRUE, 'Howard');

-- ══════════════════════════════════════════
-- SOUTH REGION — Florida #4 overall seed
-- ══════════════════════════════════════════
INSERT INTO teams (year, name, seed, region) VALUES
  (2026, 'Florida',            1,  'South'),
  (2026, 'Houston',            2,  'South'),
  (2026, 'Illinois',           3,  'South'),
  (2026, 'Nebraska',           4,  'South'),
  (2026, 'Vanderbilt',         5,  'South'),
  (2026, 'North Carolina',     6,  'South'),
  (2026, 'Saint Mary''s',      7,  'South'),
  (2026, 'Clemson',            8,  'South'),
  (2026, 'Iowa',               9,  'South'),
  (2026, 'Texas A&M',          10, 'South'),
  (2026, 'VCU',                11, 'South'),
  (2026, 'McNeese',            12, 'South'),
  (2026, 'Troy',               13, 'South'),
  (2026, 'Penn',               14, 'South'),
  (2026, 'Idaho',              15, 'South');

-- South 16: First Four play-in — Prairie View A&M vs Lehigh, winner plays Florida
INSERT INTO teams (year, name, seed, region, is_playin_pair, playin_partner) VALUES
  (2026, 'Prairie View A&M', 16, 'South', TRUE, 'Lehigh');
