import type { CreateCreativeIntelligenceRequest } from "../dto/create-creative-intelligence.request.js";
import type { CreativeIntelligenceRepository } from "../ports/creative-intelligence.repository.js";
import {
  CreativeIntelligenceInvalidRequestError,
  CreativeIntelligenceInvalidTimestampError,
  CreativeIntelligenceMissingCreativeMaterialError,
} from "../../domain/errors/creative-intelligence.errors.js";
import {
  CREATIVE_ASSET_TYPES,
  CREATIVE_PLATFORMS,
  type CreativeAssetType,
  type CreativeBrief,
  type CreativeIntelligenceRecord,
  type CreativePlatform,
} from "../../domain/models/creative-intelligence.model.js";

const CREATIVE_VERSION = "SACP-CREATIVE-v1";
const ID_PREFIX = "creative-intelligence:";
const BRIEF_FIELDS = ["hook", "headline", "primaryText", "description", "callToAction", "visualConcept"] as const;

type CreativeBriefField = (typeof BRIEF_FIELDS)[number];

export class AiCreativeIntelligenceService {
  public constructor(private readonly repository: CreativeIntelligenceRepository) {}

  public async createCreativeIntelligence(request: CreateCreativeIntelligenceRequest): Promise<CreativeIntelligenceRecord> {
    const normalizedRequest = this.validateRequest(request);
    const warnings = this.generateWarnings(normalizedRequest);

    const record: CreativeIntelligenceRecord = {
      id: this.buildRecordId(normalizedRequest.creativeId),
      creativeId: normalizedRequest.creativeId,
      productId: normalizedRequest.productId,
      ...(normalizedRequest.sourceContentId === undefined ? {} : { sourceContentId: normalizedRequest.sourceContentId }),
      assetType: normalizedRequest.assetType,
      platforms: [...normalizedRequest.platforms],
      targetMarkets: [...normalizedRequest.targetMarkets],
      brief: { ...normalizedRequest.brief },
      ...(normalizedRequest.brandName === undefined ? {} : { brandName: normalizedRequest.brandName }),
      ...(normalizedRequest.brandTone === undefined ? {} : { brandTone: normalizedRequest.brandTone }),
      analysisStatus: "PENDING_ANALYSIS",
      warnings,
      registeredAt: normalizedRequest.registeredAt,
      version: CREATIVE_VERSION,
    };

    return this.repository.save(record);
  }

  public buildRecordId(creativeId: string): string {
    return `${ID_PREFIX}${this.normalizeCreativeId(creativeId)}`;
  }

  private validateRequest(request: CreateCreativeIntelligenceRequest): CreateCreativeIntelligenceRequest {
    if (request === null || typeof request !== "object") {
      throw new CreativeIntelligenceInvalidRequestError();
    }

    const assetType = this.validateAssetType(request.assetType);
    const brief = this.normalizeBrief(request.brief, assetType);

    return {
      creativeId: this.normalizeCreativeId(request.creativeId),
      productId: this.normalizeRequiredString(request.productId, "productId"),
      ...(request.sourceContentId === undefined ? {} : { sourceContentId: this.normalizeRequiredString(request.sourceContentId, "sourceContentId") }),
      assetType,
      platforms: this.normalizePlatforms(request.platforms),
      targetMarkets: this.normalizeMarkets(request.targetMarkets),
      brief,
      ...(request.brandName === undefined ? {} : { brandName: this.normalizeRequiredString(request.brandName, "brandName") }),
      ...(request.brandTone === undefined ? {} : { brandTone: this.normalizeRequiredString(request.brandTone, "brandTone") }),
      registeredAt: this.normalizeTimestamp(request.registeredAt),
    };
  }

  private validateAssetType(assetType: unknown): CreativeAssetType {
    if (typeof assetType !== "string" || !CREATIVE_ASSET_TYPES.includes(assetType as CreativeAssetType)) {
      throw new CreativeIntelligenceInvalidRequestError("Creative asset type is not supported.", { assetType });
    }

    return assetType as CreativeAssetType;
  }

  private normalizeCreativeId(value: unknown): string {
    const trimmed = this.normalizeRequiredString(value, "creativeId");
    const normalized = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "");

    if (normalized.length === 0) {
      throw new CreativeIntelligenceInvalidRequestError("creativeId must contain alphanumeric identity material.", { creativeId: value });
    }

