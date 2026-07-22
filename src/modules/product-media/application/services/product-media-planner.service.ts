import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type {
  ProductMediaAssetType,
  ProductMediaBrandProfile,
  ProductMediaPlan,
  ProductMediaPlannedAsset,
  ProductMediaSource,
  ProductMediaSpecification,
} from "../../domain/models/index.js";
import {
  DEFAULT_BRAND_MEDIA_PROFILE,
  DEFAULT_PRODUCT_MEDIA_ASSET_TYPES,
  PRODUCT_MEDIA_DEFAULT_SPECIFICATIONS,
} from "./product-media-defaults.js";
import { ProductMediaPromptService } from "./product-media-prompt.service.js";
import { ProductMediaQualityEvaluator } from "./product-media-quality-evaluator.service.js";
import { ProductMediaSourceValidator } from "./product-media-source-validator.service.js";

export interface ProductMediaPlanRequest {
  readonly productDraft: ProductDraft;
  readonly requestedAssetTypes?: readonly ProductMediaAssetType[];
  readonly channels?: readonly string[];
  readonly locale?: string;
  readonly brandProfile?: Partial<ProductMediaBrandProfile>;
  readonly sourceMedia?: readonly ProductMediaSource[];
  readonly createdAt: string;
  readonly idGenerator: () => string;
}

const BENEFIT_KEYWORDS = ["benefit", "soft", "smooth", "hydrate", "glow", "nourish", "calm", "premium"];
const INGREDIENT_KEYWORDS = ["ingredient", "aloe", "shea", "botanical", "vitamin", "oil", "extract"];
const USAGE_KEYWORDS = ["how to use", "apply", "massage", "use daily", "after shower"];

export class ProductMediaPlannerService {
  private readonly promptService = new ProductMediaPromptService();
  private readonly sourceValidator = new ProductMediaSourceValidator();
  private readonly qualityEvaluator = new ProductMediaQualityEvaluator();

  public createPlan(request: ProductMediaPlanRequest): ProductMediaPlan {
    const brandProfile = this.toBrandProfile(request);
    const sourceValidation = this.sourceValidator.validate(request.sourceMedia ?? this.sourcesFromDraft(request.productDraft));
    const requestedAssetTypes = request.requestedAssetTypes ?? DEFAULT_PRODUCT_MEDIA_ASSET_TYPES;
    const warnings = [...sourceValidation.warnings];
    const selectedTypes = this.selectAssetTypes(request.productDraft, requestedAssetTypes, warnings);
    const assets = selectedTypes.map((assetType) =>
      this.toPlannedAsset(assetType, request.productDraft, brandProfile, sourceValidation.validSources, request, warnings),
    );
    const planWithoutQuality: Omit<ProductMediaPlan, "qualityReport"> = {
      planId: `product-media-plan:${request.idGenerator()}`,
      productDraftId: request.productDraft.id,
      locale: request.locale ?? brandProfile.locale,
      channels: request.channels ?? brandProfile.channelPreferences,
      brandProfile,
      sourceMedia: sourceValidation.validSources,
      assets,
      warnings: [...warnings, ...sourceValidation.errors],
      createdAt: request.createdAt,
    };

    return {
      ...planWithoutQuality,
      qualityReport: this.qualityEvaluator.evaluatePlan(planWithoutQuality),
    };
  }

  private selectAssetTypes(
    draft: ProductDraft,
    requestedAssetTypes: readonly ProductMediaAssetType[],
    warnings: string[],
  ): readonly ProductMediaAssetType[] {
    const verifiedBenefits = this.hasVerifiedSignal(draft, BENEFIT_KEYWORDS);
    const verifiedIngredients = this.hasVerifiedSignal(draft, INGREDIENT_KEYWORDS);
    const verifiedUsage = this.hasVerifiedSignal(draft, USAGE_KEYWORDS);
    const selected: ProductMediaAssetType[] = [];

    for (const assetType of requestedAssetTypes) {
      if (assetType === "INGREDIENT_CARD" && !verifiedIngredients) {
        warnings.push("Ingredient card skipped because verified ingredient information is missing.");
        continue;
      }

      if (assetType === "HOW_TO_USE" && !verifiedUsage) {
        warnings.push("How-to-use asset skipped because verified usage instructions are missing.");
        continue;
      }

      if (assetType === "BENEFIT_CARD" && !verifiedBenefits) {
        warnings.push("Benefit card skipped because verified benefit language is missing.");
        continue;
      }

      selected.push(assetType);
    }

    return selected;
  }

