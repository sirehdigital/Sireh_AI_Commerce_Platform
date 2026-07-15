import type {
  ProductCurrency,
  ProductImage,
  ProductOption,
  ProductRiskAssessment,
  ProductScoreBreakdown,
  ProductVariant,
  TargetMarket,
} from "../../../ai-product/types/product.types.js";
import type {
  ProductPreparationBrandContext,
  ProductPreparationProposal,
  ProductPreparationSourceProduct,
} from "../product-preparation/index.js";

export type ShopifyDraftPreparationExecutionMode = "shopify-draft-preparation";

export type ShopifyDraftPreparationProductLocator =
  | {
      readonly kind: "product-id";
      readonly productId: string;
    }
  | {
      readonly kind: "handle";
      readonly handle: string;
    };

export interface ShopifyDraftPreparationRequestedCapabilities {
  readonly normalize: boolean;
  readonly analyze: boolean;
  readonly assessRisk: boolean;
  readonly generateBranding: boolean;
  readonly generateCopy: boolean;
  readonly recommendPricing: boolean;
  readonly mapForShopify: boolean;
  readonly prepareSafeUpdateProposal: boolean;
}

export interface ShopifyDraftPreparationAnalysisContext {
  readonly score: ProductScoreBreakdown;
  readonly riskAssessment: ProductRiskAssessment;
}

export interface ShopifyDraftPreparationSupplierCost {
  readonly productCost: number;
  readonly shippingCost: number;
  readonly transactionCost: number;
  readonly advertisingCostEstimate: number;
  readonly currency: ProductCurrency;
}

export interface ShopifyDraftPreparationInput extends Readonly<Record<string, unknown>> {
  readonly executionMode: ShopifyDraftPreparationExecutionMode;
  readonly shopDomain: `${string}.myshopify.com`;
  readonly productLocator: ShopifyDraftPreparationProductLocator;
  readonly brandContext: ProductPreparationBrandContext;
  readonly requestedCapabilities: ShopifyDraftPreparationRequestedCapabilities;
  readonly optionalAnalysisContext?: ShopifyDraftPreparationAnalysisContext;
  readonly supplierCost?: ShopifyDraftPreparationSupplierCost;
}

export interface ShopifyDraftPreparationCollectionSnapshot {
  readonly id: string;
  readonly title: string;
}

export interface ShopifyDraftPreparationMediaSnapshot {
  readonly id: string;
  readonly url: string;
  readonly altText?: string;
}

export interface ShopifyDraftPreparationInventoryQuantitySnapshot {
  readonly locationId: string;
  readonly locationName: string;
  readonly quantity: number;
}

export interface ShopifyDraftPreparationVariantSnapshot {
  readonly id: string;
  readonly title: string;
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly sku: string;
  readonly inventoryItemId: string;
  readonly inventoryTracked: boolean;
  readonly inventoryPolicy: string;
  readonly inventoryQuantities: readonly ShopifyDraftPreparationInventoryQuantitySnapshot[];
  readonly optionValues: Readonly<Record<string, string>>;
}

export interface ShopifyDraftPreparationProductSnapshot {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
  readonly descriptionHtml: string;
  readonly vendor: string;
  readonly productType: string;
  readonly status: string;
  readonly tags: readonly string[];
  readonly templateSuffix?: string;
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly collections: readonly ShopifyDraftPreparationCollectionSnapshot[];
  readonly media: readonly ShopifyDraftPreparationMediaSnapshot[];
  readonly options: readonly ProductOption[];
  readonly variants: readonly ShopifyDraftPreparationVariantSnapshot[];
  readonly storeCurrency: ProductCurrency;
  readonly onlineStoreUrl?: string;
  readonly productDataTruncated: boolean;
  readonly variantDataTruncated: boolean;
  readonly inventoryDataIncomplete: boolean;
}

export interface ShopifyDraftPreparationReadRepository {
  readonly readProductById: (
    shopDomain: string,
    productId: string,
  ) => Promise<ShopifyDraftPreparationProductSnapshot | null>;
  readonly readProductsByHandle: (
    shopDomain: string,
    handle: string,
  ) => Promise<readonly ShopifyDraftPreparationProductSnapshot[]>;
}

