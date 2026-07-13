import type {
  AIProductRecord,
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductRiskAssessment,
  ProductScoreBreakdown,
  RawProductInput,
  ShopifyProductPayload,
} from "../types/product.types.js";
import { ProductAnalyzerService } from "./product-analyzer.service.js";
import {
  ProductBrandingService,
  type ProductBrandingResult,
} from "./product-branding.service.js";
import { ProductCopyService } from "./product-copy.service.js";
import { ProductNormalizerService } from "./product-normalizer.service.js";
import {
  ProductPricingService,
  type ProductPricingRecommendation,
} from "./product-pricing.service.js";
import { ProductRiskAssessmentService } from "./product-risk-assessment.service.js";
import { ProductScoringService } from "./product-scoring.service.js";
import { ShopifyProductMapperService } from "./shopify-product-mapper.service.js";

const ENGINE_RECORD_VERSION = 1;

/**
 * Complete deterministic AI Product Engine output for downstream application workflows.
 */
export interface AIProductEngineResult {
  readonly record: AIProductRecord;
  readonly normalizedProduct: NormalizedProduct;
  readonly score: ProductScoreBreakdown;
  readonly risk: ProductRiskAssessment;
  readonly analysis: ProductAIAnalysis;
  readonly branding: ProductBrandingResult;
  readonly copy: ProductCopy;
  readonly pricing: ProductPricingRecommendation;
  readonly shopifyPayload: ShopifyProductPayload;
}

/**
 * Coordinates the deterministic AI Product Engine pipeline from raw input to Shopify-ready payload.
 */
export class AIProductEngineService {
  public constructor(
    private readonly normalizer = new ProductNormalizerService(),
    private readonly scoring = new ProductScoringService(),
    private readonly riskAssessment = new ProductRiskAssessmentService(),
    private readonly analyzer = new ProductAnalyzerService(),
    private readonly brandingService = new ProductBrandingService(),
    private readonly copyService = new ProductCopyService(),
    private readonly pricingService = new ProductPricingService(),
    private readonly shopifyMapper = new ShopifyProductMapperService(),
  ) {}

  /**
   * Runs the full deterministic product intelligence pipeline and returns every major intermediate result.
   */
  public process(input: RawProductInput): AIProductEngineResult {
    const normalizedProduct = this.normalizer.normalize(input);
    const score = this.scoring.score(normalizedProduct);
    const risk = this.riskAssessment.assess(normalizedProduct);
    const analysis = this.analyzer.analyze(normalizedProduct, score, risk);
    const branding = this.brandingService.buildBranding(normalizedProduct, analysis);
    const copy = this.copyService.generate(normalizedProduct, analysis, branding);
    const pricing = this.pricingService.recommend(normalizedProduct, analysis, branding);
    const shopifyPayload = this.shopifyMapper.map(
      normalizedProduct,
      analysis,
      branding,
      copy,
      pricing,
    );
    const record = this.buildRecord(normalizedProduct, analysis, copy);

    return {
      record,
      normalizedProduct,
      score,
      risk,
      analysis,
      branding,
      copy,
      pricing,
      shopifyPayload,
    };
  }

  private buildRecord(
    normalizedProduct: NormalizedProduct,
    analysis: ProductAIAnalysis,
    copy: ProductCopy,
  ): AIProductRecord {
    return {
      normalizedProduct,
      aiAnalysis: analysis,
      generatedCopy: copy,
      version: ENGINE_RECORD_VERSION,
      createdAt: normalizedProduct.createdAt,
      updatedAt: normalizedProduct.updatedAt,
    };
  }
}
