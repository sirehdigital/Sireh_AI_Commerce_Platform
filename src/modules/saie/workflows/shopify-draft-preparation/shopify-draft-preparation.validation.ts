import {
  AmbiguousShopifyProductError,
  IncompleteShopifyProductSnapshotError,
  InvalidProductLocatorError,
  InvalidShopDomainError,
  ShopifyProductNotFoundError,
  TruncatedShopifyProductDataError,
  UnsupportedShopifyDraftPreparationModeError,
  type ShopifyDraftPreparationInput,
  type ShopifyDraftPreparationProductSnapshot,
} from "./shopify-draft-preparation.types.js";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/u;
const SHOPIFY_PRODUCT_GID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/u;
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;

export const validateShopifyDraftPreparationInput = (input: ShopifyDraftPreparationInput): void => {
  if (input.executionMode !== "shopify-draft-preparation") {
    throw new UnsupportedShopifyDraftPreparationModeError(String(input.executionMode));
  }

  if (!SHOP_DOMAIN_PATTERN.test(input.shopDomain.trim().toLowerCase())) {
    throw new InvalidShopDomainError(input.shopDomain);
  }

  if (input.productLocator.kind === "product-id") {
    if (!SHOPIFY_PRODUCT_GID_PATTERN.test(input.productLocator.productId)) {
      throw new InvalidProductLocatorError("Product locator must contain an exact Shopify product GID.");
    }
    return;
  }

  if (!HANDLE_PATTERN.test(input.productLocator.handle)) {
    throw new InvalidProductLocatorError("Product locator must contain an exact non-empty product handle.");
  }
};

export const resolveSingleShopifyProductSnapshot = (
  snapshots: readonly ShopifyDraftPreparationProductSnapshot[],
): ShopifyDraftPreparationProductSnapshot => {
  if (snapshots.length === 0) {
    throw new ShopifyProductNotFoundError();
  }

  if (snapshots.length > 1) {
    throw new AmbiguousShopifyProductError();
  }

  return snapshots[0]!;
};

export const validateShopifyProductSnapshot = (
  snapshot: ShopifyDraftPreparationProductSnapshot,
  input: ShopifyDraftPreparationInput,
): void => {
  if (input.productLocator.kind === "product-id" && snapshot.id !== input.productLocator.productId) {
    throw new IncompleteShopifyProductSnapshotError("Shopify product ID did not match the requested exact ID.");
  }

  if (input.productLocator.kind === "handle" && snapshot.handle !== input.productLocator.handle) {
    throw new IncompleteShopifyProductSnapshotError("Shopify product handle did not match the requested exact handle.");
  }

  if (snapshot.handle.trim().length === 0) {
    throw new IncompleteShopifyProductSnapshotError("Shopify product handle is empty.");
  }

  if (snapshot.productDataTruncated) {
    throw new TruncatedShopifyProductDataError("Shopify product read model indicates product data was truncated.");
  }

  if (snapshot.variantDataTruncated) {
    throw new TruncatedShopifyProductDataError("Shopify product read model indicates variant data was truncated.");
  }

  if (snapshot.inventoryDataIncomplete) {
    throw new IncompleteShopifyProductSnapshotError("Shopify inventory read model is incomplete.");
  }

  if (snapshot.variants.length === 0) {
    throw new IncompleteShopifyProductSnapshotError("Shopify product has no existing variants.");
  }

  const variantIds = new Set<string>();
  for (const variant of snapshot.variants) {
    if (variant.id.trim().length === 0) {
      throw new IncompleteShopifyProductSnapshotError("A Shopify variant is missing its variant ID.");
    }

    if (variantIds.has(variant.id)) {
      throw new IncompleteShopifyProductSnapshotError("Duplicate Shopify variant IDs were returned.");
    }

    if (variant.inventoryItemId.trim().length === 0) {
      throw new IncompleteShopifyProductSnapshotError("A Shopify variant is missing its inventory item ID.");
    }

    if (variant.inventoryQuantities.length === 0) {
      throw new IncompleteShopifyProductSnapshotError("A Shopify variant has no read-only inventory quantities.");
    }

    variantIds.add(variant.id);
  }
};
