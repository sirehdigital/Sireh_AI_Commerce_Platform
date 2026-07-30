CREATE TABLE "StorefrontProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "version" INTEGER NOT NULL,
    "brandName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "StorefrontProfile_tenantId_storeId_idx" ON "StorefrontProfile"("tenantId", "storeId");
CREATE INDEX "StorefrontProfile_tenantId_storeId_brandName_idx" ON "StorefrontProfile"("tenantId", "storeId", "brandName");

CREATE TABLE "StorefrontProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "themeTargetReference" TEXT NOT NULL,
    "selectedProductDraftIds" JSONB NOT NULL,
    "locale" TEXT NOT NULL,
    "markets" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "planSnapshot" JSONB NOT NULL,
    "validationSnapshot" JSONB NOT NULL,
    "qualitySnapshot" JSONB NOT NULL,
    "approvalId" TEXT,
    "correlationId" TEXT,
    "parentProjectId" TEXT,
    "failureStage" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE INDEX "StorefrontProject_tenantId_storeId_idx" ON "StorefrontProject"("tenantId", "storeId");
CREATE INDEX "StorefrontProject_tenantId_storeId_status_idx" ON "StorefrontProject"("tenantId", "storeId", "status");
CREATE INDEX "StorefrontProject_tenantId_storeId_locale_idx" ON "StorefrontProject"("tenantId", "storeId", "locale");
CREATE INDEX "StorefrontProject_tenantId_storeId_idempotencyKey_idx" ON "StorefrontProject"("tenantId", "storeId", "idempotencyKey");
CREATE INDEX "StorefrontProject_themeTargetReference_idx" ON "StorefrontProject"("themeTargetReference");
CREATE INDEX "StorefrontProject_parentProjectId_idx" ON "StorefrontProject"("parentProjectId");
CREATE INDEX "StorefrontProject_createdAt_idx" ON "StorefrontProject"("createdAt");

CREATE TABLE "StorefrontArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontProjectId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StorefrontArtifact_storefrontProjectId_fkey" FOREIGN KEY ("storefrontProjectId") REFERENCES "StorefrontProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StorefrontArtifact_storefrontProjectId_idx" ON "StorefrontArtifact"("storefrontProjectId");
CREATE INDEX "StorefrontArtifact_artifactType_idx" ON "StorefrontArtifact"("artifactType");
CREATE INDEX "StorefrontArtifact_status_idx" ON "StorefrontArtifact"("status");

CREATE TABLE "StorefrontPreview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontProjectId" TEXT NOT NULL,
    "planSnapshot" JSONB NOT NULL,
    "generatedArtifactReferences" JSONB NOT NULL,
    "themeTarget" JSONB NOT NULL,
    "selectedProductDraftIds" JSONB NOT NULL,
    "qualityReport" JSONB NOT NULL,
    "validationReport" JSONB NOT NULL,
    "previewStatus" TEXT NOT NULL,
    "previewUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StorefrontPreview_storefrontProjectId_fkey" FOREIGN KEY ("storefrontProjectId") REFERENCES "StorefrontProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StorefrontPreview_storefrontProjectId_idx" ON "StorefrontPreview"("storefrontProjectId");
CREATE INDEX "StorefrontPreview_previewStatus_idx" ON "StorefrontPreview"("previewStatus");
