-- Word stickers (6-C reward): one per finished word session, collected in Panda's sticker book.
-- Additive only. Row-level security on, like every other public table (the API connects as
-- the table owner through Prisma; the anon/authenticated roles get no access).
CREATE TABLE "Sticker" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sticker_childId_wordId_key" ON "Sticker"("childId", "wordId");
CREATE INDEX "Sticker_childId_packId_idx" ON "Sticker"("childId", "packId");

ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sticker" ENABLE ROW LEVEL SECURITY;
