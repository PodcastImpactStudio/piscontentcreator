-- ============================================================
-- PODCAST IMPACT CONTENT STUDIO — BETA SETUP SQL
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ── 1. ACCESS CODES TABLE ────────────────────────────────────
-- Creates the table if it doesn't exist yet.

CREATE TABLE IF NOT EXISTS access_codes (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code       text        UNIQUE NOT NULL,
  max_uses   integer     DEFAULT 1,
  uses       integer     DEFAULT 0,
  active     boolean     DEFAULT true,
  note       text,
  created_at timestamptz DEFAULT now()
);


-- ── 2. BETA ACCESS CODES ─────────────────────────────────────
-- Add your beta codes here. Adjust max_uses as needed.
-- BETAPIS2025  → general beta (up to 50 accounts)
-- PISVIP2025   → VIP / hand-picked users (up to 10)
-- Add more rows as needed — just copy the pattern.

INSERT INTO access_codes (code, max_uses, note) VALUES
  ('BETAPIS2025', 50,  'General beta access — 2025'),
  ('PISVIP2025',  10,  'VIP early access — 2025')
ON CONFLICT (code) DO NOTHING;


-- ── 3. ADD PLAN + BETA EXPIRY TO ORGANIZATIONS ───────────────
-- plan: 'beta', 'starter', 'pro', 'agency' (future tiers)
-- beta_expires_at: when the free beta period ends
-- Set 6 months from today by default for all existing orgs.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan           text        DEFAULT 'beta',
  ADD COLUMN IF NOT EXISTS beta_expires_at timestamptz DEFAULT (now() + interval '6 months');

-- Backfill existing orgs that don't have an expiry yet
UPDATE organizations
SET
  plan            = COALESCE(plan, 'beta'),
  beta_expires_at = COALESCE(beta_expires_at, now() + interval '6 months')
WHERE beta_expires_at IS NULL OR plan IS NULL;


-- ── 4. VERIFY ────────────────────────────────────────────────
-- Run these to confirm everything looks right:

SELECT code, max_uses, uses, active, note FROM access_codes ORDER BY created_at;
SELECT id, name, plan, beta_expires_at FROM organizations ORDER BY created_at;
