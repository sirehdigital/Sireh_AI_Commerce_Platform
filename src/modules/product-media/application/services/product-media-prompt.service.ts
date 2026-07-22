import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type {
  ProductMediaAssetType,
  ProductMediaBrandProfile,
  ProductMediaPrompt,
  ProductMediaSpecification,
} from "../../domain/models/index.js";

const ANTI_HALLUCINATION_CONSTRAINTS = [
  "do not invent logos",
  "do not invent certifications",
  "do not invent ingredients",
  "do not invent medical claims",
  "do not invent packaging text",
  "do not change product colour without explicit instruction",
  "do not alter container shape where reference images exist",
  "do not imply before/after results",
  "do not create unsupported endorsements",
  "do not add copyrighted third-party branding",
  "do not claim clinically proven unless verified",
  "do not create deceptive product size or quantity impressions",
] as const;

export class ProductMediaPromptService {
  public createPrompt(input: {
    readonly draft: ProductDraft;
    readonly brandProfile: ProductMediaBrandProfile;
    readonly specification: ProductMediaSpecification;
    readonly assetType: ProductMediaAssetType;
  }): ProductMediaPrompt {
    const productIdentity = [
      input.draft.title,
      input.draft.productType,
      input.draft.branding?.brandName ?? input.draft.brand,
      input.draft.category ?? input.draft.branding?.collectionName,
    ].filter((value): value is string => value !== undefined && value.trim().length > 0);
    const sourceImageRequired = input.specification.sourceAssetIds.length > 0;
    const prompt = [
      `Create a ${input.specification.purpose} for ${productIdentity.join(", ")}.`,
      `Brand direction: ${input.brandProfile.brandName}; ${input.brandProfile.visualIdentity.join(", ")}.`,
      `Verified product context: ${input.draft.description}.`,
      `Mood: ${input.brandProfile.mood.join(", ")}.`,
      `Lighting: ${input.brandProfile.lightingDirection}.`,
      `Background: ${input.specification.backgroundRequirement}; preferred ${input.brandProfile.backgroundPreferences.join(", ")}.`,
      `Composition: ${input.specification.productPlacementGuidance}; ${input.specification.safeAreaGuidance}.`,
      `Aspect ratio ${input.specification.aspectRatio}, ${input.specification.width}x${input.specification.height}, target ${input.specification.targetChannel}.`,
      `Text overlay policy: ${input.specification.textOverlayPolicy}.`,
      sourceImageRequired ? "Use source/reference image to preserve product shape, packaging, and colour." : "No product reference image is available; preserve only verified product facts.",
    ].join(" ");

    return {
      assetType: input.assetType,
      prompt,
      negativePrompt: ANTI_HALLUCINATION_CONSTRAINTS.join("; "),
      constraints: [...ANTI_HALLUCINATION_CONSTRAINTS],
      sourceImageRequired,
    };
  }
}
