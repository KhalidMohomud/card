CREATE INDEX "Receipt_issuedAt_idx" ON "Receipt"("issuedAt");

CREATE INDEX "Expense_expenseDate_createdAt_idx" ON "Expense"("expenseDate", "createdAt");

CREATE INDEX "InventoryIssue_issueDate_idx" ON "InventoryIssue"("issueDate");

CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
