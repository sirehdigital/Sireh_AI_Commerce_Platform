import type { ShopifyShopDomain } from "../../../../integrations/shopify/shopify.types.js";
import { InventoryPricingSyncService } from "../../../inventory-pricing-sync/application/services/inventory-pricing-sync.service.js";
import type { InventoryPricingSyncResult } from "../../../inventory-pricing-sync/domain/models/inventory-pricing-sync.model.js";
import { MarketingContentService } from "../../../marketing-engine/application/services/marketing-content.service.js";
import type {
  MarketingContent,
  MarketingContentInput,
} from "../../../marketing-engine/domain/models/marketing-content.model.js";
import { OrderSyncService } from "../../../order-sync/application/services/order-sync.service.js";
import type {
  OrderFulfillmentStatus,
  OrderFinancialStatus,
  OrderSyncResult,
} from "../../../order-sync/domain/models/order-sync.model.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import { ProductHunterRankingService } from "../../../product-hunter/application/services/product-hunter-ranking.service.js";
import type {
  ProductCandidate,
  ScoredProductCandidate,
} from "../../../product-hunter/domain/models/product-candidate.model.js";
import { ShopifyDraftPublisherService } from "../../../shopify-draft-publisher/application/services/shopify-draft-publisher.service.js";
import type { ShopifyDraftPublishResult } from "../../../shopify-draft-publisher/domain/models/shopify-draft-publisher.model.js";

export type CommerceEngineStep =
  | "PRODUCT_HUNTER"
  | "MARKETING_ENGINE"
  | "SHOPIFY_DRAFT_PUBLISHER"
  | "INVENTORY_PRICING_SYNC"
  | "ORDER_SYNC";

export interface CommerceEngineMarketingContext {
  readonly productType?: string;
  readonly category?: string;
  readonly keyBenefits: readonly string[];
  readonly features: readonly string[];
  readonly targetAudience: string;
  readonly brandName: string;
  readonly targetMarket: MarketingContentInput["targetMarket"];
  readonly keywords: readonly string[];
  readonly tone: MarketingContentInput["tone"];
}

export interface CommerceEngineInventoryContext {
  readonly shopifyVariantId: string;
  readonly currentInventoryQuantity: number;
  readonly targetMarginPercentage?: number;
  readonly fixedSellingPrice?: number;
}

export interface CommerceEngineOrderQuery {
  readonly limit?: number;
  readonly cursor?: string;
  readonly financialStatus?: OrderFinancialStatus;
  readonly fulfillmentStatus?: OrderFulfillmentStatus;
}

export interface CommerceEngineInput {
  readonly shop: ShopifyShopDomain;
  readonly productCandidates: readonly ProductCandidate[];
  readonly marketingContext: CommerceEngineMarketingContext;
  readonly productDraft: ProductDraft;
  readonly inventoryContext: CommerceEngineInventoryContext;
  readonly orderQuery?: CommerceEngineOrderQuery;
}

export interface CommerceEngineResult {
  readonly rankedProduct: ScoredProductCandidate;
  readonly marketingContent: MarketingContent;
  readonly draftProduct: ShopifyDraftPublishResult;
  readonly pricingSync: InventoryPricingSyncResult;
  readonly syncedOrders: OrderSyncResult;
  readonly completedSteps: readonly CommerceEngineStep[];
  readonly executionStatus: "COMPLETED";
}

interface ProductHunterPort {
  rank(candidates: readonly ProductCandidate[], options?: { readonly limit?: number }): readonly ScoredProductCandidate[];
}

interface MarketingEnginePort {
  generate(input: MarketingContentInput): MarketingContent;
}

interface ShopifyDraftPublisherPort {
  createDraft(input: {
    readonly shop: ShopifyShopDomain;
    readonly draft: ProductDraft;
    readonly marketingContent: MarketingContent;
    readonly tags?: readonly string[];
  }): Promise<ShopifyDraftPublishResult>;
}

interface InventoryPricingSyncPort {
  sync(input: {
    readonly shop: ShopifyShopDomain;
    readonly shopifyProductId: string;
    readonly shopifyVariantId: string;
    readonly supplierPrice: number;
    readonly shippingCost: number;
    readonly currentInventoryQuantity: number;
    readonly targetMarginPercentage?: number;
    readonly fixedSellingPrice?: number;
    readonly currency: ProductCandidate["currency"];
  }): Promise<InventoryPricingSyncResult>;
}

