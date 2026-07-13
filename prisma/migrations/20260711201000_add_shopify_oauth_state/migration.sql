-- CreateTable
CREATE TABLE "ShopifyOAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateHash" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOAuthState_stateHash_key" ON "ShopifyOAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "ShopifyOAuthState_shopDomain_idx" ON "ShopifyOAuthState"("shopDomain");

-- CreateIndex
CREATE INDEX "ShopifyOAuthState_expiresAt_idx" ON "ShopifyOAuthState"("expiresAt");
