CREATE TABLE "ProductMediaJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "productDraftId" TEXT NOT NULL,
    "importId" TEXT,
    "parentJobId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerId" TEXT,
    "brandProfileSnapshot" JSONB NOT NULL,
    "planSnapshot" JSONB NOT NULL,
    "qualityReportSnapshot" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "failureStage" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "approvalId" TEXT,
    "auditReference" TEXT,
    "correlationId" TEXT,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE TABLE "ProductMediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "mediaJobId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "promptSnapshot" JSONB NOT NULL,
    "negativePrompt" TEXT,
    "sourceAssetReferences" JSONB NOT NULL,
    "providerId" TEXT,
    "providerReference" TEXT,
    "storageKey" TEXT,
    "outputUrl" TEXT,
    "altText" TEXT NOT NULL,
    "reviewNotes" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductMediaAsset_mediaJobId_fkey" FOREIGN KEY ("mediaJobId") REFERENCES "ProductMediaJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProductMediaJob_tenantId_storeId_idx" ON "ProductMediaJob"("tenantId", "storeId");
CREATE INDEX "ProductMediaJob_tenantId_storeId_productDraftId_idx" ON "ProductMediaJob"("tenantId", "storeId", "productDraftId");
CREATE INDEX "ProductMediaJob_tenantId_storeId_idempotencyKey_idx" ON "ProductMediaJob"("tenantId", "storeId", "idempotencyKey");
CREATE INDEX "ProductMediaJob_tenantId_storeId_status_idx" ON "ProductMediaJob"("tenantId", "storeId", "status");
CREATE INDEX "ProductMediaJob_approvalId_idx" ON "ProductMediaJob"("approvalId");
CREATE INDEX "ProductMediaJob_parentJobId_idx" ON "ProductMediaJob"("parentJobId");

CREATE INDEX "ProductMediaAsset_tenantId_storeId_idx" ON "ProductMediaAsset"("tenantId", "storeId");
CREATE INDEX "ProductMediaAsset_mediaJobId_idx" ON "ProductMediaAsset"("mediaJobId");
CREATE INDEX "ProductMediaAsset_tenantId_storeId_assetType_idx" ON "ProductMediaAsset"("tenantId", "storeId", "assetType");
CREATE INDEX "ProductMediaAsset_tenantId_storeId_status_idx" ON "ProductMediaAsset"("tenantId", "storeId", "status");
CREATE INDEX "ProductMediaAsset_providerReference_idx" ON "ProductMediaAsset"("providerReference");
