import { ProductAnalyzerService } from "../../../ai-product/services/product-analyzer.service.js";
import { ProductBrandingService } from "../../../ai-product/services/product-branding.service.js";
import { ProductCopyService } from "../../../ai-product/services/product-copy.service.js";
import { ProductNormalizerService } from "../../../ai-product/services/product-normalizer.service.js";
import { ProductPricingService } from "../../../ai-product/services/product-pricing.service.js";
import { ProductRiskAssessmentService } from "../../../ai-product/services/product-risk-assessment.service.js";
import { ShopifyProductMapperService } from "../../../ai-product/services/shopify-product-mapper.service.js";
import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductRiskAssessment,
  RawProductInput,
  ShopifyProductPayload,
} from "../../../ai-product/types/product.types.js";
import type { ProductBrandingResult } from "../../../ai-product/services/product-branding.service.js";
import type { ProductPricingRecommendation } from "../../../ai-product/services/product-pricing.service.js";
import { PRODUCT_PREPARATION_STEP_ORDER } from "./product-preparation.steps.js";
import {
  createPreservationRequirements,
  createSafeUpdateProposal,
} from "./product-preparation.result.js";
import type {
  ProductPreparationAdapters,
  ProductPreparationInput,
  ProductPreparationProposal,
  ProductPreparationSkippedStep,
  ProductPreparationStepRecord,
} from "./product-preparation.types.js";
import { ProductPreparationWorkflowError } from "./product-preparation.types.js";
import { validateProductPreparationInput } from "./product-preparation.validation.js";

export const createDefaultProductPreparationAdapters = (): ProductPreparationAdapters => ({
  normalizer: new ProductNormalizerService(),
  analyzer: new ProductAnalyzerService(),
  riskAssessor: new ProductRiskAssessmentService(),
  branding: new ProductBrandingService(),
  copy: new ProductCopyService(),
  pricing: new ProductPricingService(),
  shopifyMapper: new ShopifyProductMapperService(),
  shopifyProductUpdate: { blocked: true },
});

export class ProductPreparationWorkflow {
  public constructor(
    private readonly adapters: ProductPreparationAdapters = createDefaultProductPreparationAdapters(),
  ) {}

