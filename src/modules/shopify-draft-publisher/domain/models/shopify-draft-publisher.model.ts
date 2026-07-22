import type { ShopifyShopDomain } from "../../../../integrations/shopify/shopify.types.js";
import type { MarketingContent } from "../../../marketing-engine/domain/models/marketing-content.model.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";

export interface ShopifyDraftPublishInput {
  readonly shop: ShopifyShopDomain;
  readonly draft: ProductDraft;
  readonly marketingContent: MarketingContent;
  readonly collectionIds?: readonly string[];
  readonly tags?: readonly string[];
}

export interface ShopifyDraftPublishResult {
  readonly shop: ShopifyShopDomain;
  readonly productId: string;
  readonly handle: string;
  readonly status: "DRAFT";
  readonly adminReference?: string;
}
