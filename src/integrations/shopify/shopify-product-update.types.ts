import type { ShopifyShopDomain } from "./shopify.types.js";

export interface ShopifyProductIdLocator {
  readonly kind: "id";
  readonly productId: string;
}

export interface ShopifyProductHandleLocator {
  readonly kind: "handle";
  readonly handle: string;
}

export type ShopifyProductLocator = ShopifyProductIdLocator | ShopifyProductHandleLocator;

export interface ShopifyProductSeoUpdate {
  readonly title: string;
  readonly description: string;
}

export interface ShopifyProductPricingUpdate {
  readonly price: string;
  readonly compareAtPrice: string | null;
}

/**
 * Approved mutable fields for the safe product update workflow.
 *
 * Existing handles, variant IDs, SKUs, inventory items, inventory tracking,
 * inventory policies, fulfillment mappings, and supplier-managed metadata are
 * deliberately absent from this contract.
 */
export interface SafeShopifyProductUpdateCommand {
  readonly shopDomain: ShopifyShopDomain;
  readonly locator: ShopifyProductLocator;
  readonly title: string;
  readonly descriptionHtml: string;
  readonly vendor: string;
  readonly productType: string;
  readonly tagsToAdd: readonly string[];
  readonly seo: ShopifyProductSeoUpdate;
  readonly pricing: ShopifyProductPricingUpdate;
  readonly collectionIdsToJoin: readonly string[];
  readonly templateSuffix: string;
}

export interface ShopifyProductCollectionSnapshot {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
}

export interface ShopifyProductVariantSnapshot {
  readonly id: string;
  readonly title: string;
  readonly sku: string | null;
  readonly price: string;
  readonly compareAtPrice: string | null;
  readonly inventoryPolicy: "DENY" | "CONTINUE";
  readonly inventoryItemId: string;
  readonly inventoryTracked: boolean;
}

export interface ShopifyProductSnapshot {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
  readonly descriptionHtml: string;
  readonly vendor: string;
  readonly productType: string;
  readonly tags: readonly string[];
  readonly status: "ACTIVE" | "ARCHIVED" | "DRAFT" | "UNLISTED";
  readonly templateSuffix: string | null;
  readonly seo: {
    readonly title: string | null;
    readonly description: string | null;
  };
  readonly collections: readonly ShopifyProductCollectionSnapshot[];
  readonly variants: readonly ShopifyProductVariantSnapshot[];
}

export interface ShopifyProductAuditChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface ShopifyProductPreservationAudit {
  readonly handlePreserved: boolean;
  readonly variantIdsPreserved: boolean;
  readonly skusPreserved: boolean;
  readonly inventoryItemIdsPreserved: boolean;
  readonly inventoryTrackingPreserved: boolean;
  readonly inventoryPoliciesPreserved: boolean;
  readonly noVariantsCreated: boolean;
  readonly publicationMutationExecuted: false;
}

export interface SafeShopifyProductUpdateAudit {
  readonly shopDomain: ShopifyShopDomain;
  readonly productId: string;
  readonly before: ShopifyProductSnapshot;
  readonly after: ShopifyProductSnapshot;
  readonly changes: readonly ShopifyProductAuditChange[];
  readonly preservation: ShopifyProductPreservationAudit;
  readonly status: "completed";
  readonly completedAt: Date;
}
