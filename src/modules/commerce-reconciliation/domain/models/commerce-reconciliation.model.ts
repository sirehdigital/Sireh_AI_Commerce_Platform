import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { ShopifyDraftPublishResult } from "../../../shopify-draft-publisher/domain/models/shopify-draft-publisher.model.js";
import type { InventoryPricingSyncResult } from "../../../inventory-pricing-sync/domain/models/inventory-pricing-sync.model.js";
import type { SyncedOrder } from "../../../order-sync/domain/models/order-sync.model.js";

export type ReconciliationOverallStatus = "HEALTHY" | "WARNING" | "ERROR";
export type ReconciliationCheckStatus = "PASS" | "WARNING" | "ERROR";
export type ReconciliationCheckCategory = "PRODUCT_IDENTITY" | "PRICING" | "INVENTORY" | "ORDERS";

export interface CommerceReconciliationOrderLineItem {
  readonly lineItemId: string;
  readonly title: string;
  readonly shopifyVariantId?: string;
  readonly quantity: number;
  readonly currency?: string;
}

export interface CommerceReconciliationOrderRecord
  extends Pick<SyncedOrder, "orderId" | "orderNumber" | "currency" | "itemCount"> {
  readonly lineItems: readonly CommerceReconciliationOrderLineItem[];
}

export interface CommerceReconciliationInput {
  readonly internalProductReference: ProductDraft["id"];
  readonly shopifyProductId: ShopifyDraftPublishResult["productId"];
  readonly shopifyVariantId: InventoryPricingSyncResult["variantId"];
  readonly expectedSellingPrice: number;
  readonly syncedSellingPrice: number;
  readonly expectedInventoryQuantity: number;
  readonly syncedInventoryQuantity: number;
  readonly supplierQuantity?: number;
  readonly shopifyOrders?: readonly CommerceReconciliationOrderRecord[];
  readonly expectedCurrency?: string;
  readonly syncedCurrency: string;
  readonly priceTolerance?: number;
}

export interface CommerceReconciliationCheck {
  readonly code: string;
  readonly category: ReconciliationCheckCategory;
  readonly status: ReconciliationCheckStatus;
  readonly message: string;
  readonly expectedValue?: string | number;
  readonly actualValue?: string | number;
}

export interface CommerceReconciliationResult {
  readonly overallStatus: ReconciliationOverallStatus;
  readonly healthScore: number;
  readonly checks: readonly CommerceReconciliationCheck[];
  readonly warnings: readonly CommerceReconciliationCheck[];
  readonly errors: readonly CommerceReconciliationCheck[];
  readonly requiresAttention: boolean;
  readonly reconciledAt: Date;
}
