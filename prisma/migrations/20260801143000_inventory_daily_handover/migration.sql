CREATE TYPE "InventoryCondition" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'DAMAGED', 'LOST');

ALTER TYPE "InventoryMovementType" ADD VALUE 'STOCKTAKE_IN';
ALTER TYPE "InventoryMovementType" ADD VALUE 'STOCKTAKE_OUT';

ALTER TABLE "InventoryIssue"
  ADD COLUMN "closedByUserId" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledByUserId" TEXT,
  ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "InventoryIssueItem"
  ADD COLUMN "conditionOut" "InventoryCondition" NOT NULL DEFAULT 'GOOD',
  ADD COLUMN "conditionIn" "InventoryCondition";

UPDATE "InventoryIssue"
SET "closedByUserId" = "issuedByUserId"
WHERE "status" = 'CLOSED' AND "closedByUserId" IS NULL;

ALTER TABLE "InventoryIssue"
  ADD CONSTRAINT "InventoryIssue_closedByUserId_fkey"
    FOREIGN KEY ("closedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryIssue_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryIssue_cancellation_state_check" CHECK (
    ("status" <> 'CANCELLED') OR
    ("cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL AND length(trim("cancellationReason")) >= 5)
  ),
  ADD CONSTRAINT "InventoryIssue_closed_state_check" CHECK (
    ("status" <> 'CLOSED') OR ("closedAt" IS NOT NULL AND "closedByUserId" IS NOT NULL)
  );

CREATE INDEX "InventoryIssue_closedByUserId_idx" ON "InventoryIssue"("closedByUserId");
CREATE INDEX "InventoryIssue_cancelledByUserId_idx" ON "InventoryIssue"("cancelledByUserId");
