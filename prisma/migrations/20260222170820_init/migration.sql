-- CreateTable
CREATE TABLE "WordProgress" (
    "id" TEXT NOT NULL,
    "childName" TEXT NOT NULL DEFAULT 'julian',
    "packId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "easiness" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReview" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerEvent" (
    "id" TEXT NOT NULL,
    "childName" TEXT NOT NULL DEFAULT 'julian',
    "packId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildProfile" (
    "name" TEXT NOT NULL,
    "totalHearts" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastPracticed" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildProfile_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "WordProgress_childName_packId_idx" ON "WordProgress"("childName", "packId");

-- CreateIndex
CREATE UNIQUE INDEX "WordProgress_childName_packId_wordId_key" ON "WordProgress"("childName", "packId", "wordId");

-- CreateIndex
CREATE INDEX "AnswerEvent_childName_packId_wordId_idx" ON "AnswerEvent"("childName", "packId", "wordId");

-- CreateIndex
CREATE INDEX "AnswerEvent_answeredAt_idx" ON "AnswerEvent"("answeredAt");
