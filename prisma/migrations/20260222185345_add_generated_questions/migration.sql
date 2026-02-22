-- CreateTable
CREATE TABLE "GeneratedQuestion" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "distractors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedQuestion_packId_wordId_idx" ON "GeneratedQuestion"("packId", "wordId");
