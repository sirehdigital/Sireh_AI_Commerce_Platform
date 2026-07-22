CREATE TABLE "SupplierConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "supplierProvider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "credentialsReference" JSONB,
    "capabilities" JSONB NOT NULL,
    "healthSnapshot" JSONB NOT NULL,
    "connectedAt" DATETIME,
    "disconnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SupplierConnection_tenantId_storeId_supplierProvider_key" ON "SupplierConnection"("tenantId", "storeId", "supplierProvider");
CREATE INDEX "SupplierConnection_tenantId_storeId_idx" ON "SupplierConnection"("tenantId", "storeId");
CREATE INDEX "SupplierConnection_supplierProvider_status_idx" ON "SupplierConnection"("supplierProvider", "status");

CREATE TABLE "SupplierImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "supplierProvider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "force" BOOLEAN NOT NULL DEFAULT false,
    "productReferenceIds" JSONB NOT NULL,
    "productImportIds" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "failure" JSONB,
    "auditReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE INDEX "SupplierImportJob_tenantId_storeId_idx" ON "SupplierImportJob"("tenantId", "storeId");
CREATE INDEX "SupplierImportJob_tenantId_storeId_supplierProvider_idx" ON "SupplierImportJob"("tenantId", "storeId", "supplierProvider");
CREATE INDEX "SupplierImportJob_tenantId_storeId_status_idx" ON "SupplierImportJob"("tenantId", "storeId", "status");
CREATE INDEX "SupplierImportJob_tenantId_storeId_idempotencyKey_idx" ON "SupplierImportJob"("tenantId", "storeId", "idempotencyKey");
CREATE INDEX "SupplierImportJob_supplierProvider_status_idx" ON "SupplierImportJob"("supplierProvider", "status");

CREATE TABLE "SupplierSyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "supplierProvider" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "productReferenceIds" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "failure" JSONB,
    "auditReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE INDEX "SupplierSyncJob_tenantId_storeId_idx" ON "SupplierSyncJob"("tenantId", "storeId");
CREATE INDEX "SupplierSyncJob_tenantId_storeId_supplierProvider_idx" ON "SupplierSyncJob"("tenantId", "storeId", "supplierProvider");
CREATE INDEX "SupplierSyncJob_tenantId_storeId_status_idx" ON "SupplierSyncJob"("tenantId", "storeId", "status");
CREATE INDEX "SupplierSyncJob_tenantId_storeId_idempotencyKey_idx" ON "SupplierSyncJob"("tenantId", "storeId", "idempotencyKey");
CREATE INDEX "SupplierSyncJob_supplierProvider_status_idx" ON "SupplierSyncJob"("supplierProvider", "status");

CREATE TABLE "SupplierProductReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "supplierProvider" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "productType" TEXT,
    "inventorySnapshot" JSONB,
    "pricingSnapshot" JSONB NOT NULL,
    "mediaReferences" JSONB NOT NULL,
    "shippingProfile" JSONB NOT NULL,
    "rawPayload" JSONB,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SupplierProductReference_tenantId_storeId_supplierProvider_externalProductId_key" ON "SupplierProductReference"("tenantId", "storeId", "supplierProvider", "externalProductId");
CREATE INDEX "SupplierProductReference_tenantId_storeId_idx" ON "SupplierProductReference"("tenantId", "storeId");
CREATE INDEX "SupplierProductReference_tenantId_storeId_supplierProvider_idx" ON "SupplierProductReference"("tenantId", "storeId", "supplierProvider");
CREATE INDEX "SupplierProductReference_tenantId_storeId_supplierProvider_title_idx" ON "SupplierProductReference"("tenantId", "storeId", "supplierProvider", "title");
