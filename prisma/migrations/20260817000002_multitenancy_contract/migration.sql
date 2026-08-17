-- Multi-tenancy step 3: CONTRACT. Deploy together with the childId-based route code.
-- HARD GUARD: refuses to run (and rolls back, migrations are transactional) if the
-- backfill (scripts/migrate-multitenancy.ts) hasn't mapped every row to a childId.

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM "WordProgress"     WHERE "childId" IS NULL
    UNION ALL SELECT 1 FROM "SentenceProgress" WHERE "childId" IS NULL
    UNION ALL SELECT 1 FROM "MathProgress"     WHERE "childId" IS NULL
    UNION ALL SELECT 1 FROM "AnswerEvent"      WHERE "childId" IS NULL
  ) t;
  IF n > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows with NULL childId. Run scripts/migrate-multitenancy.ts first.', n;
  END IF;
END $$;

-- ===== WordProgress (= ChineseProgress model) =====
ALTER TABLE "WordProgress" ALTER COLUMN "childId" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WordProgress_childId_fkey') THEN
    ALTER TABLE "WordProgress" ADD CONSTRAINT "WordProgress_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "WordProgress_childId_packId_wordId_key"
  ON "WordProgress"("childId", "packId", "wordId");
DROP INDEX IF EXISTS "WordProgress_childName_packId_wordId_key";
DROP INDEX IF EXISTS "WordProgress_childName_packId_idx";
ALTER TABLE "WordProgress" DROP COLUMN IF EXISTS "childName";

-- ===== SentenceProgress =====
ALTER TABLE "SentenceProgress" ALTER COLUMN "childId" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SentenceProgress_childId_fkey') THEN
    ALTER TABLE "SentenceProgress" ADD CONSTRAINT "SentenceProgress_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "SentenceProgress_childId_packId_sentenceId_key"
  ON "SentenceProgress"("childId", "packId", "sentenceId");
DROP INDEX IF EXISTS "SentenceProgress_childName_packId_sentenceId_key";
DROP INDEX IF EXISTS "SentenceProgress_childName_packId_idx";
ALTER TABLE "SentenceProgress" DROP COLUMN IF EXISTS "childName";

-- ===== MathProgress =====
ALTER TABLE "MathProgress" ALTER COLUMN "childId" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MathProgress_childId_fkey') THEN
    ALTER TABLE "MathProgress" ADD CONSTRAINT "MathProgress_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "MathProgress_childId_packId_problemId_key"
  ON "MathProgress"("childId", "packId", "problemId");
DROP INDEX IF EXISTS "MathProgress_childName_packId_problemId_key";
DROP INDEX IF EXISTS "MathProgress_childName_packId_idx";
ALTER TABLE "MathProgress" DROP COLUMN IF EXISTS "childName";

-- ===== AnswerEvent =====
ALTER TABLE "AnswerEvent" ALTER COLUMN "childId" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnswerEvent_childId_fkey') THEN
    ALTER TABLE "AnswerEvent" ADD CONSTRAINT "AnswerEvent_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DROP INDEX IF EXISTS "AnswerEvent_childName_packId_wordId_idx";
ALTER TABLE "AnswerEvent" DROP COLUMN IF EXISTS "childName";

-- ===== ChildProfile folded into Child (backfill copied hearts/streak) =====
DROP TABLE IF EXISTS "ChildProfile";