    return normalized;
  }

  private normalizePlatforms(value: unknown): readonly CreativePlatform[] {
    if (!Array.isArray(value)) {
      throw new CreativeIntelligenceInvalidRequestError("platforms must be an array.", { field: "platforms" });
    }

    if (value.length === 0) {
      throw new CreativeIntelligenceInvalidRequestError("platforms must include at least one platform.", { field: "platforms" });
    }

    const selected = new Set<CreativePlatform>();
    for (const platform of value) {
      if (typeof platform !== "string" || !CREATIVE_PLATFORMS.includes(platform as CreativePlatform)) {
        throw new CreativeIntelligenceInvalidRequestError("Creative platform is not supported.", { platform });
      }

      selected.add(platform as CreativePlatform);
    }

    return CREATIVE_PLATFORMS.filter((platform) => selected.has(platform));
  }

  private normalizeMarkets(value: unknown): readonly string[] {
    if (!Array.isArray(value)) {
      throw new CreativeIntelligenceInvalidRequestError("targetMarkets must be an array.", { field: "targetMarkets" });
    }

    if (value.length === 0) {
      throw new CreativeIntelligenceInvalidRequestError("targetMarkets must include at least one market.", { field: "targetMarkets" });
    }

    const markets = new Set<string>();
    for (const market of value) {
      if (typeof market !== "string" || market.trim().length === 0) {
        throw new CreativeIntelligenceInvalidRequestError("targetMarkets cannot include blank values.", { market });
      }

      const normalized = market.trim().toUpperCase();
      if (!/^[A-Z]{2}(?:-[A-Z0-9]{2,3})?$/u.test(normalized)) {
        throw new CreativeIntelligenceInvalidRequestError("targetMarkets must use uppercase canonical market codes.", { market });
      }

      markets.add(normalized);
    }

    return [...markets].sort((left, right) => left.localeCompare(right));
  }

  private normalizeBrief(value: unknown, assetType: CreativeAssetType): CreativeBrief {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new CreativeIntelligenceInvalidRequestError("brief must be an object.", { field: "brief" });
    }

    const source = value as Record<string, unknown>;
    const brief: Partial<Record<CreativeBriefField, string>> = {};

    for (const field of BRIEF_FIELDS) {
      const fieldValue = source[field];
      if (fieldValue === undefined) {
        continue;
      }

      if (typeof fieldValue !== "string") {
        throw new CreativeIntelligenceInvalidRequestError("Creative brief fields must be strings.", { field });
      }

      const trimmed = fieldValue.trim();
      if (trimmed.length > 0) {
        brief[field] = trimmed;
      }
    }

    if (Object.keys(brief).length === 0) {
      throw new CreativeIntelligenceMissingCreativeMaterialError();
    }

    if (assetType === "COPY" && brief.headline === undefined && brief.primaryText === undefined && brief.description === undefined && brief.callToAction === undefined) {
      throw new CreativeIntelligenceMissingCreativeMaterialError("Copy creative requires text material.", { assetType });
    }

    return brief;
  }

  private normalizeTimestamp(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new CreativeIntelligenceInvalidTimestampError("registeredAt cannot be blank.");
    }

    const trimmed = value.trim();
    const parsed = new Date(trimmed);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== trimmed) {
      throw new CreativeIntelligenceInvalidTimestampError("registeredAt must be a valid ISO-8601 UTC timestamp.", { registeredAt: value });
    }

    return trimmed;
  }

  private normalizeRequiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new CreativeIntelligenceInvalidRequestError(`${field} cannot be blank.`, { field });
    }

    return value.trim();
  }

  private generateWarnings(request: CreateCreativeIntelligenceRequest): readonly string[] {
    const warnings: string[] = [];

    if (request.brief.hook === undefined && (request.assetType === "VIDEO" || request.assetType === "MIXED" || request.assetType === "CAROUSEL")) {
      warnings.push("Creative hook is missing and should be reviewed before analysis.");
    }

    if (request.brief.callToAction === undefined) {
      warnings.push("Call to action is missing and should be reviewed before analysis.");
    }

    if (Object.keys(request.brief).length === 1) {
      warnings.push("Creative brief contains minimal material and may need enrichment before analysis.");
    }

    if (request.platforms.includes("OTHER")) {
      warnings.push("Platform OTHER selected; platform requirements must be reviewed manually.");
    }

    return warnings;
  }
}
