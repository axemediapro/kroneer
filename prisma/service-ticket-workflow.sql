ALTER TABLE "ServiceTicket"
  ADD COLUMN IF NOT EXISTS "partsUsed" TEXT,
  ADD COLUMN IF NOT EXISTS "testResults" TEXT,
  ADD COLUMN IF NOT EXISTS "clientSignerName" TEXT,
  ADD COLUMN IF NOT EXISTS "clientSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "clientSignedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ServiceTicket_serialNumber_status_reportedDate_idx"
  ON "ServiceTicket"("serialNumber", "status", "reportedDate");