  public prepareProposal(
    input: ProductPreparationInput,
    generatedAt: Date = new Date(),
    workflowId = `saie-product-preparation-${generatedAt.toISOString()}`,
  ): ProductPreparationProposal {
    const completedSteps: ProductPreparationStepRecord[] = [];
    const skippedSteps: ProductPreparationSkippedStep[] = [];
    const warnings: string[] = [];
    const generatedAtIso = generatedAt.toISOString();

    try {
      validateProductPreparationInput(input);
      this.complete(completedSteps, "ValidateInput");

      let normalizedProduct: NormalizedProduct | undefined;
      let analysis: ProductAIAnalysis | undefined;
      let riskAssessment: ProductRiskAssessment | undefined;
      let brandingProposal: ProductBrandingResult | undefined;
      let copyProposal: ProductCopy | undefined;
      let pricingProposal: ProductPricingRecommendation | undefined;
      let shopifyMappingProposal: ShopifyProductPayload | undefined;

      if (input.requestedCapabilities.normalize) {
        normalizedProduct = this.stabilizeNormalizedProduct(
          this.adapters.normalizer.normalize(this.toRawProductInput(input, generatedAt)),
          generatedAt,
        );
        this.complete(completedSteps, "NormalizeProduct");
      } else {
        this.skip(skippedSteps, "NormalizeProduct", "capability-not-requested", "Normalization was not requested.");
      }

      if (input.optionalAnalysisContext !== undefined && normalizedProduct !== undefined) {
        analysis = this.stabilizeAnalysis(
          this.adapters.analyzer.analyze(
            normalizedProduct,
            input.optionalAnalysisContext.score,
            input.optionalAnalysisContext.riskAssessment,
          ),
          generatedAt,
        );
        this.complete(completedSteps, "AnalyzeProduct");
      } else {
        this.skip(
          skippedSteps,
          "AnalyzeProduct",
          "analysis-not-executed",
          "ProductAnalyzerService requires explicit compatible score and risk context.",
        );
      }

      if (input.requestedCapabilities.assessRisk && normalizedProduct !== undefined) {
        riskAssessment = this.adapters.riskAssessor.assess(normalizedProduct);
        this.complete(completedSteps, "AssessProductRisk");
      } else {
        this.skip(
          skippedSteps,
          "AssessProductRisk",
          input.requestedCapabilities.assessRisk ? "dependency-output-unavailable" : "capability-not-requested",
          "Risk assessment requires a normalized product and an explicit capability request.",
        );
      }

      if (input.requestedCapabilities.generateBranding && normalizedProduct !== undefined && analysis !== undefined) {
        brandingProposal = this.adapters.branding.buildBranding(normalizedProduct, analysis);
        this.complete(completedSteps, "GenerateProductBranding");
      } else {
        this.skip(
          skippedSteps,
          "GenerateProductBranding",
          input.requestedCapabilities.generateBranding ? "dependency-output-unavailable" : "capability-not-requested",
          "Branding requires normalized product data and a safely executed analysis.",
        );
      }

      if (
        input.requestedCapabilities.generateCopy &&
        normalizedProduct !== undefined &&
        analysis !== undefined &&
        brandingProposal !== undefined
      ) {
        copyProposal = this.adapters.copy.generate(normalizedProduct, analysis, brandingProposal);
        this.complete(completedSteps, "GenerateProductCopy");
      } else {
        this.skip(
          skippedSteps,
          "GenerateProductCopy",
          input.requestedCapabilities.generateCopy ? "dependency-output-unavailable" : "capability-not-requested",
          "Copy generation requires normalized product data, analysis, and branding.",
        );
      }

      if (
        input.requestedCapabilities.recommendPricing &&
        normalizedProduct !== undefined &&
        analysis !== undefined &&
        brandingProposal !== undefined
      ) {
        pricingProposal = this.adapters.pricing.recommend(normalizedProduct, analysis, brandingProposal);
        this.complete(completedSteps, "RecommendProductPricing");
      } else {
        this.skip(
          skippedSteps,
          "RecommendProductPricing",
          input.requestedCapabilities.recommendPricing ? "dependency-output-unavailable" : "capability-not-requested",
          "Pricing requires normalized product data, analysis, and branding.",
        );
      }

      if (
        input.requestedCapabilities.mapForShopify &&
        normalizedProduct !== undefined &&
        analysis !== undefined &&
        brandingProposal !== undefined &&
        copyProposal !== undefined &&
        pricingProposal !== undefined
      ) {
        shopifyMappingProposal = this.adapters.shopifyMapper.map(
          normalizedProduct,
          analysis,
          brandingProposal,
          copyProposal,
          pricingProposal,
        );
        this.assertMappingIsSafe(shopifyMappingProposal, normalizedProduct);
        this.complete(completedSteps, "MapProductForShopify");
      } else {
        this.skip(
          skippedSteps,
          "MapProductForShopify",
          input.requestedCapabilities.mapForShopify ? "dependency-output-unavailable" : "capability-not-requested",
          "Shopify mapping requires normalized product data, analysis, branding, copy, and pricing.",
        );
      }

      const safeUpdateProposal =
        input.requestedCapabilities.prepareSafeUpdateProposal
          ? createSafeUpdateProposal(input, shopifyMappingProposal, copyProposal, pricingProposal)
          : undefined;

      if (safeUpdateProposal !== undefined) {
        this.complete(completedSteps, "PrepareSafeUpdateProposal");
      } else {
        this.skip(
          skippedSteps,
          "PrepareSafeUpdateProposal",
          "capability-not-requested",
          "Safe update proposal was not requested.",
        );
      }

      this.complete(completedSteps, "RequireHumanApproval");

      if (analysis === undefined) {
        warnings.push("Product analysis was not executed because compatible precomputed inputs were not supplied.");
      }

      return {
        workflowId,
        executionMode: "proposal-only",
        productReference: {
          sourceId: input.sourceProduct.sourceId,
          sourceUrl: input.sourceProduct.sourceUrl,
          title: input.sourceProduct.title,
        },
        completedSteps,
        skippedSteps,
        warnings,
        ...(normalizedProduct === undefined ? {} : { normalizedProduct }),
        ...(riskAssessment === undefined ? {} : { riskAssessment }),
        ...(analysis === undefined ? {} : { analysis }),
        ...(brandingProposal === undefined ? {} : { brandingProposal }),
        ...(copyProposal === undefined ? {} : { copyProposal }),
        ...(pricingProposal === undefined ? {} : { pricingProposal }),
        ...(shopifyMappingProposal === undefined ? {} : { shopifyMappingProposal }),
        ...(safeUpdateProposal === undefined ? {} : { safeUpdateProposal }),
        preservationRequirements: createPreservationRequirements(input),
        approvalStatus: "required",
        mutationExecuted: false,
        publicationExecuted: false,
        readyForHumanReview: completedSteps.some((step) => step.id === "PrepareSafeUpdateProposal"),
        generatedAt: generatedAtIso,
      };
    } catch (error) {
      if (error instanceof ProductPreparationWorkflowError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown product preparation failure.";
      throw new ProductPreparationWorkflowError(`Product preparation failed safely: ${message}`);
    }
  }

  private toRawProductInput(input: ProductPreparationInput, generatedAt: Date): RawProductInput {
    return {
      source: input.sourceProduct.supplier.source,
      externalId: input.sourceProduct.sourceId,
      title: input.sourceProduct.title,
      description: input.sourceProduct.description,
      productUrl: input.sourceProduct.sourceUrl,
      supplier: { ...input.sourceProduct.supplier },
      images: input.sourceProduct.images.map((image) => ({ ...image })),
      options: input.sourceProduct.options.map((option) => ({ ...option, values: [...option.values] })),
      variants: input.sourceProduct.variants.map((variant) => ({
        ...variant,
        optionValues: { ...variant.optionValues },
      })),
      tags: [...input.sourceProduct.tags, ...input.brandContext.preferredCollections],
      category: input.sourceProduct.category,
      brand: input.sourceProduct.brand || input.brandContext.brandName,
      targetMarkets:
        input.sourceProduct.targetMarkets.length > 0
          ? [...input.sourceProduct.targetMarkets]
          : [...input.brandContext.targetMarkets],
      metadata: {
        productType: input.sourceProduct.productType,
        shippingCost: input.sourceProduct.cost.shippingCost,
        transactionCost: input.sourceProduct.cost.transactionCost,
        advertisingCostEstimate: input.sourceProduct.cost.advertisingCostEstimate,
      },
      capturedAt: generatedAt,
    };
  }

  private stabilizeNormalizedProduct(product: NormalizedProduct, generatedAt: Date): NormalizedProduct {
    return {
      ...product,
      images: product.images.map((image) => ({ ...image })),
      options: product.options.map((option) => ({ ...option, values: [...option.values] })),
      variants: product.variants.map((variant) => ({ ...variant, optionValues: { ...variant.optionValues } })),
      tags: [...product.tags],
      targetMarkets: [...product.targetMarkets],
      createdAt: generatedAt,
      updatedAt: generatedAt,
    };
  }

  private stabilizeAnalysis(analysis: ProductAIAnalysis, generatedAt: Date): ProductAIAnalysis {
    return {
      ...analysis,
      analyzedAt: generatedAt,
    };
  }

  private assertMappingIsSafe(mapping: ShopifyProductPayload, product: NormalizedProduct): void {
    if (mapping.title.trim().length === 0 || mapping.descriptionHtml.trim().length === 0) {
      throw new ProductPreparationWorkflowError("Mapped Shopify output is incomplete.");
    }

    if (mapping.variants.length !== product.variants.length) {
      throw new ProductPreparationWorkflowError("Mapped Shopify output could recreate variants.");
    }
  }

  private complete(steps: ProductPreparationStepRecord[], id: ProductPreparationStepRecord["id"]): void {
    steps.push({ id, order: PRODUCT_PREPARATION_STEP_ORDER.indexOf(id) + 1, status: "completed" });
  }

  private skip(
    steps: ProductPreparationSkippedStep[],
    id: ProductPreparationSkippedStep["id"],
    reason: ProductPreparationSkippedStep["reason"],
    note: string,
  ): void {
    steps.push({ id, reason, notes: [note] });
  }
}
