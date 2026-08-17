-- Multi-tenancy step 1: EXPAND (additive only — safe to apply while old code runs).
-- Also baselines the Sentence/SentenceProgress tables that were created via `db push`
-- in June 2026 and never recorded in migration history (everything is IF NOT EXISTS
-- so this applies cleanly both to prod, where they exist, and to fresh databases).

-- ===== Drift baseline: Sentence =====
CREATE TABLE IF NOT EXISTS "Sentence" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "chinese" TEXT NOT NULL,
    "pinyin" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sentence_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sentence_packId_fkey') THEN
    ALTER TABLE "Sentence" ADD CONSTRAINT "Sentence_packId_fkey"
      FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ===== Drift baseline: SentenceProgress (old childName shape; contract migration converts it) =====
CREATE TABLE IF NOT EXISTS "SentenceProgress" (
    "id" TEXT NOT NULL,
    "childName" TEXT NOT NULL DEFAULT 'julian',
    "packId" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "easiness" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReview" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentenceProgress_pkey" PRIMARY KEY ("id")
);

-- Guarded: after the contract migration drops childName, a re-run of this file must
-- not fail on an index referencing the dropped column (42703 beats IF NOT EXISTS).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'SentenceProgress' AND column_name = 'childName') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "SentenceProgress_childName_packId_sentenceId_key"
      ON "SentenceProgress"("childName", "packId", "sentenceId");
    CREATE INDEX IF NOT EXISTS "SentenceProgress_childName_packId_idx"
      ON "SentenceProgress"("childName", "packId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SentenceProgress_packId_fkey') THEN
    ALTER TABLE "SentenceProgress" ADD CONSTRAINT "SentenceProgress_packId_fkey"
      FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SentenceProgress_sentenceId_fkey') THEN
    ALTER TABLE "SentenceProgress" ADD CONSTRAINT "SentenceProgress_sentenceId_fkey"
      FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ===== Expand: Account + Child =====
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Account_email_key" ON "Account"("email");

CREATE TABLE IF NOT EXISTS "Child" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '🦁',
    "totalHearts" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastPracticed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Child_accountId_idx" ON "Child"("accountId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Child_accountId_fkey') THEN
    ALTER TABLE "Child" ADD CONSTRAINT "Child_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ===== Expand: nullable childId on all per-child tables (old code keeps writing childName) =====
ALTER TABLE "WordProgress"     ADD COLUMN IF NOT EXISTS "childId" TEXT;
ALTER TABLE "SentenceProgress" ADD COLUMN IF NOT EXISTS "childId" TEXT;
ALTER TABLE "MathProgress"     ADD COLUMN IF NOT EXISTS "childId" TEXT;
ALTER TABLE "AnswerEvent"      ADD COLUMN IF NOT EXISTS "childId" TEXT;

CREATE INDEX IF NOT EXISTS "WordProgress_childId_packId_idx"     ON "WordProgress"("childId", "packId");
CREATE INDEX IF NOT EXISTS "SentenceProgress_childId_packId_idx" ON "SentenceProgress"("childId", "packId");
CREATE INDEX IF NOT EXISTS "MathProgress_childId_packId_idx"     ON "MathProgress"("childId", "packId");
CREATE INDEX IF NOT EXISTS "AnswerEvent_childId_packId_wordId_idx" ON "AnswerEvent"("childId", "packId", "wordId");
