-- Payments Phase A: entitlement bookkeeping on Account (spec 2026-10-13 §2).
ALTER TABLE "Account"
  ADD COLUMN "planSource" TEXT,
  ADD COLUMN "planGrantedAt" TIMESTAMP(3),
  ADD COLUMN "isFounder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "appleOriginalTransactionId" TEXT;

CREATE UNIQUE INDEX "Account_stripeCheckoutSessionId_key" ON "Account"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "Account_appleOriginalTransactionId_key" ON "Account"("appleOriginalTransactionId");