export interface ShopifyDraftPreparationSafetyReport {
  readonly shopifyReadExecuted: true;
  readonly shopifyMutationExecuted: false;
  readonly productPublicationExecuted: false;
  readonly inventoryMutationExecuted: false;
  readonly themeMutationExecuted: false;
  readonly humanApprovalRequired: true;
}

export interface ShopifyDraftPreparationCurrentStateSummary {
  readonly productId: string;
  readonly handle: string;
  readonly status: string;
  readonly title: string;
  readonly vendor: string;
  readonly productType: string;
  readonly templateSuffix?: string;
  readonly storeCurrency: ProductCurrency;
  readonly collectionIds: readonly string[];
  readonly variantIds: readonly string[];
  readonly variantSkus: readonly string[];
  readonly inventoryItemIds: readonly string[];
}

export interface ShopifyDraftPreparationResult extends Readonly<Record<string, unknown>> {
  readonly workflowId: string;
  readonly executionMode: ShopifyDraftPreparationExecutionMode;
  readonly shopDomain: string;
  readonly productLocator: ShopifyDraftPreparationProductLocator;
  readonly shopifyProductIdentity: {
    readonly productId: string;
    readonly handle: string;
  };
  readonly currentShopifyStateSummary: ShopifyDraftPreparationCurrentStateSummary;
  readonly sourceProductSnapshot: ProductPreparationSourceProduct;
  readonly preparationProposal: ProductPreparationProposal;
  readonly executionSafetyReport: ShopifyDraftPreparationSafetyReport;
  readonly warnings: readonly ShopifyDraftPreparationWarning[];
  readonly approvalStatus: "required";
  readonly mutationExecuted: false;
  readonly publicationExecuted: false;
  readonly readyForHumanReview: boolean;
  readonly generatedAt: string;
}

export type ShopifyDraftPreparationWarningCode = "missing-supplier-cost";

export interface ShopifyDraftPreparationWarning {
  readonly code: ShopifyDraftPreparationWarningCode;
  readonly message: string;
}

export interface ShopifyProductSnapshotMappingResult {
  readonly sourceProduct: ProductPreparationSourceProduct;
  readonly warnings: readonly ShopifyDraftPreparationWarning[];
  readonly pricingSafelyAvailable: boolean;
}

export interface ShopifyDraftPreparationWorkflowDependencies {
  readonly shopifyReader: ShopifyDraftPreparationReadRepository;
  readonly productPreparationWorkflow: {
    readonly prepareProposal: (
      input: import("../product-preparation/index.js").ProductPreparationInput,
      generatedAt?: Date,
      workflowId?: string,
    ) => ProductPreparationProposal;
  };
}

export class UnsupportedShopifyDraftPreparationModeError extends Error {
  public constructor(mode: string) {
    super(`Unsupported Shopify draft preparation mode: ${mode}.`);
    this.name = "UnsupportedShopifyDraftPreparationModeError";
  }
}

export class InvalidShopDomainError extends Error {
  public constructor(shopDomain: string) {
    super(`Invalid Shopify shop domain: ${shopDomain}.`);
    this.name = "InvalidShopDomainError";
  }
}

export class InvalidProductLocatorError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidProductLocatorError";
  }
}

export class ShopifyProductNotFoundError extends Error {
  public constructor() {
    super("Shopify product was not found by the exact locator.");
    this.name = "ShopifyProductNotFoundError";
  }
}

export class AmbiguousShopifyProductError extends Error {
  public constructor() {
    super("Exact Shopify product handle lookup returned multiple products.");
    this.name = "AmbiguousShopifyProductError";
  }
}

export class IncompleteShopifyProductSnapshotError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IncompleteShopifyProductSnapshotError";
  }
}

export class TruncatedShopifyProductDataError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TruncatedShopifyProductDataError";
  }
}

export class ProductPreparationProposalFailureError extends Error {
  public constructor(message: string) {
    super(`Product preparation proposal failed safely: ${message}`);
    this.name = "ProductPreparationProposalFailureError";
  }
}

export type ShopifyDraftPreparationMappedProductImage = ProductImage;
export type ShopifyDraftPreparationMappedProductVariant = ProductVariant;
export type ShopifyDraftPreparationMappedTargetMarket = TargetMarket;
