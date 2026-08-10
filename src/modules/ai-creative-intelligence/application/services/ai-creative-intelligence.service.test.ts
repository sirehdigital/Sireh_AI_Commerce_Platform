import { describe, expect, it } from "vitest";

import {
  AiCreativeIntelligenceService,
  CREATIVE_ANALYSIS_DIMENSIONS,
  CREATIVE_ANALYSIS_VERSION,
  CREATIVE_DIMENSION_WEIGHTS,
  CREATIVE_PLATFORMS,
  CREATIVE_SCORE_LABEL,
  CREATIVE_INTELLIGENCE_PIPELINE_VERSION,
  CreativeRecommendationEngine,
  CreativeAnalysisService,
  CreativeIntelligencePipelineService,
  CreativeIntelligenceInvalidLifecycleTransitionError,
  CreativeIntelligenceInvalidRequestError,
  CreativeIntelligenceInvalidTimestampError,
  CreativeIntelligenceMissingCreativeMaterialError,
  CreativeIntelligenceRecordNotFoundError,
  InMemoryCreativeIntelligenceRepository,
  PLATFORM_SUITABILITY_THRESHOLDS,
  PLATFORM_SUITABILITY_WEIGHTS,
  POLICY_RISK_CATEGORIES,
  type CreateCreativeIntelligenceRequest,
  type CreativeAnalysisDimension,
  type CreativeAnalysisResult,
  type CreativeIntelligencePipelineResult,
  type CreativePlatform,
  type CreativeIntelligenceRecord,
  type CreativeRecommendation,
  type CreativeRecommendationCategory,
  type PlatformSuitabilityFinding,
  type PolicyRiskCategory,
  type PolicyRiskFinding,
} from "../../index.js";
import * as publicExports from "../../../ai-creative-intelligence/index.js";

const REGISTERED_AT = "2026-08-10T02:30:00.000Z";

const buildRequest = (overrides: Partial<CreateCreativeIntelligenceRequest> = {}): CreateCreativeIntelligenceRequest => ({
  creativeId: "Creative Launch 001",
  productId: "product-100",
  sourceContentId: "content-200",
  assetType: "IMAGE",
  platforms: ["INSTAGRAM", "FACEBOOK"],
  targetMarkets: ["us", "GB"],
  brief: {
    hook: "Style faster before the morning rush",
    headline: "Velvet Glow Wand",
    primaryText: "A compact styling tool for polished daily routines.",
    callToAction: "Shop Now",
    visualConcept: "Warm vanity scene with the tool beside travel essentials.",
  },
  brandName: "Sireh Beauty",
  brandTone: "Confident and helpful",
  registeredAt: REGISTERED_AT,
  ...overrides,
});

const createRecord = async (request: CreateCreativeIntelligenceRequest = buildRequest()) => {
  const repository = new InMemoryCreativeIntelligenceRepository();
  return new AiCreativeIntelligenceService(repository).createCreativeIntelligence(request);
};

const withoutBrandContext = (request: CreateCreativeIntelligenceRequest): CreateCreativeIntelligenceRequest => ({
  creativeId: request.creativeId,
  productId: request.productId,
  ...(request.sourceContentId === undefined ? {} : { sourceContentId: request.sourceContentId }),
  assetType: request.assetType,
  platforms: [...request.platforms],
  targetMarkets: [...request.targetMarkets],
  brief: { ...request.brief },
  registeredAt: request.registeredAt,
});

const platformAssessmentFor = (analysis: CreativeAnalysisResult, platform: CreativePlatform) => analysis.platformSuitability?.find((assessment) => assessment.platform === platform);

const policyFindingFor = (analysis: CreativeAnalysisResult, category: PolicyRiskCategory) => analysis.policyRisk?.findings.find((finding) => finding.category === category);

const recommendationFor = (analysis: CreativeAnalysisResult, category: CreativeRecommendationCategory) =>
  analysis.recommendations?.find((recommendation) => recommendation.category === category);

