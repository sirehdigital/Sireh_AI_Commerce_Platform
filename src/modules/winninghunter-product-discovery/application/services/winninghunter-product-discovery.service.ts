import {
  WinningHunterClientUnavailableError,
  WinningHunterInvalidDiscoveryQueryError,
  WinningHunterMalformedExternalResponseError,
  WinningHunterRateLimitedError,
  WinningHunterRequestTimeoutError,
  WinningHunterUnsupportedUrlError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type { WinningHunterDiscoveryQuery } from "../../domain/models/winninghunter-discovery-query.model.js";
import type {
  WinningHunterDiscoveryPage,
  WinningHunterHealthStatus,
  WinningHunterProductCandidate,
} from "../../domain/models/winninghunter-product-candidate.model.js";
import {
  cloneCandidate,
  WinningHunterProductCandidateMapper,
} from "../../infrastructure/mappers/winninghunter-product-candidate.mapper.js";
import type { WinningHunterProductDiscoveryClient } from "../ports/winninghunter-product-discovery-client.js";

export class WinningHunterProductDiscoveryService {
  private readonly mapper: WinningHunterProductCandidateMapper;

  public constructor(
    private readonly client: WinningHunterProductDiscoveryClient,
    mapper = new WinningHunterProductCandidateMapper(),
  ) {
    this.mapper = mapper;
  }

  public async findWinningProducts(
    query: WinningHunterDiscoveryQuery,
  ): Promise<WinningHunterDiscoveryPage> {
    validateWinningHunterDiscoveryQuery(query);

    const rawPage = await this.invokeClient(query);
    const observedAt = new Date().toISOString();
    const mappedCandidates = rawPage.rows
      .map((row) => this.safeMapRow(row, observedAt))
      .filter((candidate): candidate is WinningHunterProductCandidate => candidate !== undefined);
    const candidates = groupWinningHunterCandidates(mappedCandidates);
    const nextScroll = parseScroll(rawPage.nextScroll);

    return {
      candidates: candidates.map((candidate) => cloneCandidate(candidate)),
      ...(nextScroll === undefined ? {} : { nextScroll }),
      hasMore: Boolean(rawPage.hasMore ?? nextScroll),
      sourceResultCount: parseSourceResultCount(rawPage.sourceResultCount, rawPage.rows.length),
    };
  }

  public async checkHealth(): Promise<WinningHunterHealthStatus> {
    const checkedAt = new Date().toISOString();

    if (this.client.checkHealth === undefined) {
      return {
        status: "DEGRADED",
        checkedAt,
        message: "WinningHunter client does not expose a health check",
      };
    }

    try {
      const status = await this.client.checkHealth();

      return { ...status, checkedAt: status.checkedAt || checkedAt };
    } catch {
      return {
        status: "UNAVAILABLE",
        checkedAt,
        message: "WinningHunter health check failed",
      };
    }
  }

  private async invokeClient(
    query: WinningHunterDiscoveryQuery,
  ): Promise<Awaited<ReturnType<WinningHunterProductDiscoveryClient["findWinningProducts"]>>> {
    try {
      const page = await this.client.findWinningProducts(query);

      if (!Array.isArray(page.rows)) {
        throw new WinningHunterMalformedExternalResponseError();
      }

      return page;
    } catch (error) {
      if (
        error instanceof WinningHunterRateLimitedError ||
        error instanceof WinningHunterRequestTimeoutError ||
        error instanceof WinningHunterClientUnavailableError ||
        error instanceof WinningHunterMalformedExternalResponseError
      ) {
        throw error;
      }

      throw new WinningHunterClientUnavailableError();
    }
  }

  private safeMapRow(
    row: Parameters<WinningHunterProductCandidateMapper["mapRow"]>[0],
    observedAt: string,
  ): WinningHunterProductCandidate | undefined {
    try {
      return this.mapper.mapRow(row, observedAt);
    } catch (error) {
      if (error instanceof WinningHunterUnsupportedUrlError) {
        return undefined;
      }

      return undefined;
    }
  }
}

export function validateWinningHunterDiscoveryQuery(query: WinningHunterDiscoveryQuery): void {
  validateStringList("countries", query.countries);
  validateStringList("niches", query.niches);
  validateRange("price", query.minPrice, query.maxPrice);
  validateRange("active ads", query.minActiveAds, query.maxActiveAds);
  validateRange("days running", query.minDaysRunning, query.maxDaysRunning);

  if (
    query.minActiveAdsGrowth !== undefined &&
    (!Number.isFinite(query.minActiveAdsGrowth) || query.minActiveAdsGrowth < 0)
  ) {
    throw new WinningHunterInvalidDiscoveryQueryError(
      "Minimum active ads growth must be a finite non-negative number",
    );
  }

  if (query.sortOrder !== undefined && query.sortOrder !== "asc" && query.sortOrder !== "desc") {
    throw new WinningHunterInvalidDiscoveryQueryError("Sort order must be asc or desc");
  }

  parseScroll(query.scroll);
}

export function groupWinningHunterCandidates(
  candidates: readonly WinningHunterProductCandidate[],
): readonly WinningHunterProductCandidate[] {
  const byId = new Map<string, WinningHunterProductCandidate>();

  for (const candidate of candidates) {
    const existing = byId.get(candidate.id);

    if (existing === undefined) {
      byId.set(candidate.id, cloneCandidate(candidate));
      continue;
    }

    byId.set(candidate.id, mergeCandidates(existing, candidate));
  }

  return [...byId.values()].map((candidate) => cloneCandidate(candidate));
}

function mergeCandidates(
  left: WinningHunterProductCandidate,
  right: WinningHunterProductCandidate,
): WinningHunterProductCandidate {
  const adSignalsById = new Map(left.adSignals.map((signal) => [signal.externalAdId, signal]));

  for (const signal of right.adSignals) {
    if (!adSignalsById.has(signal.externalAdId)) {
      adSignalsById.set(signal.externalAdId, signal);
    }
  }

  return {
    ...left,
    ...preferDefined(right),
    ...optionalCandidateNumber(
      "totalActiveAdsOnPage",
      maxOptional(left.totalActiveAdsOnPage, right.totalActiveAdsOnPage),
    ),
    ...optionalCandidateNumber(
      "activeAdsGrowthOneWeek",
      maxOptional(left.activeAdsGrowthOneWeek, right.activeAdsGrowthOneWeek),
    ),
    ...optionalCandidateNumber(
      "activeAdsGrowthOneMonth",
      maxOptional(left.activeAdsGrowthOneMonth, right.activeAdsGrowthOneMonth),
    ),
    adSignals: [...adSignalsById.values()].map((signal) => ({
      ...signal,
      countries: [...signal.countries],
      rankHistory: { ...signal.rankHistory },
    })),
    discoveredAt: minDate(left.discoveredAt, right.discoveredAt),
    ...optionalCandidateString("lastObservedAt", maxDate(left.lastObservedAt, right.lastObservedAt)),
  };
}

function preferDefined(right: WinningHunterProductCandidate): Partial<WinningHunterProductCandidate> {
  const result: Partial<WinningHunterProductCandidate> = {};
  const mutableResult = result as Record<string, unknown>;

  for (const [key, value] of Object.entries(right)) {
    if (value !== undefined && key !== "id" && key !== "source" && key !== "adSignals") {
      mutableResult[key] = value;
    }
  }

  return result;
}

function optionalCandidateNumber<Key extends string>(
  key: Key,
  value: number | undefined,
): Partial<Record<Key, number>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, number>>);
}

