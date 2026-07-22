import type { ShopifyDraftPublishResult } from "../../../shopify-draft-publisher/domain/models/shopify-draft-publisher.model.js";
import type { ShopifyShopDomain } from "../../../../integrations/shopify/shopify.types.js";
import type {
  ProductCandidateMoney,
  ProductCandidateFinancials,
} from "../../../product-hunter/domain/models/product-candidate.model.js";

export interface InventoryPricingSyncInput {
  readonly shop: ShopifyShopDomain;
  readonly shopifyProductId: ShopifyDraftPublishResult["productId"];
  readonly shopifyVariantId: string;
  readonly supplierPrice: number;
  readonly shippingCost: number;
  readonly currentInventoryQuantity: number;
  readonly targetMarginPercentage?: number;
  readonly fixedSellingPrice?: number;
  readonly currency: ProductCandidateMoney["currency"];
}

export interface InventoryPricingSyncPricing extends ProductCandidateFinancials {
  readonly finalSellingPrice: ProductCandidateMoney;
  readonly targetMarginPercentage: number;
}

export interface InventoryPricingSyncResult {
  readonly shop: ShopifyShopDomain;
  readonly productId: ShopifyDraftPublishResult["productId"];
  readonly variantId: string;
  readonly price: ProductCandidateMoney;
  readonly quantity: number;
  readonly pricing: InventoryPricingSyncPricing;
  readonly status: "SYNCED";
}
