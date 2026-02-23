-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "subject" TEXT NOT NULL DEFAULT 'chinese',
ALTER COLUMN "nameZh" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MathProblem" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "operand1" INTEGER NOT NULL,
    "operator" TEXT NOT NULL,
    "operand2" INTEGER NOT NULL,
    "answer" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MathProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MathProgress" (
    "id" TEXT NOT NULL,
    "childName" TEXT NOT NULL DEFAULT 'julian',
    "packId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "easiness" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReview" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MathProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MathProgress_childName_packId_idx" ON "MathProgress"("childName", "packId");

-- CreateIndex
CREATE UNIQUE INDEX "MathProgress_childName_packId_problemId_key" ON "MathProgress"("childName", "packId", "problemId");

-- CreateIndex
CREATE INDEX "Pack_subject_idx" ON "Pack"("subject");

-- AddForeignKey
ALTER TABLE "MathProblem" ADD CONSTRAINT "MathProblem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordProgress" ADD CONSTRAINT "WordProgress_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordProgress" ADD CONSTRAINT "WordProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MathProgress" ADD CONSTRAINT "MathProgress_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MathProgress" ADD CONSTRAINT "MathProgress_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "MathProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerEvent" ADD CONSTRAINT "AnswerEvent_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
