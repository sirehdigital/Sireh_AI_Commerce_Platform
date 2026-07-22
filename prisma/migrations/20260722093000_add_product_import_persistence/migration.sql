-- CreateTable
CREATE TABLE "ProductImport" (
    "importId" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "sourcePlatform" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "supplierName" TEXT,
    "status" TEXT NOT NULL,
    "pipelineStatus" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyBehavior" TEXT NOT NULL,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "parentImportId" TEXT,
    "productDraftId" TEXT,
    "approvalId" TEXT,
    "auditReference" TEXT,
    "failureStage" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "warnings" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "resultSnapshot" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "ProductImport_tenantId_storeId_idx" ON "ProductImport"("tenantId", "storeId");

-- CreateIndex
CREATE INDEX "ProductImport_tenantId_storeId_sourcePlatform_externalProductId_idx" ON "ProductImport"("tenantId", "storeId", "sourcePlatform", "externalProductId");

-- CreateIndex
CREATE INDEX "ProductImport_tenantId_storeId_idempotencyKey_idx" ON "ProductImport"("tenantId", "storeId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProductImport_status_idx" ON "ProductImport"("status");

-- CreateIndex
CREATE INDEX "ProductImport_approvalId_idx" ON "ProductImport"("approvalId");

-- CreateIndex
CREATE INDEX "ProductImport_productDraftId_idx" ON "ProductImport"("productDraftId");

-- CreateIndex
CREATE INDEX "ProductImport_parentImportId_idx" ON "ProductImport"("parentImportId");
