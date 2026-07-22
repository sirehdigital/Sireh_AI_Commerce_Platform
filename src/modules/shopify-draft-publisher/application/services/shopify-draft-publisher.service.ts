import type { ShopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import { shopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import { ShopifyClient } from "../../../../integrations/shopify/shopify.client.js";
import type {
  ShopifySession,
  ShopifyShopDomain,
} from "../../../../integrations/shopify/shopify.types.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductImage,
  ProductOption,
  ProductVariant,
  ShopifyProductPayload,
} from "../../../ai-product/types/product.types.js";
import type { ProductBrandingResult } from "../../../ai-product/services/product-branding.service.js";
import type { ProductPricingRecommendation } from "../../../ai-product/services/product-pricing.service.js";
import { ShopifyProductMapperService } from "../../../ai-product/services/shopify-product-mapper.service.js";
import type { MarketingContent } from "../../../marketing-engine/domain/models/marketing-content.model.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type {
  ShopifyDraftPublishInput,
  ShopifyDraftPublishResult,
} from "../../domain/models/shopify-draft-publisher.model.js";

interface ShopifyDraftPublisherClient {
  graphql<TData>(query: string, variables: Readonly<Record<string, unknown>>): Promise<TData>;
}

type ShopifyDraftPublisherClientFactory = (session: ShopifySession) => ShopifyDraftPublisherClient;

interface GraphqlUserError {
  readonly field: readonly string[] | null;
  readonly message: string;
}

interface ProductCreateResponse {
  readonly productCreate: {
    readonly product: {
      readonly id: string;
      readonly handle: string;
      readonly status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "UNLISTED";
      readonly legacyResourceId?: string | null;
    } | null;
    readonly userErrors: readonly GraphqlUserError[];
  };
}

const CREATE_DRAFT_PRODUCT_MUTATION = `
mutation CreateSirehDraftProduct($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product {
      id
      handle
      status
      legacyResourceId
    }
    userErrors {
      field
      message
    }
  }
}
`;

