-- Security lockdown: enable RLS with ZERO policies (deny-all) on every public table.
-- Prisma connects as the table-owner role and bypasses RLS, so the app is unaffected.
-- This closes the auto-exposed PostgREST Data API: once guest-first hands every visitor
-- an anon/authenticated JWT, any un-RLS'd public table would be readable AND writable
-- with just the public anon key.
--
-- Run in the Supabase SQL editor (or: npm run db:lockdown). Idempotent.
-- Also recommended (dashboard, Settings → API): disable the Data API entirely —
-- nothing uses PostgREST (the n8n keepalive uses direct Postgres + the Next API).

ALTER TABLE IF EXISTS "Account"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Child"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Pack"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Word"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Sentence"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MathProblem"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "WordProgress"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SentenceProgress"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MathProgress"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AnswerEvent"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "GeneratedQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ChildProfile"      ENABLE ROW LEVEL SECURITY; -- dropped by contract migration; harmless if gone

-- Verify: every row should show rowsecurity = true
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