describe("AiCreativeIntelligenceService", () => {
  it("creates a valid image creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "IMAGE", brief: { visualConcept: "Bright product flat lay", callToAction: "Shop Now" } }));

    expect(record.assetType).toBe("IMAGE");
    expect(record.brief.visualConcept).toBe("Bright product flat lay");
  });

  it("creates a valid video creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "VIDEO", brief: { hook: "Three seconds to smoother styling", visualConcept: "Creator demo" } }));

    expect(record.assetType).toBe("VIDEO");
    expect(record.brief.hook).toBe("Three seconds to smoother styling");
  });

  it("creates a valid carousel creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "CAROUSEL", brief: { hook: "One tool, three routines", headline: "Swipe the routine" } }));

    expect(record.assetType).toBe("CAROUSEL");
    expect(record.brief.headline).toBe("Swipe the routine");
  });

  it("creates a valid copy creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "COPY", brief: { headline: "Daily polish, packed small", primaryText: "Keep your routine simple." } }));

    expect(record.assetType).toBe("COPY");
    expect(record.brief.primaryText).toBe("Keep your routine simple.");
  });

  it("creates a valid mixed creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "MIXED", brief: { hook: "Pack light", visualConcept: "Travel pouch scene", callToAction: "Explore" } }));

    expect(record.assetType).toBe("MIXED");
    expect(record.brief.visualConcept).toBe("Travel pouch scene");
  });

  it("generates a stable deterministic ID", async () => {
    await expect(createRecord()).resolves.toMatchObject({ id: "creative-intelligence:creative-launch-001" });
  });

  it("returns the same logical ID for the same creative ID", async () => {
    const first = await createRecord(buildRequest({ creativeId: " Creative Launch 001 " }));
    const second = await createRecord(buildRequest({ creativeId: "creative---launch---001" }));

    expect(first.id).toBe(second.id);
  });

  it("returns different IDs for different creative IDs", async () => {
    const first = await createRecord(buildRequest({ creativeId: "creative-a" }));
    const second = await createRecord(buildRequest({ creativeId: "creative-b" }));

    expect(first.id).not.toBe(second.id);
  });

  it("rejects a missing creative ID", async () => {
    await expect(createRecord(buildRequest({ creativeId: undefined as unknown as string }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a blank creative ID", async () => {
    await expect(createRecord(buildRequest({ creativeId: " " }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a missing product ID", async () => {
    await expect(createRecord(buildRequest({ productId: undefined as unknown as string }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a blank product ID", async () => {
    await expect(createRecord(buildRequest({ productId: " " }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a missing platform list", async () => {
    await expect(createRecord(buildRequest({ platforms: undefined as unknown as CreateCreativeIntelligenceRequest["platforms"] }))).rejects.toThrow(
      CreativeIntelligenceInvalidRequestError,
    );
  });

  it("rejects an empty platform list", async () => {
    await expect(createRecord(buildRequest({ platforms: [] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("normalizes duplicate platforms", async () => {
    const record = await createRecord(buildRequest({ platforms: ["INSTAGRAM", "FACEBOOK", "INSTAGRAM"] }));

    expect(record.platforms).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });

  it("orders platforms deterministically", async () => {
    const record = await createRecord(buildRequest({ platforms: ["TIKTOK", "EMAIL", "FACEBOOK", "SHOPIFY"] }));

    expect(record.platforms).toEqual(["FACEBOOK", "TIKTOK", "SHOPIFY", "EMAIL"]);
  });

  it("rejects malformed platform values", async () => {
    await expect(createRecord(buildRequest({ platforms: ["INSTAGRAM", "X" as CreateCreativeIntelligenceRequest["platforms"][number]] }))).rejects.toThrow(
      CreativeIntelligenceInvalidRequestError,
    );
  });

  it("rejects a missing market list", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: undefined as unknown as string[] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects an empty market list", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: [] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("normalizes lowercase markets", async () => {
    const record = await createRecord(buildRequest({ targetMarkets: ["us", "gb"] }));

    expect(record.targetMarkets).toEqual(["GB", "US"]);
  });

  it("normalizes duplicate markets", async () => {
    const record = await createRecord(buildRequest({ targetMarkets: ["US", "us", "GB"] }));

    expect(record.targetMarkets).toEqual(["GB", "US"]);
  });

  it("orders markets deterministically", async () => {
    const record = await createRecord(buildRequest({ targetMarkets: ["CA", "us", "AU", "gb"] }));

    expect(record.targetMarkets).toEqual(["AU", "CA", "GB", "US"]);
  });

  it("rejects blank market codes", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: ["US", " "] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects malformed market codes", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: ["USA"] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects an invalid timestamp", async () => {
    await expect(createRecord(buildRequest({ registeredAt: "2026-08-10" }))).rejects.toThrow(CreativeIntelligenceInvalidTimestampError);
  });

  it("preserves a valid ISO timestamp", async () => {
    const record = await createRecord(buildRequest({ registeredAt: "2026-08-10T12:34:56.000Z" }));

    expect(record.registeredAt).toBe("2026-08-10T12:34:56.000Z");
  });

  it("rejects an empty brief", async () => {
    await expect(createRecord(buildRequest({ brief: {} }))).rejects.toThrow(CreativeIntelligenceMissingCreativeMaterialError);
  });

  it("rejects an all-blank brief", async () => {
    await expect(createRecord(buildRequest({ brief: { hook: " ", primaryText: " " } }))).rejects.toThrow(CreativeIntelligenceMissingCreativeMaterialError);
  });

  it("removes blank optional brief fields", async () => {
    const record = await createRecord(buildRequest({ brief: { hook: "  Fresh start  ", headline: " ", callToAction: "  Shop Now  " } }));

    expect(record.brief).toEqual({ hook: "Fresh start", callToAction: "Shop Now" });
  });

  it("preserves useful creative material after trimming", async () => {
    const record = await createRecord(buildRequest({ brief: { primaryText: "  Keep the look polished.  ", visualConcept: "  Clean bathroom shelf. " } }));

    expect(record.brief).toEqual({ primaryText: "Keep the look polished.", visualConcept: "Clean bathroom shelf." });
  });

  it("rejects non-object brief input", async () => {
    await expect(createRecord(buildRequest({ brief: null as unknown as CreateCreativeIntelligenceRequest["brief"] }))).rejects.toThrow(
      CreativeIntelligenceInvalidRequestError,
    );
  });

  it("rejects non-string brief fields", async () => {
    await expect(createRecord(buildRequest({ brief: { headline: 123 as unknown as string } }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects copy creatives without text material", async () => {
    await expect(createRecord(buildRequest({ assetType: "COPY", brief: { visualConcept: "Only a visual idea" } }))).rejects.toThrow(
      CreativeIntelligenceMissingCreativeMaterialError,
    );
  });

  it("defaults status to pending analysis", async () => {
    const record = await createRecord();

    expect(record.analysisStatus).toBe("PENDING_ANALYSIS");
  });

  it("sets the creative version", async () => {
    const record = await createRecord();

    expect(record.version).toBe("SACP-CREATIVE-v1");
  });

  it("warns when hook is absent where appropriate", async () => {
    const record = await createRecord(buildRequest({ assetType: "VIDEO", brief: { visualConcept: "Product demo", callToAction: "Shop Now" } }));

    expect(record.warnings).toContain("Creative hook is missing and should be reviewed before analysis.");
  });

  it("warns when CTA is absent", async () => {
    const record = await createRecord(buildRequest({ brief: { visualConcept: "Product flat lay" } }));

    expect(record.warnings).toContain("Call to action is missing and should be reviewed before analysis.");
  });

  it("keeps warning behavior deterministic", async () => {
    const request = buildRequest({ assetType: "MIXED", platforms: ["OTHER", "INSTAGRAM"], brief: { visualConcept: "Product flat lay" } });

    await expect(createRecord(request)).resolves.toMatchObject({ warnings: (await createRecord(request)).warnings });
  });

  it("warns when platform OTHER is selected", async () => {
    const record = await createRecord(buildRequest({ platforms: ["OTHER"] }));

    expect(record.warnings).toContain("Platform OTHER selected; platform requirements must be reviewed manually.");
  });

  it("does not mutate request input", async () => {
    const request = buildRequest();
    const before = structuredClone(request);

    await createRecord(request);

    expect(request).toEqual(before);
  });
});

describe("CreativeAnalysisService", () => {
  const createStoredRecord = async (request: CreateCreativeIntelligenceRequest = buildRequest()) => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const creationService = new AiCreativeIntelligenceService(repository);
    const analysisService = new CreativeAnalysisService(repository);
    const record = await creationService.createCreativeIntelligence(request);

    return { repository, analysisService, record };
  };

  const scoreFor = (record: CreativeIntelligenceRecord, dimension: CreativeAnalysisDimension) => {
    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);
    return analysis.dimensionScores[dimension];
  };

  it("analyzes a complete creative with all six dimension scores and weighted overall score", async () => {
    const { analysisService, record } = await createStoredRecord();

    const result = await analysisService.analyzeById(record.id);

    expect(result.analysis.dimensionScores).toEqual({
      HOOK: 90,
      HEADLINE: 90,
      PRIMARY_TEXT: 90,
      CTA: 90,
      VISUAL_CONCEPT: 90,
      BRAND_CONSISTENCY: 85,
    });
    expect(result.analysis.dimensions.map((dimension) => dimension.dimension)).toEqual(CREATIVE_ANALYSIS_DIMENSIONS);
    expect(result.analysis.overallScore).toBe(89);
    expect(result.analysis.metadata.scoreLabel).toBe(CREATIVE_SCORE_LABEL);
  });

  it("uses the documented central weights for the exact weighted score calculation", async () => {
    const { analysisService, record } = await createStoredRecord();

    const { analysis } = await analysisService.analyzeById(record.id);
    const weightedScore =
      (analysis.dimensionScores.HOOK * CREATIVE_DIMENSION_WEIGHTS.HOOK +
        analysis.dimensionScores.HEADLINE * CREATIVE_DIMENSION_WEIGHTS.HEADLINE +
        analysis.dimensionScores.PRIMARY_TEXT * CREATIVE_DIMENSION_WEIGHTS.PRIMARY_TEXT +
        analysis.dimensionScores.CTA * CREATIVE_DIMENSION_WEIGHTS.CTA +
        analysis.dimensionScores.VISUAL_CONCEPT * CREATIVE_DIMENSION_WEIGHTS.VISUAL_CONCEPT +
        analysis.dimensionScores.BRAND_CONSISTENCY * CREATIVE_DIMENSION_WEIGHTS.BRAND_CONSISTENCY) /
      100;

    expect(Object.values(CREATIVE_DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    expect(analysis.overallScore).toBe(Math.round(weightedScore));
  });

  it("keeps every score inside the 0 to 100 bounds", async () => {
    const { analysisService, record } = await createStoredRecord(
      buildRequest({
        brief: {
          hook: "SALE SALE SALE SALE SALE SALE SALE SALE SALE SALE SALE SALE SALE SALE SALE",
          headline: "BUY NOW!!!!",
          primaryText: "buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy buy",
          callToAction: "Click Here",
          visualConcept: "white background",
        },
        brandName: "Sireh Beauty",
        brandTone: "Helpful",
      }),
    );

    const { analysis } = await analysisService.analyzeById(record.id);
    const scores = [...Object.values(analysis.dimensionScores), analysis.overallScore];

    expect(scores.every((score) => score >= 0)).toBe(true);
    expect(scores.every((score) => score <= 100)).toBe(true);
  });

  it("produces deterministic scores, finding codes, finding order, strengths, and improvements", async () => {
    const { analysisService, record } = await createStoredRecord();

    const first = analysisService.analyzePreview(record);
    const second = analysisService.analyzePreview(record);

    expect(second.dimensionScores).toEqual(first.dimensionScores);
    expect(second.overallScore).toBe(first.overallScore);
    expect(second.findings.map((finding) => finding.code)).toEqual(first.findings.map((finding) => finding.code));
    expect(second.strengths).toEqual(first.strengths);
    expect(second.improvementOpportunities).toEqual(first.improvementOpportunities);
  });

  it("scores hook presence and hook absence deterministically", async () => {
    const present = await createRecord(buildRequest({ brief: { hook: "Fresh style in five minutes", visualConcept: "Bathroom counter product setup" } }));
    const missing = await createRecord(buildRequest({ brief: { visualConcept: "Bathroom counter product setup" } }));

    expect(scoreFor(present, "HOOK")).toBe(90);
    expect(scoreFor(missing, "HOOK")).toBe(35);
  });

  it("scores headline presence and headline absence deterministically", async () => {
    const present = await createRecord(buildRequest({ brief: { headline: "Fast Morning Polish", visualConcept: "Bathroom counter product setup" } }));
    const missing = await createRecord(buildRequest({ brief: { visualConcept: "Bathroom counter product setup" } }));

    expect(scoreFor(present, "HEADLINE")).toBe(90);
    expect(scoreFor(missing, "HEADLINE")).toBe(35);
  });

  it("scores complete and minimal primary text deterministically", async () => {
    const complete = await createRecord(
      buildRequest({ brief: { primaryText: "A compact styling tool helps keep daily routines polished and simple.", visualConcept: "Bathroom counter product setup" } }),
    );
    const minimal = await createRecord(buildRequest({ brief: { primaryText: "Polished.", visualConcept: "Bathroom counter product setup" } }));

    expect(scoreFor(complete, "PRIMARY_TEXT")).toBe(90);
    expect(scoreFor(minimal, "PRIMARY_TEXT")).toBe(52);
  });

  it("scores CTA presence and CTA absence deterministically", async () => {
    const present = await createRecord(buildRequest({ brief: { callToAction: "Shop Now", visualConcept: "Bathroom counter product setup" } }));
    const missing = await createRecord(buildRequest({ brief: { visualConcept: "Bathroom counter product setup" } }));

    expect(scoreFor(present, "CTA")).toBe(90);
    expect(scoreFor(missing, "CTA")).toBe(30);
  });

  it("scores visual concept presence and absence without image inspection", async () => {
    const present = await createRecord(
      buildRequest({ brief: { visualConcept: "Warm vanity scene with product beside travel essentials" } }),
    );
    const missing = await createRecord(buildRequest({ brief: { hook: "Fresh style in five minutes" } }));

    expect(scoreFor(present, "VISUAL_CONCEPT")).toBe(90);
    expect(scoreFor(missing, "VISUAL_CONCEPT")).toBe(35);
  });

  it("scores available and limited brand context without inventing a brand kit", async () => {
    const available = await createRecord(buildRequest({ brandName: "Sireh Beauty", brandTone: "Helpful polished", brief: { primaryText: "Helpful polished routines made simple." } }));
    const limitedRequest = withoutBrandContext(buildRequest({ brief: { visualConcept: "Bathroom counter product setup" } }));
    const limited = await createRecord(limitedRequest);

    expect(scoreFor(available, "BRAND_CONSISTENCY")).toBe(90);
    expect(scoreFor(limited, "BRAND_CONSISTENCY")).toBe(55);
  });

  it("keeps valid but incomplete creative records analyzable", async () => {
    const request = withoutBrandContext(buildRequest({
      brief: {
        visualConcept: "Studio shot",
      },
    }));
    const { analysisService, record } = await createStoredRecord(
      request,
    );

    const { analysis } = await analysisService.analyzeById(record.id);

    expect(analysis.dimensionScores).toEqual({
      HOOK: 35,
      HEADLINE: 35,
      PRIMARY_TEXT: 35,
      CTA: 30,
      VISUAL_CONCEPT: 55,
      BRAND_CONSISTENCY: 55,
    });
    expect(analysis.overallScore).toBe(40);
  });

  it("continues to reject malformed creation input before analysis", async () => {
    await expect(createRecord(buildRequest({ brief: null as unknown as CreateCreativeIntelligenceRequest["brief"] }))).rejects.toThrow(
      CreativeIntelligenceInvalidRequestError,
    );
  });

  it("rejects blank analysis lookup input and missing records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const analysisService = new CreativeAnalysisService(repository);

    await expect(analysisService.analyzeById(" ")).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
    await expect(analysisService.analyzeById("missing")).rejects.toThrow(CreativeIntelligenceRecordNotFoundError);
  });

  it("emits deterministic finding codes and categories", async () => {
    const request = withoutBrandContext(buildRequest({
      brief: {
        hook: "Fresh start",
        headline: "FRESH START!!",
        primaryText: "simple simple simple",
        callToAction: "Learn More",
        visualConcept: "Studio shot",
      },
    }));
    const { analysisService, record } = await createStoredRecord(
      request,
    );

    const { analysis } = await analysisService.analyzeById(record.id);

    expect(analysis.findings.map((finding) => finding.code)).toEqual([
      "HOOK_PRESENT",
      "HOOK_TOO_SHORT",
      "HEADLINE_PRESENT",
      "HEADLINE_USEFUL_LENGTH",
      "HEADLINE_EXCESSIVE_PUNCTUATION",
      "HEADLINE_ALL_UPPERCASE",
      "HEADLINE_DUPLICATES_HOOK",
      "PRIMARY_TEXT_PRESENT",
      "PRIMARY_TEXT_TOO_SHORT",
      "PRIMARY_TEXT_REPETITIVE",
      "CTA_PRESENT",
      "CTA_ACTION_LANGUAGE",
      "CTA_TOO_VAGUE",
      "VISUAL_CONCEPT_PRESENT",
      "VISUAL_CONCEPT_TOO_THIN",
      "BRAND_CONTEXT_LIMITED",
      "BRAND_CONTEXT_ADD_NAME_OR_TONE",
    ]);
    expect(new Set(analysis.findings.map((finding) => finding.type))).toEqual(new Set(["STRENGTH", "WARNING", "IMPROVEMENT"]));
  });

  it("sets analysis version and transitions lifecycle from pending analysis to analyzed", async () => {
    const { analysisService, repository, record } = await createStoredRecord();

    expect(record.analysisStatus).toBe("PENDING_ANALYSIS");
    const result = await analysisService.analyzeByCreativeId(record.creativeId);

    expect(result.analysis.analysisVersion).toBe(CREATIVE_ANALYSIS_VERSION);
    expect(result.record.analysisStatus).toBe("ANALYZED");
    expect((await repository.findById(record.id))?.analysisStatus).toBe("ANALYZED");
  });

  it("rejects persisted analysis when the record is not pending analysis", async () => {
    const { analysisService, repository, record } = await createStoredRecord();

    await analysisService.analyzeById(record.id);

    await expect(analysisService.analyzeById(record.id)).rejects.toThrow(CreativeIntelligenceInvalidLifecycleTransitionError);
    const stored = await repository.findById(record.id);
    expect(stored?.analysisStatus).toBe("ANALYZED");
    expect(stored?.analysis?.analysisVersion).toBe(CREATIVE_ANALYSIS_VERSION);
  });

  it("keeps preview analysis strictly non-persistent", async () => {
    const { analysisService, repository, record } = await createStoredRecord();

    const preview = analysisService.analyzePreview(record);
    (preview.findings as (typeof preview.findings)[number][]).push({
      dimension: "HOOK",
      type: "WARNING",
      code: "INJECTED_PREVIEW",
      message: "Injected preview mutation",
      impact: "HIGH",
    });
    (preview.dimensions[0]?.strengths as string[]).push("Injected preview strength");

    const stored = await repository.findById(record.id);

    expect(preview.analysisVersion).toBe(CREATIVE_ANALYSIS_VERSION);
    expect(stored).toEqual(record);
    expect(stored?.analysisStatus).toBe("PENDING_ANALYSIS");
    expect(stored?.analysis).toBeUndefined();
    expect(stored?.id).toBe(record.id);
    expect(stored?.creativeId).toBe(record.creativeId);
    expect(stored?.productId).toBe(record.productId);
    expect(stored?.sourceContentId).toBe(record.sourceContentId);
    expect(stored?.platforms).toEqual(record.platforms);
    expect(stored?.targetMarkets).toEqual(record.targetMarkets);
  });

  it("assesses suitability for all supported platforms with deterministic scores", async () => {
    const { analysisService, record } = await createStoredRecord();

    const { analysis } = await analysisService.analyzeById(record.id);

    expect(analysis.platformSuitability?.map((assessment) => assessment.platform)).toEqual(CREATIVE_PLATFORMS);
    expect(analysis.platformSuitability?.map((assessment) => [assessment.platform, assessment.score, assessment.status])).toEqual([
      ["FACEBOOK", 90, "SUITABLE"],
      ["INSTAGRAM", 89, "SUITABLE"],
      ["THREADS", 90, "SUITABLE"],
      ["TIKTOK", 90, "SUITABLE"],
      ["SHOPIFY", 89, "SUITABLE"],
      ["EMAIL", 89, "SUITABLE"],
      ["OTHER", 89, "SUITABLE"],
    ]);
  });

  it("keeps platform scores bounded and weights centralized at 100 per platform", async () => {
    const { analysisService, record } = await createStoredRecord();

    const { analysis } = await analysisService.analyzeById(record.id);

    expect(analysis.platformSuitability?.every((assessment) => assessment.score >= 0 && assessment.score <= 100)).toBe(true);
    expect(Object.values(PLATFORM_SUITABILITY_WEIGHTS).every((weights) => Object.values(weights).reduce((sum, weight) => sum + weight, 0) === 100)).toBe(true);
    expect(PLATFORM_SUITABILITY_THRESHOLDS).toEqual({ suitable: 80, needsReview: 60 });
  });

  it("derives suitable, needs-review, and not-recommended statuses from thresholds", async () => {
    const suitable = await createRecord();
    const needsReview = await createRecord(
      buildRequest({
        brief: {
          hook: "Fresh style in five minutes",
          headline: "Fast Morning Polish",
          primaryText: "A compact styling tool helps keep daily routines polished and simple.",
          visualConcept: "Warm vanity scene with product beside travel essentials",
        },
      }),
    );
    const notRecommended = await createRecord(withoutBrandContext(buildRequest({ brief: { visualConcept: "Studio shot" } })));
    const analysisService = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository());

    expect(platformAssessmentFor(analysisService.analyzePreview(suitable), "FACEBOOK")?.status).toBe("SUITABLE");
    expect(platformAssessmentFor(analysisService.analyzePreview(needsReview), "FACEBOOK")?.status).toBe("NEEDS_REVIEW");
    expect(platformAssessmentFor(analysisService.analyzePreview(notRecommended), "FACEBOOK")?.status).toBe("NOT_RECOMMENDED");
  });

  it("uses platform-specific weighting behavior", async () => {
    const record = await createRecord();
    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(PLATFORM_SUITABILITY_WEIGHTS.FACEBOOK).toMatchObject({ PRIMARY_TEXT: 25, CTA: 20 });
    expect(PLATFORM_SUITABILITY_WEIGHTS.INSTAGRAM).toMatchObject({ VISUAL_CONCEPT: 35, BRAND_CONSISTENCY: 20 });
    expect(PLATFORM_SUITABILITY_WEIGHTS.THREADS).toMatchObject({ PRIMARY_TEXT: 35, VISUAL_CONCEPT: 5 });
    expect(PLATFORM_SUITABILITY_WEIGHTS.TIKTOK).toMatchObject({ HOOK: 30, VISUAL_CONCEPT: 30 });
    expect(PLATFORM_SUITABILITY_WEIGHTS.SHOPIFY).toMatchObject({ HEADLINE: 25, PRIMARY_TEXT: 25, BRAND_CONSISTENCY: 20 });
    expect(PLATFORM_SUITABILITY_WEIGHTS.EMAIL).toMatchObject({ HEADLINE: 30, CTA: 25, VISUAL_CONCEPT: 0 });
    expect(PLATFORM_SUITABILITY_WEIGHTS.OTHER).toMatchObject({ HOOK: 15, VISUAL_CONCEPT: 20 });
    expect(platformAssessmentFor(analysis, "FACEBOOK")?.findings.map((finding) => finding.code)).toEqual(["FACEBOOK_STRUCTURAL_STRENGTHS_PRESENT"]);
  });

  it("keeps platform suitability deterministic for equivalent repeated input", async () => {
    const record = await createRecord();
    const analysisService = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository());

    const first = analysisService.analyzePreview(record);
    const second = analysisService.analyzePreview(record);

    expect(second.platformSuitability).toEqual(first.platformSuitability);
    expect(second.platformSuitability?.flatMap((assessment) => assessment.findings.map((finding) => finding.code))).toEqual(
      first.platformSuitability?.flatMap((assessment) => assessment.findings.map((finding) => finding.code)),
    );
  });

  it("returns low policy risk for ordinary creative and does not treat ordinary CTA as deceptive urgency", async () => {
    const record = await createRecord(buildRequest({ brief: { callToAction: "Shop Now", visualConcept: "Bathroom counter product setup" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(analysis.policyRisk).toEqual({ overallRisk: "LOW", requiresHumanReview: false, findings: [] });
  });

  it("detects unsupported claim, medical claim, and guaranteed outcome risk", async () => {
    const record = await createRecord(
      buildRequest({
        brief: {
          headline: "Clinically Proven Tool",
          primaryText: "This is clinically proven and scientifically proven with guaranteed results.",
          visualConcept: "Bathroom counter product setup",
        },
      }),
    );

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(policyFindingFor(analysis, "UNSUPPORTED_CLAIM")?.code).toBe("UNSUPPORTED_CLAIM_PROVEN");
    expect(policyFindingFor(analysis, "MEDICAL_OR_CLINICAL_CLAIM")?.severity).toBe("CRITICAL");
    expect(policyFindingFor(analysis, "GUARANTEED_OUTCOME")?.severity).toBe("HIGH");
    expect(analysis.policyRisk?.overallRisk).toBe("CRITICAL");
    expect(analysis.policyRisk?.requiresHumanReview).toBe(true);
  });

  it("detects fabricated social proof, body shaming, and insecurity exploitation", async () => {
    const record = await createRecord(
      buildRequest({
        brief: {
          headline: "Five-star reviews everywhere",
          primaryText: "Thousands of happy customers use this. Stop being ashamed and fix your body.",
          visualConcept: "Bathroom counter product setup",
        },
      }),
    );

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(policyFindingFor(analysis, "FABRICATED_SOCIAL_PROOF")?.code).toBe("FABRICATED_SOCIAL_PROOF_RISK");
    expect(policyFindingFor(analysis, "BODY_SHAMING")?.severity).toBe("CRITICAL");
    expect(policyFindingFor(analysis, "INSECURITY_EXPLOITATION")?.severity).toBe("HIGH");
    expect(analysis.policyRisk?.overallRisk).toBe("CRITICAL");
  });

  it("detects sensitive attribute inference and deceptive urgency", async () => {
    const record = await createRecord(
      buildRequest({
        brief: {
          primaryText: "Because you are pregnant, act now or lose everything.",
          callToAction: "Explore",
          visualConcept: "Bathroom counter product setup",
        },
      }),
    );

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(policyFindingFor(analysis, "SENSITIVE_ATTRIBUTE_INFERENCE")?.code).toBe("SENSITIVE_ATTRIBUTE_INFERENCE_TEXT");
    expect(policyFindingFor(analysis, "DECEPTIVE_URGENCY")?.severity).toBe("MEDIUM");
    expect(analysis.policyRisk?.overallRisk).toBe("HIGH");
    expect(analysis.policyRisk?.requiresHumanReview).toBe(true);
  });

  it("keeps policy risk finding order and stable categories deterministic", async () => {
    const record = await createRecord(
      buildRequest({
        brief: {
          primaryText: "Scientifically proven and clinically proven with guaranteed results. Thousands of happy customers. You will regret missing this.",
          visualConcept: "Bathroom counter product setup",
        },
      }),
    );
    const analysisService = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository());

    const first = analysisService.analyzePreview(record);
    const second = analysisService.analyzePreview(record);

    expect(first.policyRisk?.findings.map((finding) => finding.code)).toEqual([
      "UNSUPPORTED_CLAIM_PROVEN",
      "MEDICAL_OR_CLINICAL_CLAIM_DETECTED",
      "GUARANTEED_OUTCOME_PROMISE",
      "FABRICATED_SOCIAL_PROOF_RISK",
      "DECEPTIVE_URGENCY_PRESSURE",
    ]);
    expect(second.policyRisk?.findings).toEqual(first.policyRisk?.findings);
    expect(POLICY_RISK_CATEGORIES).toContain("OTHER");
  });

  it("keeps 04.03B quality analysis intact while adding 04.03C assessments", async () => {
    const { analysisService, record } = await createStoredRecord();

    const { analysis, record: analyzedRecord } = await analysisService.analyzeById(record.id);

    expect(analysis.overallScore).toBe(89);
    expect(analysis.dimensionScores.HOOK).toBe(90);
    expect(analysis.platformSuitability).toHaveLength(7);
    expect(analysis.policyRisk?.overallRisk).toBe("LOW");
    expect(analyzedRecord.id).toBe(record.id);
    expect(analyzedRecord.productId).toBe(record.productId);
    expect(analyzedRecord.sourceContentId).toBe(record.sourceContentId);
    expect(analyzedRecord.platforms).toEqual(record.platforms);
    expect(analyzedRecord.targetMarkets).toEqual(record.targetMarkets);
  });

  it("recommends hook improvement from a low hook score", async () => {
    const record = await createRecord(buildRequest({ brief: { headline: "Fast Morning Polish", primaryText: "A compact styling tool helps daily routines.", callToAction: "Shop Now" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(recommendationFor(analysis, "IMPROVE_HOOK")).toMatchObject({
      code: "REC_IMPROVE_HOOK",
      priority: "HIGH",
      dimension: "HOOK",
      advisoryOnly: true,
    });
  });

  it("recommends headline improvement from a low headline score", async () => {
    const record = await createRecord(buildRequest({ brief: { hook: "Style faster before the morning rush", primaryText: "A compact styling tool helps daily routines.", callToAction: "Shop Now" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(recommendationFor(analysis, "IMPROVE_HEADLINE")).toMatchObject({
      code: "REC_IMPROVE_HEADLINE",
      priority: "HIGH",
      dimension: "HEADLINE",
    });
  });

  it("recommends CTA improvement from a weak CTA score", async () => {
    const record = await createRecord(buildRequest({ brief: { callToAction: "Details", visualConcept: "Warm vanity scene with product beside travel essentials" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(recommendationFor(analysis, "IMPROVE_CTA")).toMatchObject({
      code: "REC_IMPROVE_CTA",
      priority: "MEDIUM",
      dimension: "CTA",
    });
  });

  it("recommends visual concept improvement from weak visual readiness", async () => {
    const record = await createRecord(buildRequest({ brief: { hook: "Style faster before the morning rush", headline: "Fast Morning Polish", primaryText: "A compact styling tool helps daily routines.", callToAction: "Shop Now" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(recommendationFor(analysis, "IMPROVE_VISUAL_CONCEPT")).toMatchObject({
      code: "REC_IMPROVE_VISUAL_CONCEPT",
      priority: "HIGH",
      dimension: "VISUAL_CONCEPT",
    });
  });

  it("recommends brand consistency improvement when brand context is limited", async () => {
    const record = await createRecord(withoutBrandContext(buildRequest()));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(recommendationFor(analysis, "IMPROVE_BRAND_CONSISTENCY")).toMatchObject({
      code: "REC_IMPROVE_BRAND_CONSISTENCY",
      priority: "MEDIUM",
      dimension: "BRAND_CONSISTENCY",
    });
  });

  it("recommends platform adaptation for platform suitability review states", async () => {
    const record = await createRecord(
      buildRequest({
        brief: {
          hook: "Fresh style in five minutes",
          headline: "Fast Morning Polish",
          primaryText: "A compact styling tool helps keep daily routines polished and simple.",
          visualConcept: "Warm vanity scene with product beside travel essentials",
        },
      }),
    );

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);
    const recommendation = analysis.recommendations?.find((entry) => entry.code === "REC_PLATFORM_ADAPTATION_FACEBOOK");

    expect(platformAssessmentFor(analysis, "FACEBOOK")?.status).toBe("NEEDS_REVIEW");
    expect(recommendation).toMatchObject({
      category: "PLATFORM_ADAPTATION",
      priority: "MEDIUM",
      platform: "FACEBOOK",
      advisoryOnly: true,
    });
  });

  it("recommends high-priority policy review for high policy risk", async () => {
    const record = await createRecord(buildRequest({ brief: { primaryText: "Scientifically proven with guaranteed results.", visualConcept: "Bathroom counter product setup" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);
    const recommendation = analysis.recommendations?.find((entry) => entry.code === "REC_POLICY_RISK_UNSUPPORTED_CLAIM_PROVEN");

    expect(recommendation).toMatchObject({
      category: "POLICY_RISK_REVIEW",
      priority: "HIGH",
      riskCategory: "UNSUPPORTED_CLAIM",
      riskSeverity: "HIGH",
    });
  });

  it("recommends critical policy review for critical policy risk", async () => {
    const record = await createRecord(buildRequest({ brief: { headline: "Clinically Proven Tool", primaryText: "This is clinically proven.", visualConcept: "Bathroom counter product setup" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);
    const recommendation = analysis.recommendations?.find((entry) => entry.code === "REC_POLICY_RISK_MEDICAL_OR_CLINICAL_CLAIM_DETECTED");

    expect(recommendation).toMatchObject({
      category: "POLICY_RISK_REVIEW",
      priority: "CRITICAL",
      riskCategory: "MEDICAL_OR_CLINICAL_CLAIM",
      riskSeverity: "CRITICAL",
    });
  });

  it("adds a human review recommendation when policy risk requires review", async () => {
    const record = await createRecord(buildRequest({ brief: { primaryText: "This is scientifically proven.", visualConcept: "Bathroom counter product setup" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(recommendationFor(analysis, "HUMAN_REVIEW_REQUIRED")).toMatchObject({
      code: "REC_HUMAN_REVIEW_REQUIRED",
      priority: "HIGH",
      riskSeverity: "HIGH",
    });
  });

  it("does not add unnecessary recommendations for strong low-risk creative", async () => {
    const record = await createRecord();

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(analysis.recommendations).toEqual([]);
  });

  it("deduplicates recommendations by stable code", async () => {
    const record = await createRecord(buildRequest({ brief: { hook: "Rush", visualConcept: "Scene" } }));

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);
    const codes = analysis.recommendations?.map((recommendation) => recommendation.code) ?? [];

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.filter((code) => code === "REC_IMPROVE_HOOK")).toHaveLength(1);
  });

  it("keeps recommendation order deterministic by source analysis order", async () => {
    const record = await createRecord(
      buildRequest({
        brief: {
          primaryText: "Scientifically proven and clinically proven with guaranteed results.",
          visualConcept: "Scene",
        },
      }),
    );

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(analysis.recommendations?.map((recommendation) => recommendation.code)).toEqual([
      "REC_IMPROVE_HOOK",
      "REC_IMPROVE_HEADLINE",
      "REC_IMPROVE_CTA",
      "REC_IMPROVE_VISUAL_CONCEPT",
      "REC_PLATFORM_ADAPTATION_FACEBOOK",
      "REC_PLATFORM_ADAPTATION_INSTAGRAM",
      "REC_PLATFORM_ADAPTATION_THREADS",
      "REC_PLATFORM_ADAPTATION_TIKTOK",
      "REC_PLATFORM_ADAPTATION_SHOPIFY",
      "REC_PLATFORM_ADAPTATION_EMAIL",
      "REC_PLATFORM_ADAPTATION_OTHER",
      "REC_POLICY_RISK_UNSUPPORTED_CLAIM_PROVEN",
      "REC_POLICY_RISK_MEDICAL_OR_CLINICAL_CLAIM_DETECTED",
      "REC_POLICY_RISK_GUARANTEED_OUTCOME_PROMISE",
      "REC_HUMAN_REVIEW_REQUIRED",
    ]);
  });

  it("keeps recommendation output deterministic for repeated input", async () => {
    const record = await createRecord(buildRequest({ brief: { primaryText: "Scientifically proven with guaranteed results.", visualConcept: "Scene" } }));
    const analysisService = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository());

    const first = analysisService.analyzePreview(record);
    const second = analysisService.analyzePreview(record);

    expect(second.recommendations).toEqual(first.recommendations);
  });

  it("maps recommendation priorities from dimension, platform, and policy severity", async () => {
    const record = await createRecord(
      buildRequest({
        brief: {
          headline: "Daily Polish",
          primaryText: "Scientifically proven with guaranteed results.",
          visualConcept: "Scene",
        },
      }),
    );

    const analysis = new CreativeAnalysisService(new InMemoryCreativeIntelligenceRepository()).analyzePreview(record);

    expect(analysis.recommendations?.find((recommendation) => recommendation.code === "REC_IMPROVE_HOOK")?.priority).toBe("HIGH");
    expect(analysis.recommendations?.find((recommendation) => recommendation.code === "REC_IMPROVE_VISUAL_CONCEPT")?.priority).toBe("MEDIUM");
    expect(analysis.recommendations?.find((recommendation) => recommendation.code === "REC_PLATFORM_ADAPTATION_FACEBOOK")?.priority).toBe("HIGH");
    expect(analysis.recommendations?.find((recommendation) => recommendation.code === "REC_POLICY_RISK_UNSUPPORTED_CLAIM_PROVEN")?.priority).toBe("HIGH");
  });

  it("preserves identity and associations while adding recommendations", async () => {
    const { analysisService, record } = await createStoredRecord(buildRequest({ brief: { hook: "Rush", visualConcept: "Scene" } }));

    const result = await analysisService.analyzeById(record.id);

    expect(result.analysis.recommendations?.length).toBeGreaterThan(0);
    expect(result.record.id).toBe(record.id);
    expect(result.record.creativeId).toBe(record.creativeId);
    expect(result.record.productId).toBe(record.productId);
    expect(result.record.sourceContentId).toBe(record.sourceContentId);
    expect(result.record.platforms).toEqual(record.platforms);
    expect(result.record.targetMarkets).toEqual(record.targetMarkets);
  });

  it("defensively copies platform suitability and policy risk structures", async () => {
    const { analysisService, repository, record } = await createStoredRecord(
      buildRequest({ brief: { primaryText: "Scientifically proven with guaranteed results.", visualConcept: "Bathroom counter product setup" } }),
    );

    const result = await analysisService.analyzeById(record.id);
    (result.analysis.platformSuitability?.[0]?.findings as PlatformSuitabilityFinding[]).push({
      platform: "FACEBOOK",
      code: "INJECTED_PLATFORM",
      message: "Injected platform mutation",
      evidence: [],
    });
    (result.analysis.policyRisk?.findings as PolicyRiskFinding[]).push({
      category: "OTHER",
      severity: "CRITICAL",
      code: "INJECTED_POLICY",
      message: "Injected policy mutation",
      evidence: "Injected",
    });
    (result.analysis.recommendations as CreativeRecommendation[]).push({
      code: "INJECTED_RECOMMENDATION",
      category: "POLICY_RISK_REVIEW",
      priority: "CRITICAL",
      reason: "Injected recommendation mutation",
      recommendedAction: "Injected action",
      evidence: ["INJECTED_POLICY"],
      advisoryOnly: true,
    });
    (result.analysis.recommendations?.[0]?.evidence as string[]).push("INJECTED_EVIDENCE");

    const stored = await repository.findById(record.id);

    expect(stored?.analysis?.platformSuitability?.[0]?.findings.map((finding) => finding.code)).not.toContain("INJECTED_PLATFORM");
    expect(stored?.analysis?.policyRisk?.findings.map((finding) => finding.code)).not.toContain("INJECTED_POLICY");
    expect(stored?.analysis?.recommendations?.map((recommendation) => recommendation.code)).not.toContain("INJECTED_RECOMMENDATION");
    expect(stored?.analysis?.recommendations?.[0]?.evidence).not.toContain("INJECTED_EVIDENCE");
  });

  it("preserves canonical identity and commerce associations during analysis", async () => {
    const { analysisService, record } = await createStoredRecord();

    const result = await analysisService.analyzeById(record.id);

    expect(result.record.id).toBe(record.id);
    expect(result.record.creativeId).toBe(record.creativeId);
    expect(result.record.productId).toBe(record.productId);
    expect(result.record.sourceContentId).toBe(record.sourceContentId);
    expect(result.record.platforms).toEqual(record.platforms);
    expect(result.record.targetMarkets).toEqual(record.targetMarkets);
  });

  it("defensively copies analysis results through service and repository boundaries", async () => {
    const { analysisService, repository, record } = await createStoredRecord();

    const result = await analysisService.analyzeById(record.id);
    (result.analysis.findings as (typeof result.analysis.findings)[number][]).push({
      dimension: "HOOK",
      type: "WARNING",
      code: "INJECTED",
      message: "Injected mutation",
      impact: "HIGH",
    });
    (result.record.analysis?.dimensions[0]?.strengths as string[]).push("Injected strength");

    const stored = await repository.findById(record.id);

    expect(stored?.analysis?.findings.map((finding) => finding.code)).not.toContain("INJECTED");
    expect(stored?.analysis?.dimensions[0]?.strengths).not.toContain("Injected strength");
  });

  it("exports the public analysis API", () => {
    expect(publicExports.CreativeAnalysisService).toBe(CreativeAnalysisService);
    expect(publicExports.CREATIVE_ANALYSIS_VERSION).toBe(CREATIVE_ANALYSIS_VERSION);
    expect(publicExports.CREATIVE_DIMENSION_WEIGHTS.HOOK).toBe(20);
    expect(publicExports.PLATFORM_SUITABILITY_WEIGHTS.FACEBOOK.HOOK).toBe(20);
    expect(publicExports.POLICY_RISK_CATEGORIES).toContain("UNSUPPORTED_CLAIM");
    expect(publicExports.CreativeRecommendationEngine).toBe(CreativeRecommendationEngine);
    expect(publicExports.CREATIVE_RECOMMENDATION_CATEGORIES).toContain("POLICY_RISK_REVIEW");
    expect(publicExports.CREATIVE_RECOMMENDATION_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });
});

describe("CreativeIntelligencePipelineService", () => {
  const createPipelineFixture = async (request: CreateCreativeIntelligenceRequest = buildRequest()) => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const creationService = new AiCreativeIntelligenceService(repository);
    const pipelineService = new CreativeIntelligencePipelineService(repository);
    const record = await creationService.createCreativeIntelligence(request);

    return { repository, pipelineService, record };
  };

  it("runs the complete persisted creative intelligence pipeline end to end", async () => {
    const { pipelineService, record } = await createPipelineFixture();

    const result = await pipelineService.runById(record.id);

    expect(result).toMatchObject({
      creativeIntelligenceId: record.id,
      creativeId: record.creativeId,
      productId: record.productId,
      sourceContentId: record.sourceContentId,
      status: "ANALYZED",
      versionMetadata: {
        pipelineVersion: CREATIVE_INTELLIGENCE_PIPELINE_VERSION,
        analysisVersion: CREATIVE_ANALYSIS_VERSION,
        sourceRecordVersion: "SACP-CREATIVE-v1",
      },
      governance: {
        advisoryOnly: true,
        providerIndependent: true,
        noPublishing: true,
        humanReviewRequired: false,
      },
    });
  });

  it("returns all 04.03A-D outputs in the final result", async () => {
    const { pipelineService, record } = await createPipelineFixture(
      buildRequest({ brief: { primaryText: "Scientifically proven with guaranteed results.", visualConcept: "Scene" } }),
    );

    const result = await pipelineService.runById(record.id);

    expect(result.creativeQuality.overallScore).toBeGreaterThan(0);
    expect(result.creativeQuality.dimensions).toHaveLength(6);
    expect(result.platformSuitability).toHaveLength(7);
    expect(result.policyRisk.overallRisk).toBe("HIGH");
    expect(result.recommendations.map((recommendation) => recommendation.code)).toContain("REC_HUMAN_REVIEW_REQUIRED");
  });

  it("keeps repeated equivalent preview output deterministic", async () => {
    const record = await createRecord(buildRequest({ brief: { primaryText: "Scientifically proven with guaranteed results.", visualConcept: "Scene" } }));
    const pipelineService = new CreativeIntelligencePipelineService(new InMemoryCreativeIntelligenceRepository());

    const first = pipelineService.runPreview(record);
    const second = pipelineService.runPreview(record);

    expect(second.creativeQuality.dimensionScores).toEqual(first.creativeQuality.dimensionScores);
    expect(second.platformSuitability).toEqual(first.platformSuitability);
    expect(second.policyRisk).toEqual(first.policyRisk);
    expect(second.recommendations).toEqual(first.recommendations);
  });

  it("preserves canonical identity and commerce associations", async () => {
    const { pipelineService, record } = await createPipelineFixture(buildRequest({ platforms: ["TIKTOK", "EMAIL", "FACEBOOK"], targetMarkets: ["MY", "us"] }));

    const result = await pipelineService.runById(record.id);

    expect(result.creativeIntelligenceId).toBe(record.id);
    expect(result.creativeId).toBe(record.creativeId);
    expect(result.productId).toBe(record.productId);
    expect(result.sourceContentId).toBe(record.sourceContentId);
    expect(result.platforms).toEqual(record.platforms);
    expect(result.targetMarkets).toEqual(record.targetMarkets);
  });

  it("keeps quality, suitability, policy risk, recommendations, and advisory metadata intact", async () => {
    const { pipelineService, record } = await createPipelineFixture(
      buildRequest({ brief: { headline: "Clinically Proven Tool", primaryText: "This is clinically proven.", visualConcept: "Bathroom counter product setup" } }),
    );

    const result = await pipelineService.runById(record.id);

    expect(result.creativeQuality.overallScore).toBe(56);
    expect(result.platformSuitability.map((assessment) => assessment.platform)).toEqual(CREATIVE_PLATFORMS);
    expect(result.policyRisk.overallRisk).toBe("CRITICAL");
    expect(result.recommendations.find((recommendation) => recommendation.code === "REC_POLICY_RISK_MEDICAL_OR_CLINICAL_CLAIM_DETECTED")).toMatchObject({
      priority: "CRITICAL",
      advisoryOnly: true,
    });
    expect(result.governance.humanReviewRequired).toBe(true);
  });

  it("persists final analysis through the repository", async () => {
    const { repository, pipelineService, record } = await createPipelineFixture();

    const result = await pipelineService.runById(record.id);
    const stored = await repository.findById(record.id);

    expect(stored?.analysisStatus).toBe("ANALYZED");
    expect(stored?.analysis?.overallScore).toBe(result.creativeQuality.overallScore);
    expect(stored?.analysis?.platformSuitability).toEqual(result.platformSuitability);
    expect(stored?.analysis?.policyRisk).toEqual(result.policyRisk);
    expect(stored?.analysis?.recommendations).toEqual(result.recommendations);
  });

  it("returns defensive copies from the pipeline boundary", async () => {
    const { repository, pipelineService, record } = await createPipelineFixture(
      buildRequest({ brief: { primaryText: "Scientifically proven with guaranteed results.", visualConcept: "Bathroom counter product setup" } }),
    );

    const result = await pipelineService.runById(record.id);
    (result.platformSuitability[0]?.findings as PlatformSuitabilityFinding[]).push({
      platform: "FACEBOOK",
      code: "INJECTED_PIPELINE_PLATFORM",
      message: "Injected platform mutation",
      evidence: [],
    });
    (result.policyRisk.findings as PolicyRiskFinding[]).push({
      category: "OTHER",
      severity: "CRITICAL",
      code: "INJECTED_PIPELINE_POLICY",
      message: "Injected policy mutation",
      evidence: "Injected",
    });
    (result.recommendations as CreativeRecommendation[]).push({
      code: "INJECTED_PIPELINE_RECOMMENDATION",
      category: "HUMAN_REVIEW_REQUIRED",
      priority: "CRITICAL",
      reason: "Injected recommendation mutation",
      recommendedAction: "Injected action",
      evidence: ["INJECTED_PIPELINE_POLICY"],
      advisoryOnly: true,
    });
    (result.creativeQuality.dimensions[0]?.strengths as string[]).push("Injected pipeline strength");

    const stored = await repository.findById(record.id);

    expect(stored?.analysis?.platformSuitability?.[0]?.findings.map((finding) => finding.code)).not.toContain("INJECTED_PIPELINE_PLATFORM");
    expect(stored?.analysis?.policyRisk?.findings.map((finding) => finding.code)).not.toContain("INJECTED_PIPELINE_POLICY");
    expect(stored?.analysis?.recommendations?.map((recommendation) => recommendation.code)).not.toContain("INJECTED_PIPELINE_RECOMMENDATION");
    expect(stored?.analysis?.dimensions[0]?.strengths).not.toContain("Injected pipeline strength");
  });

  it("uses the existing lifecycle guard for idempotent persisted reruns", async () => {
    const { pipelineService, record } = await createPipelineFixture();

    await pipelineService.runById(record.id);

    await expect(pipelineService.runById(record.id)).rejects.toThrow(CreativeIntelligenceInvalidLifecycleTransitionError);
  });

  it("uses existing not-found handling for missing IDs", async () => {
    const pipelineService = new CreativeIntelligencePipelineService(new InMemoryCreativeIntelligenceRepository());

    await expect(pipelineService.runById("missing")).rejects.toThrow(CreativeIntelligenceRecordNotFoundError);
  });

  it("supports persisted pipeline lookup by creative ID", async () => {
    const { pipelineService, record } = await createPipelineFixture();

    const result = await pipelineService.runByCreativeId(record.creativeId);

    expect(result.creativeIntelligenceId).toBe(record.id);
    expect(result.status).toBe("ANALYZED");
  });

  it("exports the public pipeline API", () => {
    expect(publicExports.CreativeIntelligencePipelineService).toBe(CreativeIntelligencePipelineService);
    expect(publicExports.CREATIVE_INTELLIGENCE_PIPELINE_VERSION).toBe(CREATIVE_INTELLIGENCE_PIPELINE_VERSION);
    const _pipelineResult: CreativeIntelligencePipelineResult | undefined = undefined;

    expect(_pipelineResult).toBeUndefined();
  });
});

describe("InMemoryCreativeIntelligenceRepository", () => {
  it("saves records defensively", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord();

    const saved = await repository.save(record);

    expect(saved).toEqual(record);
    expect(saved).not.toBe(record);
  });

  it("finds records by ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());

    expect(await repository.findById(record.id)).toEqual(record);
    expect(await repository.findById("missing")).toBeNull();
  });

  it("finds records by creative ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());

    expect(await repository.findByCreativeId("Creative Launch 001")).toEqual(record);
  });

  it("lists records in deterministic order", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();

    await repository.save(await createRecord(buildRequest({ creativeId: "later", registeredAt: "2026-08-10T03:00:00.000Z" })));
    await repository.save(await createRecord(buildRequest({ creativeId: "earlier", registeredAt: "2026-08-10T01:00:00.000Z" })));

    expect((await repository.list()).map((record) => record.creativeId)).toEqual(["earlier", "later"]);
  });

  it("replaces duplicate saves by deterministic ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord();
    const updated: CreativeIntelligenceRecord = {
      ...record,
      warnings: ["Replacement warning"],
    };

    await repository.save(record);
    await repository.save(updated);

    expect(await repository.list()).toHaveLength(1);
    expect((await repository.findById(record.id))?.warnings).toEqual(["Replacement warning"]);
  });

  it("removes stale creative ID lookups when replacing the same canonical ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord(buildRequest({ creativeId: "Item 1" }));
    const replacement: CreativeIntelligenceRecord = {
      ...record,
      creativeId: "Replacement Item",
      warnings: ["Replacement warning"],
    };

    await repository.save(record);
    const savedReplacement = await repository.save(replacement);
    const expectedReplacement = structuredClone(replacement);
    (replacement.warnings as string[]).push("Injected after save");
    (savedReplacement.brief as { headline?: string }).headline = "Injected through return value";

    expect(await repository.findByCreativeId("Item 1")).toBeNull();
    expect(await repository.findByCreativeId("Replacement Item")).toEqual(expectedReplacement);
    expect(await repository.findById(record.id)).toEqual(expectedReplacement);
    expect((await repository.findByCreativeId("Replacement Item"))?.warnings).toEqual(["Replacement warning"]);
    expect((await repository.findById(record.id))?.brief.headline).toBe("Velvet Glow Wand");
  });

  it("keeps list ordering deterministic when timestamps match", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();

    await repository.save(await createRecord(buildRequest({ creativeId: "b-creative" })));
    await repository.save(await createRecord(buildRequest({ creativeId: "a-creative" })));

    expect((await repository.list()).map((record) => record.id)).toEqual(["creative-intelligence:a-creative", "creative-intelligence:b-creative"]);
  });

  it("protects stored state from mutation after save", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord();

    await repository.save(record);
    (record.warnings as string[]).push("Injected");
    (record.brief as { headline?: string }).headline = "Injected";

    const found = await repository.findById(record.id);
    expect(found?.warnings).not.toContain("Injected");
    expect(found?.brief.headline).not.toBe("Injected");
  });

  it("protects lookup results from mutation", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const found = await repository.findById(record.id);

    (found?.warnings as string[]).push("Injected");
    (found?.brief as { headline?: string }).headline = "Injected";

    expect((await repository.findById(record.id))?.warnings).not.toContain("Injected");
    expect((await repository.findById(record.id))?.brief.headline).not.toBe("Injected");
  });

  it("prevents nested brief mutation through listed records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const listed = await repository.list();

    (listed[0]?.brief as { headline?: string }).headline = "Injected";

    expect((await repository.findById(record.id))?.brief.headline).not.toBe("Injected");
  });

  it("prevents platform array mutation through returned records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const found = await repository.findById(record.id);

    (found?.platforms as string[]).push("OTHER");

    expect((await repository.findById(record.id))?.platforms).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });

  it("prevents market array mutation through returned records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const found = await repository.findById(record.id);

    (found?.targetMarkets as string[]).push("AU");

    expect((await repository.findById(record.id))?.targetMarkets).toEqual(["GB", "US"]);
  });

  it("clears stored records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();

    await repository.save(await createRecord());
    repository.clear();

    expect(await repository.list()).toHaveLength(0);
  });
});

describe("ai-creative-intelligence public exports", () => {
  it("exports the public module surface", () => {
    expect(publicExports.AiCreativeIntelligenceService).toBe(AiCreativeIntelligenceService);
    expect(publicExports.InMemoryCreativeIntelligenceRepository).toBe(InMemoryCreativeIntelligenceRepository);
    expect(publicExports.CREATIVE_ASSET_TYPES).toContain("MIXED");
  });
});
