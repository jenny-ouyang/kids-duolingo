-- Payments Phase C: Apple grant bookkeeping (security review 2026-10-30).
-- Additive only. RLS on, like every other public table (the API connects as the
-- table owner through Prisma; the anon/authenticated roles get no access).
ALTER TABLE "Account" ADD COLUMN "appleEnvironment" TEXT;

CREATE TABLE "AppleFamilyGrant" (
    "transactionId" TEXT NOT NULL,
    "originalTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "environment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppleFamilyGrant_pkey" PRIMARY KEY ("transactionId")
);
CREATE INDEX "AppleFamilyGrant_originalTransactionId_idx" ON "AppleFamilyGrant"("originalTransactionId");
CREATE INDEX "AppleFamilyGrant_accountId_idx" ON "AppleFamilyGrant"("accountId");
ALTER TABLE "AppleFamilyGrant" ADD CONSTRAINT "AppleFamilyGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppleFamilyGrant" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "AppleRevocation" (
    "key" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppleRevocation_pkey" PRIMARY KEY ("key")
);
ALTER TABLE "AppleRevocation" ENABLE ROW LEVEL SECURITY;