interface OrderSyncPort {
  sync(input: {
    readonly shop: string;
    readonly limit?: number;
    readonly cursor?: string;
    readonly financialStatus?: OrderFinancialStatus;
    readonly fulfillmentStatus?: OrderFulfillmentStatus;
  }): Promise<OrderSyncResult>;
}

export class CommerceEngineOrchestratorService {
  public constructor(
    private readonly productHunter: ProductHunterPort = new ProductHunterRankingService(),
    private readonly marketingEngine: MarketingEnginePort = new MarketingContentService(),
    private readonly draftPublisher: ShopifyDraftPublisherPort = new ShopifyDraftPublisherService(),
    private readonly inventoryPricingSync: InventoryPricingSyncPort = new InventoryPricingSyncService(),
    private readonly orderSync: OrderSyncPort = new OrderSyncService(),
  ) {}

  public async execute(input: CommerceEngineInput): Promise<CommerceEngineResult> {
    const completedSteps: CommerceEngineStep[] = [];
    const [rankedProduct] = this.productHunter.rank(input.productCandidates, { limit: 1 });

    if (rankedProduct === undefined) {
      throw new Error("Product Hunter did not return a ranked product.");
    }

    completedSteps.push("PRODUCT_HUNTER");

    const marketingContent = this.marketingEngine.generate(this.toMarketingInput(rankedProduct, input.marketingContext));
    completedSteps.push("MARKETING_ENGINE");

    const draftProduct = await this.draftPublisher.createDraft({
      shop: input.shop,
      draft: input.productDraft,
      marketingContent,
      tags: marketingContent.productTags,
    });
    completedSteps.push("SHOPIFY_DRAFT_PUBLISHER");

    const pricingSync = await this.inventoryPricingSync.sync({
      shop: input.shop,
      shopifyProductId: draftProduct.productId,
      shopifyVariantId: input.inventoryContext.shopifyVariantId,
      supplierPrice: rankedProduct.candidate.supplierPrice,
      shippingCost: rankedProduct.candidate.shippingCost,
      currentInventoryQuantity: input.inventoryContext.currentInventoryQuantity,
      ...(input.inventoryContext.targetMarginPercentage === undefined
        ? {}
        : { targetMarginPercentage: input.inventoryContext.targetMarginPercentage }),
      ...(input.inventoryContext.fixedSellingPrice === undefined
        ? {}
        : { fixedSellingPrice: input.inventoryContext.fixedSellingPrice }),
      currency: rankedProduct.candidate.currency,
    });
    completedSteps.push("INVENTORY_PRICING_SYNC");

    const syncedOrders = await this.orderSync.sync({
      shop: input.shop,
      ...(input.orderQuery?.limit === undefined ? {} : { limit: input.orderQuery.limit }),
      ...(input.orderQuery?.cursor === undefined ? {} : { cursor: input.orderQuery.cursor }),
      ...(input.orderQuery?.financialStatus === undefined ? {} : { financialStatus: input.orderQuery.financialStatus }),
      ...(input.orderQuery?.fulfillmentStatus === undefined ? {} : { fulfillmentStatus: input.orderQuery.fulfillmentStatus }),
    });
    completedSteps.push("ORDER_SYNC");

    return {
      rankedProduct,
      marketingContent,
      draftProduct,
      pricingSync,
      syncedOrders,
      completedSteps,
      executionStatus: "COMPLETED",
    };
  }

  private toMarketingInput(
    rankedProduct: ScoredProductCandidate,
    context: CommerceEngineMarketingContext,
  ): MarketingContentInput {
    return {
      productTitle: rankedProduct.candidate.title,
      ...(context.productType === undefined ? {} : { productType: context.productType }),
      ...(context.category === undefined ? {} : { category: context.category }),
      keyBenefits: context.keyBenefits,
      features: context.features,
      targetAudience: context.targetAudience,
      brandName: context.brandName,
      targetMarket: context.targetMarket,
      keywords: context.keywords,
      tone: context.tone,
      productUrl: rankedProduct.candidate.productUrl,
    };
  }
}