  private toPlannedAsset(
    assetType: ProductMediaAssetType,
    draft: ProductDraft,
    brandProfile: ProductMediaBrandProfile,
    sourceMedia: readonly ProductMediaSource[],
    request: ProductMediaPlanRequest,
    inheritedWarnings: readonly string[],
  ): ProductMediaPlannedAsset {
    const defaultSpec = PRODUCT_MEDIA_DEFAULT_SPECIFICATIONS[assetType];
    const specification: ProductMediaSpecification = {
      ...defaultSpec,
      locale: request.locale ?? brandProfile.locale,
      sourceAssetIds: sourceMedia.map((source) => source.sourceAssetId),
    };
    const prompt = this.promptService.createPrompt({ draft, brandProfile, specification, assetType });

    return {
      id: `product-media-asset:${request.idGenerator()}`,
      assetType,
      purpose: specification.purpose,
      specification,
      prompt,
      altText: `${draft.title} ${specification.purpose}`.trim(),
      warnings: inheritedWarnings.filter((warning) => warning.toLowerCase().includes(assetType.toLowerCase())),
    };
  }

  private toBrandProfile(request: ProductMediaPlanRequest): ProductMediaBrandProfile {
    const draft = request.productDraft;
    const base: ProductMediaBrandProfile = {
      ...DEFAULT_BRAND_MEDIA_PROFILE,
      brandName: draft.branding?.brandName ?? draft.brand ?? DEFAULT_BRAND_MEDIA_PROFILE.brandName,
      targetAudience: draft.branding?.targetAudience.length ? draft.branding.targetAudience : DEFAULT_BRAND_MEDIA_PROFILE.targetAudience,
      locale: request.locale ?? request.brandProfile?.locale ?? DEFAULT_BRAND_MEDIA_PROFILE.locale,
    };

    return {
      ...base,
      ...request.brandProfile,
      visualIdentity: request.brandProfile?.visualIdentity ?? base.visualIdentity,
      preferredColorPalette: request.brandProfile?.preferredColorPalette ?? base.preferredColorPalette,
      mood: request.brandProfile?.mood ?? base.mood,
      backgroundPreferences: request.brandProfile?.backgroundPreferences ?? base.backgroundPreferences,
      prohibitedStyles: request.brandProfile?.prohibitedStyles ?? base.prohibitedStyles,
      targetAudience: request.brandProfile?.targetAudience ?? base.targetAudience,
      channelPreferences: request.brandProfile?.channelPreferences ?? base.channelPreferences,
    };
  }

  private sourcesFromDraft(draft: ProductDraft): readonly ProductMediaSource[] {
    return draft.images.map((image, index) => ({
      sourceAssetId: image.id ?? `${draft.id}:image:${index + 1}`,
      originalUrl: image.sourceUrl,
      contentType: "image/jpeg",
      ...(image.width === undefined ? {} : { width: image.width }),
      ...(image.height === undefined ? {} : { height: image.height }),
      licenseStatus: "unknown",
      sourcePlatform: draft.source.sourceType,
    }));
  }

  private hasVerifiedSignal(draft: ProductDraft, keywords: readonly string[]): boolean {
    const searchable = `${draft.title} ${draft.description} ${draft.tags.join(" ")} ${draft.branding?.valueProposition ?? ""}`.toLowerCase();

    return keywords.some((keyword) => searchable.includes(keyword));
  }
}