export class ShopifyDraftPublisherService {
  public constructor(
    private readonly sessionRepository: ShopifySessionRepository = shopifySessionRepository,
    private readonly clientFactory: ShopifyDraftPublisherClientFactory = (session) =>
      new ShopifyClient({
        shop: session.shop,
        accessToken: session.accessToken,
        apiVersion: session.apiVersion,
      }),
    private readonly productMapper = new ShopifyProductMapperService(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async createDraft(input: ShopifyDraftPublishInput): Promise<ShopifyDraftPublishResult> {
    const normalizedInput = this.validateInput(input);
    const session = await this.requireActiveSession(normalizedInput.shop);
    const payload = this.buildShopifyPayload(normalizedInput);
    const response = await this.executeProductCreate(session, payload, normalizedInput.collectionIds);
    const product = response.productCreate.product;

    this.assertNoUserErrors(response.productCreate.userErrors);

    if (product === null) {
      throw AppError.internal("Shopify draft product creation did not return a product.", undefined, "SHOPIFY_DRAFT_CREATE_EMPTY_RESPONSE");
    }

    if (product.status !== "DRAFT") {
      throw AppError.conflict(
        "Shopify created product did not remain in draft status.",
        { productId: product.id, status: product.status },
        "SHOPIFY_DRAFT_STATUS_MISMATCH",
      );
    }

    return {
      shop: session.shop,
      productId: product.id,
      handle: product.handle,
      status: "DRAFT",
      ...this.optionalAdminReference(session.shop, product.legacyResourceId),
    };
  }

  private async requireActiveSession(shop: ShopifyShopDomain): Promise<ShopifySession> {
    const session = await this.sessionRepository.getSession(shop);

    if (session === undefined) {
      throw AppError.unauthorized(
        `No active Shopify session found for shop: ${shop}.`,
        { shop },
        "SHOPIFY_SESSION_MISSING",
      );
    }

    if (session.revokedAt !== undefined) {
      throw AppError.unauthorized("Shopify session has been revoked.", { shop }, "SHOPIFY_SESSION_REVOKED");
    }

    if (session.expiresAt !== undefined && session.expiresAt.getTime() <= this.now().getTime()) {
      throw AppError.unauthorized("Shopify session has expired.", { shop }, "SHOPIFY_SESSION_EXPIRED");
    }

    return {
      ...session,
      scope: [...session.scope],
      installedAt: new Date(session.installedAt),
      updatedAt: new Date(session.updatedAt),
      ...(session.expiresAt === undefined ? {} : { expiresAt: new Date(session.expiresAt) }),
      ...(session.revokedAt === undefined ? {} : { revokedAt: new Date(session.revokedAt) }),
    };
  }

  private async executeProductCreate(
    session: ShopifySession,
    payload: ShopifyProductPayload,
    collectionIds: readonly string[] | undefined,
  ): Promise<ProductCreateResponse> {
    try {
      return await this.clientFactory(session).graphql<ProductCreateResponse>(
        CREATE_DRAFT_PRODUCT_MUTATION,
        {
          product: this.toShopifyProductInput(payload, collectionIds),
        },
      );
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw AppError.internal(
          "Shopify draft product creation failed.",
          { shop: session.shop, upstreamCode: error.code, upstreamStatusCode: error.statusCode },
          "SHOPIFY_DRAFT_CREATE_FAILED",
        );
      }

      throw AppError.internal(
        "Shopify draft product creation failed.",
        { shop: session.shop },
        "SHOPIFY_DRAFT_CREATE_FAILED",
      );
    }
  }

  private buildShopifyPayload(input: Required<Pick<ShopifyDraftPublishInput, "shop" | "draft" | "marketingContent">> & Pick<ShopifyDraftPublishInput, "collectionIds" | "tags">): ShopifyProductPayload {
    const normalizedProduct = this.toNormalizedProduct(input.draft, input.tags);
    const copy = this.toProductCopy(input.marketingContent);
    const analysis = this.toProductAnalysis(input.marketingContent);
    const branding = this.toProductBranding(input.marketingContent, input.draft);
    const pricing = this.toProductPricing(input.draft);

    return {
      ...this.productMapper.map(normalizedProduct, analysis, branding, copy, pricing),
      status: "draft",
    };
  }

  private toShopifyProductInput(
    payload: ShopifyProductPayload,
    collectionIds: readonly string[] | undefined,
  ): Readonly<Record<string, unknown>> {
    return {
      title: payload.title,
      descriptionHtml: payload.descriptionHtml,
      vendor: payload.vendor,
      productType: payload.productType,
      tags: payload.tags,
      status: "DRAFT",
      seo: payload.seo,
      files: payload.images.map((image) => ({
        originalSource: image.src,
        alt: image.altText,
      })),
      variants: payload.variants.map((variant) => ({
        sku: variant.sku,
        price: this.formatMoney(variant.price),
        compareAtPrice: variant.compareAtPrice === undefined ? null : this.formatMoney(variant.compareAtPrice),
        optionValues: variant.optionValues,
        inventoryQuantities:
          variant.inventoryQuantity === undefined
            ? []
            : [{ availableQuantity: variant.inventoryQuantity }],
      })),
      productOptions: payload.options.map((option) => ({
        name: option.name,
        values: option.values.map((value) => ({ name: value })),
      })),
      collectionsToJoin: this.normalizeCollectionIds(collectionIds),
    };
  }

  private validateInput(input: ShopifyDraftPublishInput): Required<Pick<ShopifyDraftPublishInput, "shop" | "draft" | "marketingContent">> & Pick<ShopifyDraftPublishInput, "collectionIds" | "tags"> {
    this.assertNonEmpty(input.shop, "Shop is required.", "SHOP_REQUIRED");
    this.validateDraft(input.draft);
    this.validateMarketingContent(input.marketingContent);

    return {
      shop: input.shop.trim().toLowerCase() as ShopifyShopDomain,
      draft: input.draft,
      marketingContent: input.marketingContent,
      ...(input.collectionIds === undefined ? {} : { collectionIds: this.normalizeValues(input.collectionIds) }),
      ...(input.tags === undefined ? {} : { tags: this.normalizeValues(input.tags) }),
    };
  }

  private validateDraft(draft: ProductDraft): void {
    this.assertNonEmpty(draft.id, "Product Draft ID is required.", "PRODUCT_DRAFT_ID_REQUIRED");
    this.assertNonEmpty(draft.title, "Product Draft title is required.", "PRODUCT_DRAFT_TITLE_REQUIRED");
    this.assertNonEmpty(draft.description, "Product Draft description is required.", "PRODUCT_DRAFT_DESCRIPTION_REQUIRED");

    if (draft.variants.length === 0) {
      throw AppError.badRequest("Product Draft requires at least one variant.", { draftId: draft.id }, "PRODUCT_DRAFT_VARIANTS_REQUIRED");
    }

    for (const [index, variant] of draft.variants.entries()) {
      this.assertNonEmpty(variant.title, "Product Draft variant title is required.", `PRODUCT_DRAFT_VARIANT_${index}_TITLE_REQUIRED`);

      if (!Number.isFinite(variant.sellingPrice.amount) || variant.sellingPrice.amount < 0) {
        throw AppError.badRequest(
          "Product Draft variant selling price must be finite and non-negative.",
          { draftId: draft.id, variantId: variant.id },
          "PRODUCT_DRAFT_VARIANT_PRICE_INVALID",
        );
      }
    }
  }

  private validateMarketingContent(marketingContent: MarketingContent): void {
    this.assertNonEmpty(marketingContent.productTitle, "Marketing product title is required.", "MARKETING_PRODUCT_TITLE_REQUIRED");
    this.assertNonEmpty(marketingContent.productDescription, "Marketing product description is required.", "MARKETING_DESCRIPTION_REQUIRED");
    this.assertNonEmpty(marketingContent.seoTitle, "Marketing SEO title is required.", "MARKETING_SEO_TITLE_REQUIRED");
    this.assertNonEmpty(marketingContent.seoDescription, "Marketing SEO description is required.", "MARKETING_SEO_DESCRIPTION_REQUIRED");
    this.assertNonEmpty(marketingContent.callToAction, "Marketing call to action is required.", "MARKETING_CTA_REQUIRED");
  }

  private toNormalizedProduct(draft: ProductDraft, additionalTags: readonly string[] | undefined): NormalizedProduct {
    const variants = this.toProductVariants(draft);
    const firstVariant = variants[0];
    const currency = firstVariant?.currency ?? "USD";
    const productCost = firstVariant?.cost ?? 0;
    const sellingPrice = firstVariant?.suggestedPrice ?? 0;

    return {
      id: draft.id,
      source: draft.source.sourceType === "autods" ? "autods" : "manual",
      externalId: draft.source.sourceId,
      status: "draft",
      title: draft.title,
      description: draft.description,
      ...this.optionalText("brand", draft.brand ?? draft.vendor),
      ...this.optionalText("category", draft.category),
      ...this.optionalText("productType", draft.productType),
      tags: this.normalizeValues([...draft.tags, ...(additionalTags ?? [])]),
      targetMarkets: draft.targetMarkets as NormalizedProduct["targetMarkets"],
      images: this.toProductImages(draft),
      options: this.toProductOptions(draft),
      variants,
      cost: {
        productCost,
        shippingCost: 0,
        transactionCost: 0,
        advertisingCostEstimate: 0,
        totalLandedCost: productCost,
        currency,
      },
      pricing: {
        cost: productCost,
        sellingPrice,
        grossProfit: this.roundMoney(Math.max(0, sellingPrice - productCost)),
        grossMarginPercentage: sellingPrice <= 0 ? 0 : this.roundPercentage(((sellingPrice - productCost) / sellingPrice) * 100),
        markupPercentage: productCost <= 0 ? 0 : this.roundPercentage(((sellingPrice - productCost) / productCost) * 100),
        currency,
      },
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    };
  }

  private toProductCopy(marketingContent: MarketingContent): ProductCopy {
    return {
      brandedTitle: marketingContent.productTitle,
      shortDescription: marketingContent.productDescription,
      fullDescription: marketingContent.emailBody,
      benefits: this.normalizeValues([marketingContent.facebookCaption, marketingContent.instagramCaption]),
      featureHighlights: this.normalizeValues([marketingContent.tiktokCaption]),
      faq: [],
      callToAction: marketingContent.callToAction,
      seoTitle: marketingContent.seoTitle,
      seoDescription: marketingContent.seoDescription,
      seoKeywords: marketingContent.productTags,
    };
  }

  private toProductAnalysis(marketingContent: MarketingContent): ProductAIAnalysis {
    return {
      summary: marketingContent.productDescription,
      keyBenefits: this.normalizeValues([marketingContent.productDescription]),
      keyFeatures: [],
      audience: {
        primaryAudience: "Selected customers",
        ageRanges: [],
        customerProblems: [],
        customerDesires: [marketingContent.productDescription],
        purchaseMotivations: [],
        objections: [],
        recommendedMarkets: [],
      },
      marketingAngles: [],
      score: {
        demand: 50,
        competition: 50,
        profitability: 50,
        trend: 50,
        supplierReliability: 50,
        shipping: 50,
        marketingPotential: 50,
        brandability: 50,
        overall: 50,
      },
      risks: {
        level: "low",
        score: 10,
        reasons: [],
        intellectualPropertyRisk: 0,
        restrictedProductRisk: 0,
        supplierRisk: 0,
        shippingRisk: 0,
        refundRisk: 0,
      },
      recommendation: "test",
      reasoning: "Deterministic Shopify draft publisher mapping.",
      analyzedAt: this.now(),
      model: "deterministic-shopify-draft-publisher",
    };
  }

  private toProductBranding(
    marketingContent: MarketingContent,
    draft: ProductDraft,
  ): ProductBrandingResult {
    return {
      brandedTitle: marketingContent.productTitle,
      positioningStatement: marketingContent.productDescription,
      uniqueSellingProposition: marketingContent.callToAction,
      customerTransformation: marketingContent.productDescription,
      primaryAudience: draft.branding?.targetAudience[0] ?? "Selected customers",
      brandVoice: "practical",
      positioningTier: "mass-market",
      corePromise: marketingContent.productDescription,
      differentiationPoints: [],
      messagingPillars: [],
      namingDirections: [],
      taglineOptions: [],
      approvedClaims: [marketingContent.productDescription],
      avoidedClaims: [],
      confidenceScore: 50,
      reasoning: ["Generated from Product Draft and Marketing Content."],
    };
  }

  private toProductPricing(draft: ProductDraft): ProductPricingRecommendation {
    const firstVariant = draft.variants[0];
    const currency = firstVariant?.sellingPrice.currency ?? "USD";
    const cost = firstVariant?.supplierPrice.amount ?? 0;
    const price = firstVariant?.sellingPrice.amount ?? 0;
    const grossProfit = this.roundMoney(Math.max(0, price - cost));

    return {
      currency,
      strategy: "balanced",
      currentCost: cost,
      totalLandedCost: cost,
      currentSellingPrice: price,
      recommendedSellingPrice: price,
      recommendedCompareAtPrice: firstVariant?.compareAtPrice?.amount ?? 0,
      grossProfit,
      grossMarginPercentage: price <= 0 ? 0 : this.roundPercentage((grossProfit / price) * 100),
      markupPercentage: cost <= 0 ? 0 : this.roundPercentage((grossProfit / cost) * 100),
      minimumViablePrice: cost,
      targetProfitPerUnit: grossProfit,
      priceIncreasePercentage: 0,
      confidenceScore: 50,
      confidenceLevel: "medium",
      variantRecommendations: draft.variants.map((variant) => ({
        variantId: variant.id,
        ...(variant.sku === undefined ? {} : { sku: variant.sku }),
        cost: variant.supplierPrice.amount,
        currentPrice: variant.sellingPrice.amount,
        recommendedPrice: variant.sellingPrice.amount,
        compareAtPrice: variant.compareAtPrice?.amount ?? 0,
        grossProfit: this.roundMoney(Math.max(0, variant.sellingPrice.amount - variant.supplierPrice.amount)),
        grossMarginPercentage:
          variant.sellingPrice.amount <= 0
            ? 0
            : this.roundPercentage(((variant.sellingPrice.amount - variant.supplierPrice.amount) / variant.sellingPrice.amount) * 100),
        markupPercentage:
          variant.supplierPrice.amount <= 0
            ? 0
            : this.roundPercentage(((variant.sellingPrice.amount - variant.supplierPrice.amount) / variant.supplierPrice.amount) * 100),
        available: variant.available,
      })),
      reasons: ["Product Draft selling prices are used for draft creation."],
      warnings: [],
    };
  }

  private toProductImages(draft: ProductDraft): readonly ProductImage[] {
    return draft.images
      .filter((image) => image.selected)
      .map((image, index) => ({
        id: image.id ?? `${draft.id}:image:${index + 1}`,
        url: image.sourceUrl,
        ...(image.altText === undefined ? {} : { altText: image.altText }),
        position: image.position,
        ...(image.width === undefined ? {} : { width: image.width }),
        ...(image.height === undefined ? {} : { height: image.height }),
        isPrimary: image.primary,
      }));
  }

  private toProductOptions(draft: ProductDraft): readonly ProductOption[] {
    const optionsByName = new Map<string, Set<string>>();

    for (const variant of draft.variants) {
      for (const option of variant.options) {
        const name = option.name.trim();
        const value = option.value.trim();

        if (name.length === 0 || value.length === 0) {
          continue;
        }

        const key = name.toLowerCase();
        optionsByName.set(key, optionsByName.get(key) ?? new Set<string>());
        optionsByName.get(key)?.add(value);
      }
    }

    return [...optionsByName.entries()].map(([name, values]) => ({
      name,
      values: [...values],
    }));
  }

  private toProductVariants(draft: ProductDraft): readonly ProductVariant[] {
    return draft.variants.map((variant) => ({
      id: variant.id,
      ...(variant.sourceVariantId === undefined ? {} : { supplierVariantId: variant.sourceVariantId }),
      ...(variant.sku === undefined ? {} : { sku: variant.sku }),
      title: variant.title,
      optionValues: Object.fromEntries(variant.options.map((option) => [option.name, option.value])),
      cost: variant.supplierPrice.amount,
      suggestedPrice: variant.sellingPrice.amount,
      ...(variant.compareAtPrice === undefined ? {} : { compareAtPrice: variant.compareAtPrice.amount }),
      currency: variant.sellingPrice.currency,
      ...(variant.inventoryQuantity === undefined ? {} : { inventoryQuantity: variant.inventoryQuantity }),
      ...(variant.weightGrams === undefined ? {} : { weight: variant.weightGrams, weightUnit: "g" }),
      available: variant.available,
    }));
  }

  private assertNoUserErrors(errors: readonly GraphqlUserError[]): void {
    if (errors.length === 0) {
      return;
    }

    throw AppError.badRequest(
      "Shopify draft product creation returned validation errors.",
      {
        errors: errors.map((error) => ({
          field: error.field,
          message: error.message,
        })),
      },
      "SHOPIFY_DRAFT_VALIDATION_FAILED",
    );
  }

  private normalizeCollectionIds(collectionIds: readonly string[] | undefined): readonly string[] {
    return this.normalizeValues(collectionIds ?? []);
  }

  private normalizeValues(values: readonly string[]): readonly string[] {
    const uniqueValues = new Map<string, string>();

    for (const value of values) {
      const normalized = value.trim();

      if (normalized.length > 0 && !uniqueValues.has(normalized.toLowerCase())) {
        uniqueValues.set(normalized.toLowerCase(), normalized);
      }
    }

    return [...uniqueValues.values()];
  }

  private optionalText<Key extends "brand" | "category" | "productType">(
    key: Key,
    value: string | undefined,
  ): Pick<NormalizedProduct, Key> | Record<string, never> {
    const normalized = value?.trim();

    return normalized === undefined || normalized.length === 0 ? {} : { [key]: normalized } as Pick<NormalizedProduct, Key>;
  }

  private optionalAdminReference(
    shop: ShopifyShopDomain,
    legacyResourceId: string | null | undefined,
  ): Pick<ShopifyDraftPublishResult, "adminReference"> | Record<string, never> {
    return legacyResourceId === null || legacyResourceId === undefined || legacyResourceId.trim().length === 0
      ? {}
      : { adminReference: `https://${shop}/admin/products/${legacyResourceId}` };
  }

  private assertNonEmpty(value: string, message: string, code: string): void {
    if (value.trim().length === 0) {
      throw AppError.badRequest(message, undefined, code);
    }
  }

  private formatMoney(value: number): string {
    return this.roundMoney(value).toFixed(2);
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundPercentage(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