function optionalCandidateString<Key extends string>(
  key: Key,
  value: string | undefined,
): Partial<Record<Key, string>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, string>>);
}

function validateStringList(name: string, values: readonly string[] | undefined): void {
  if (values?.some((value) => value.trim().length === 0)) {
    throw new WinningHunterInvalidDiscoveryQueryError(`${name} must not contain blank values`);
  }
}

function validateRange(name: string, minimum: number | undefined, maximum: number | undefined): void {
  for (const value of [minimum, maximum]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new WinningHunterInvalidDiscoveryQueryError(`${name} range values must be non-negative`);
    }
  }

  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new WinningHunterInvalidDiscoveryQueryError(`${name} minimum cannot exceed maximum`);
  }
}

function parseScroll(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new WinningHunterInvalidDiscoveryQueryError("Pagination cursor must be a string");
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > 512) {
    throw new WinningHunterInvalidDiscoveryQueryError("Pagination cursor is malformed");
  }

  return trimmed;
}

function parseSourceResultCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function maxOptional(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) {
    return right;
  }

  if (right === undefined) {
    return left;
  }

  return Math.max(left, right);
}

function minDate(left: string, right: string): string {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function maxDate(left: string | undefined, right: string | undefined): string | undefined {
  if (left === undefined) {
    return right;
  }

  if (right === undefined) {
    return left;
  }

  return Date.parse(left) >= Date.parse(right) ? left : right;
}
