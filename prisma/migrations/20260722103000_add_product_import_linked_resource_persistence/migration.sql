CREATE TABLE "ProductDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceReferenceKey" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierProductId" TEXT,
    "idempotencyKey" TEXT,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "productType" TEXT,
    "currency" TEXT,
    "riskLevel" TEXT,
    "approvalId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME
);

CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "proposalId" TEXT NOT NULL,
    "workflowId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decisionReason" TEXT,
    "requiresHumanApproval" BOOLEAN NOT NULL,
    "executionEnabled" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "requestedAt" DATETIME NOT NULL,
    "decidedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AuditRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "correlationId" TEXT,
    "activityType" TEXT,
    "status" TEXT,
    "details" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "recordedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ProductDraft_tenantId_storeId_idempotencyKey_key" ON "ProductDraft"("tenantId", "storeId", "idempotencyKey");
CREATE UNIQUE INDEX "ProductDraft_tenantId_storeId_sourceReferenceKey_key" ON "ProductDraft"("tenantId", "storeId", "sourceReferenceKey");
CREATE INDEX "ProductDraft_tenantId_storeId_idx" ON "ProductDraft"("tenantId", "storeId");
CREATE INDEX "ProductDraft_tenantId_storeId_status_idx" ON "ProductDraft"("tenantId", "storeId", "status");
CREATE INDEX "ProductDraft_tenantId_storeId_sourceType_idx" ON "ProductDraft"("tenantId", "storeId", "sourceType");
CREATE INDEX "ProductDraft_tenantId_storeId_riskLevel_idx" ON "ProductDraft"("tenantId", "storeId", "riskLevel");
CREATE INDEX "ProductDraft_approvalId_idx" ON "ProductDraft"("approvalId");

CREATE INDEX "ApprovalRecord_tenantId_storeId_idx" ON "ApprovalRecord"("tenantId", "storeId");
CREATE INDEX "ApprovalRecord_tenantId_storeId_status_idx" ON "ApprovalRecord"("tenantId", "storeId", "status");
CREATE INDEX "ApprovalRecord_tenantId_storeId_proposalId_idx" ON "ApprovalRecord"("tenantId", "storeId", "proposalId");
CREATE INDEX "ApprovalRecord_tenantId_storeId_requestedAt_idx" ON "ApprovalRecord"("tenantId", "storeId", "requestedAt");

CREATE INDEX "AuditRecord_tenantId_storeId_idx" ON "AuditRecord"("tenantId", "storeId");
CREATE INDEX "AuditRecord_tenantId_storeId_entityType_entityId_idx" ON "AuditRecord"("tenantId", "storeId", "entityType", "entityId");
CREATE INDEX "AuditRecord_tenantId_storeId_eventType_idx" ON "AuditRecord"("tenantId", "storeId", "eventType");
CREATE INDEX "AuditRecord_tenantId_storeId_correlationId_idx" ON "AuditRecord"("tenantId", "storeId", "correlationId");
CREATE INDEX "AuditRecord_tenantId_storeId_occurredAt_idx" ON "AuditRecord"("tenantId", "storeId", "occurredAt");
