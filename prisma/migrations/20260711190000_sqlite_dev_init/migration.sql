-- CreateTable
CREATE TABLE "ShopifySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShopifyStore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "currency" TEXT NOT NULL,
    "countryCode" TEXT,
    "timezone" TEXT,
    "planName" TEXT,
    "primaryDomain" TEXT,
    "shopifyCreatedAt" DATETIME,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifyProductSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "vendor" TEXT,
    "productType" TEXT,
    "tags" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "rawPayload" JSONB,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifyCollectionSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "shopifyCollectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "collectionType" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "rawPayload" JSONB,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifyInventorySync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "available" INTEGER,
    "updatedAtSource" DATETIME,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifyLocationSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "shopifyLocationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "countryCode" TEXT,
    "provinceCode" TEXT,
    "city" TEXT,
    "address1" TEXT,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifyOrderSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "currency" TEXT NOT NULL,
    "totalPrice" TEXT NOT NULL,
    "customerEmail" TEXT,
    "processedAt" DATETIME,
    "rawPayload" JSONB,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifyCustomerSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "ordersCount" INTEGER NOT NULL,
    "totalSpent" TEXT NOT NULL,
    "currency" TEXT,
    "rawPayload" JSONB,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifySyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "collectionsCount" INTEGER NOT NULL DEFAULT 0,
    "inventoryCount" INTEGER NOT NULL DEFAULT 0,
    "locationsCount" INTEGER NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "customersCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifySession_shopDomain_key" ON "ShopifySession"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyStore_shopDomain_key" ON "ShopifyStore"("shopDomain");

-- CreateIndex
CREATE INDEX "ShopifyProductSync_shopDomain_idx" ON "ShopifyProductSync"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProductSync_shopDomain_shopifyProductId_key" ON "ShopifyProductSync"("shopDomain", "shopifyProductId");

-- CreateIndex
CREATE INDEX "ShopifyCollectionSync_shopDomain_idx" ON "ShopifyCollectionSync"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyCollectionSync_shopDomain_shopifyCollectionId_key" ON "ShopifyCollectionSync"("shopDomain", "shopifyCollectionId");

-- CreateIndex
CREATE INDEX "ShopifyInventorySync_shopDomain_idx" ON "ShopifyInventorySync"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyInventorySync_shopDomain_inventoryItemId_locationId_key" ON "ShopifyInventorySync"("shopDomain", "inventoryItemId", "locationId");

-- CreateIndex
CREATE INDEX "ShopifyLocationSync_shopDomain_idx" ON "ShopifyLocationSync"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyLocationSync_shopDomain_shopifyLocationId_key" ON "ShopifyLocationSync"("shopDomain", "shopifyLocationId");

-- CreateIndex
CREATE INDEX "ShopifyOrderSync_shopDomain_idx" ON "ShopifyOrderSync"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderSync_shopDomain_shopifyOrderId_key" ON "ShopifyOrderSync"("shopDomain", "shopifyOrderId");

-- CreateIndex
CREATE INDEX "ShopifyCustomerSync_shopDomain_idx" ON "ShopifyCustomerSync"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyCustomerSync_shopDomain_shopifyCustomerId_key" ON "ShopifyCustomerSync"("shopDomain", "shopifyCustomerId");

-- CreateIndex
CREATE INDEX "ShopifySyncRun_shopDomain_idx" ON "ShopifySyncRun"("shopDomain");

-- CreateIndex
CREATE INDEX "ShopifySyncRun_shopDomain_status_idx" ON "ShopifySyncRun"("shopDomain", "status");
