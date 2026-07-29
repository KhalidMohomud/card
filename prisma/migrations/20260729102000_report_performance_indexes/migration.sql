-- Speed up supervisor-specific inventory movement reports.
CREATE INDEX "InventoryMovement_inventoryIssueItemId_createdAt_idx"
ON "InventoryMovement"("inventoryIssueItemId", "createdAt");
