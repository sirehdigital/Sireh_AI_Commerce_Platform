import {
  WinningHunterClientUnavailableError,
  WinningHunterMalformedExternalResponseError,
  WinningHunterRateLimitedError,
  WinningHunterRequestTimeoutError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type { WinningHunterDiscoveryQuery } from "../../domain/models/winninghunter-discovery-query.model.js";
import type {
  WinningHunterCandidateDiscoveryContext,
  WinningHunterDiscoveredCandidate,
  WinningHunterDiscoveryExecutionPlan,
  WinningHunterDiscoveryExecutionUnit,
  WinningHunterDiscoveryRunResult,
  WinningHunterDiscoveryRunWarning,
  WinningHunterProductDiscoveryStrategy,
} from "../../domain/models/winninghunter-discovery-strategy.model.js";
import type { WinningHunterProductCandidate } from "../../domain/models/winninghunter-product-candidate.model.js";
import {
  cloneCandidate,
} from "../../infrastructure/mappers/winninghunter-product-candidate.mapper.js";
import type { WinningHunterProductDiscoveryClient } from "../ports/winninghunter-product-discovery-client.js";
import { WinningHunterProductDiscoveryService } from "./winninghunter-product-discovery.service.js";
import {
  cloneWinningHunterStrategy,
  validateWinningHunterStrategy,
} from "../strategies/winninghunter-discovery-strategy.registry.js";

export interface WinningHunterDiscoveryQueryEngineOptions {
  readonly concurrencyLimit?: number;
}

interface UnitExecutionResult {
  readonly completed: boolean;
  readonly pagesFetched: number;
  readonly sourceRowsReceived: number;
  readonly candidates: readonly WinningHunterDiscoveredCandidate[];
  readonly warnings: readonly WinningHunterDiscoveryRunWarning[];
}

export class WinningHunterDiscoveryQueryEngine {
  private readonly discoveryService: WinningHunterProductDiscoveryService;
  private readonly concurrencyLimit: number;

  public constructor(
    client: WinningHunterProductDiscoveryClient,
    options: WinningHunterDiscoveryQueryEngineOptions = {},
  ) {
    this.discoveryService = new WinningHunterProductDiscoveryService(client);
    this.concurrencyLimit = clampConcurrency(options.concurrencyLimit ?? 2);
  }

  public buildExecutionPlan(
    strategy: WinningHunterProductDiscoveryStrategy,
  ): WinningHunterDiscoveryExecutionPlan {
    const safeStrategy = cloneWinningHunterStrategy(strategy);
    validateWinningHunterStrategy(safeStrategy);

    const units = safeStrategy.targetMarkets.flatMap((market) =>
      safeStrategy.niches.map((niche) => ({
        id: `${safeStrategy.id}:${market}:${niche}`,
        market,
        niche,
        query: buildQueryForUnit(safeStrategy, market, niche),
      })),
    );

    return {
      strategyId: safeStrategy.id,
      units,
      maximumPagesPerUnit: safeStrategy.maximumPages,
      maximumCandidates: safeStrategy.maximumCandidates,
    };
  }

  public async discover(
    strategy: WinningHunterProductDiscoveryStrategy,
  ): Promise<WinningHunterDiscoveryRunResult> {
    const startedAt = new Date().toISOString();
    const plan = this.buildExecutionPlan(strategy);
    const collected = new Map<string, WinningHunterDiscoveredCandidate>();
    const warnings: WinningHunterDiscoveryRunWarning[] = [];
    let pagesFetched = 0;
    let sourceRowsReceived = 0;
    let unitsCompleted = 0;
    let unitsFailed = 0;

    await runBounded(plan.units, this.concurrencyLimit, async (unit) => {
      if (collected.size >= plan.maximumCandidates) {
        return;
      }

      const result = await this.executeUnit(unit, plan.maximumPagesPerUnit, plan.maximumCandidates);

      pagesFetched += result.pagesFetched;
      sourceRowsReceived += result.sourceRowsReceived;
      warnings.push(...result.warnings);

      if (result.completed) {
        unitsCompleted += 1;
      } else {
        unitsFailed += 1;
      }

      mergeDiscoveredCandidates(collected, result.candidates, plan.maximumCandidates);
    });

    const candidates = sortDiscoveredCandidates([...collected.values()]);
    const completedAt = new Date().toISOString();
    const status =
      unitsCompleted === 0
        ? "FAILED"
        : warnings.length > 0 || unitsFailed > 0
          ? "COMPLETED_WITH_WARNINGS"
          : "COMPLETED";

    return {
      strategyId: plan.strategyId,
      status,
      candidates,
      executionUnitsPlanned: plan.units.length,
      executionUnitsCompleted: unitsCompleted,
      executionUnitsFailed: unitsFailed,
      pagesFetched,
      sourceRowsReceived,
      uniqueCandidates: candidates.length,
      warnings,
      startedAt,
      completedAt,
    };
  }

  private async executeUnit(
    unit: WinningHunterDiscoveryExecutionUnit,
    maximumPages: number,
    maximumCandidates: number,
  ): Promise<UnitExecutionResult> {
    const candidates: WinningHunterDiscoveredCandidate[] = [];
    const warnings: WinningHunterDiscoveryRunWarning[] = [];
    const seenCursors = new Set<string>();
    let nextScroll: string | undefined;
    let pagesFetched = 0;
    let sourceRowsReceived = 0;

    try {
      for (let pageNumber = 1; pageNumber <= maximumPages; pageNumber += 1) {
        const page = await this.discoveryService.findWinningProducts({
          ...unit.query,
          ...(nextScroll === undefined ? {} : { scroll: nextScroll }),
        });

        pagesFetched += 1;
        sourceRowsReceived += page.sourceResultCount;
        candidates.push(
          ...page.candidates.map((candidate) => ({
            candidate,
            contexts: [buildContext(unit, pageNumber)],
          })),
        );

        if (candidates.length >= maximumCandidates) {
          break;
        }

        if (!page.hasMore || page.nextScroll === undefined) {
          break;
        }

        if (seenCursors.has(page.nextScroll)) {
          warnings.push({
            executionUnitId: unit.id,
            code: "REPEATED_SCROLL_CURSOR",
            message: "WinningHunter repeated a scroll cursor; pagination stopped for this unit",
          });
          break;
        }

        seenCursors.add(page.nextScroll);
        nextScroll = page.nextScroll;
      }

      return {
        completed: true,
        pagesFetched,
        sourceRowsReceived,
        candidates,
        warnings,
      };
    } catch (error) {
      return {
        completed: false,
        pagesFetched,
        sourceRowsReceived,
        candidates,
        warnings: [...warnings, mapFailureWarning(unit.id, error)],
      };
    }
  }
}

export function buildQueryForUnit(
  strategy: WinningHunterProductDiscoveryStrategy,
  market: WinningHunterDiscoveryExecutionUnit["market"],
  niche: string,
): WinningHunterDiscoveryQuery {
  return {
    countries: [market],
    niches: [niche],
    language: strategy.language,
    technology: strategy.technology,
    ...(strategy.minimumPrice === undefined ? {} : { minPrice: strategy.minimumPrice }),
    ...(strategy.maximumPrice === undefined ? {} : { maxPrice: strategy.maximumPrice }),
    ...(strategy.minimumActiveAds === undefined ? {} : { minActiveAds: strategy.minimumActiveAds }),
    ...(strategy.maximumActiveAds === undefined ? {} : { maxActiveAds: strategy.maximumActiveAds }),
    ...(strategy.minimumDaysRunning === undefined
      ? {}
      : { minDaysRunning: strategy.minimumDaysRunning }),
    ...(strategy.maximumDaysRunning === undefined
      ? {}
      : { maxDaysRunning: strategy.maximumDaysRunning }),
    ...(strategy.minimumActiveAdsGrowth === undefined
      ? {}
      : { minActiveAdsGrowth: strategy.minimumActiveAdsGrowth }),
    ...(strategy.activeAdsGrowthPeriod === undefined
      ? {}
      : { activeAdsGrowthPeriod: strategy.activeAdsGrowthPeriod }),
    ...(strategy.mediaTypes?.[0] === undefined ? {} : { mediaType: strategy.mediaTypes[0] }),
    sortBy: strategy.sorting.field,
    sortOrder: strategy.sorting.direction,
  };
}

function mergeDiscoveredCandidates(
  target: Map<string, WinningHunterDiscoveredCandidate>,
  candidates: readonly WinningHunterDiscoveredCandidate[],
  maximumCandidates: number,
): void {
  for (const discovered of candidates) {
    const existing = target.get(discovered.candidate.id);

    if (existing === undefined) {
      if (target.size >= maximumCandidates) {
        return;
      }

      target.set(discovered.candidate.id, cloneDiscoveredCandidate(discovered));
      continue;
    }

    target.set(discovered.candidate.id, {
      candidate: mergeCandidateSignals(existing.candidate, discovered.candidate),
      contexts: mergeContexts(existing.contexts, discovered.contexts),
    });
  }
}

function mergeCandidateSignals(
  left: WinningHunterProductCandidate,
  right: WinningHunterProductCandidate,
): WinningHunterProductCandidate {
  const signals = new Map(left.adSignals.map((signal) => [signal.externalAdId, signal]));

  for (const signal of right.adSignals) {
    if (!signals.has(signal.externalAdId)) {
      signals.set(signal.externalAdId, signal);
    }
  }

  return {
    ...cloneCandidate(left),
    ...optionalCandidateNumber(
      "totalActiveAdsOnPage",
      maxOptional(left.totalActiveAdsOnPage, right.totalActiveAdsOnPage),
    ),
    ...optionalCandidateString("lastObservedAt", maxDate(left.lastObservedAt, right.lastObservedAt)),
    adSignals: [...signals.values()].map((signal) => ({
      ...signal,
      countries: [...signal.countries],
      rankHistory: { ...signal.rankHistory },
    })),
  };
}

function mergeContexts(
  left: readonly WinningHunterCandidateDiscoveryContext[],
  right: readonly WinningHunterCandidateDiscoveryContext[],
): readonly WinningHunterCandidateDiscoveryContext[] {
  const byKey = new Map<string, WinningHunterCandidateDiscoveryContext>();

  for (const context of [...left, ...right]) {
    byKey.set(
      `${context.executionUnitId}:${context.market}:${context.niche}:${context.discoveredPage}`,
      { ...context },
    );
  }

  return [...byKey.values()];
}

function sortDiscoveredCandidates(
  candidates: readonly WinningHunterDiscoveredCandidate[],
): readonly WinningHunterDiscoveredCandidate[] {
  return candidates
    .map((candidate) => cloneDiscoveredCandidate(candidate))
    .sort((left, right) => {
      return (
        uniqueMarkets(right) - uniqueMarkets(left) ||
        right.contexts.length - left.contexts.length ||
        (right.candidate.totalActiveAdsOnPage ?? 0) - (left.candidate.totalActiveAdsOnPage ?? 0) ||
        Date.parse(right.candidate.lastObservedAt ?? "1970-01-01T00:00:00.000Z") -
          Date.parse(left.candidate.lastObservedAt ?? "1970-01-01T00:00:00.000Z") ||
        left.candidate.id.localeCompare(right.candidate.id)
      );
    });
}

function uniqueMarkets(candidate: WinningHunterDiscoveredCandidate): number {
  return new Set(candidate.contexts.map((context) => context.market)).size;
}

function cloneDiscoveredCandidate(
  discovered: WinningHunterDiscoveredCandidate,
): WinningHunterDiscoveredCandidate {
  return {
    candidate: cloneCandidate(discovered.candidate),
    contexts: discovered.contexts.map((context) => ({ ...context })),
  };
}

function buildContext(
  unit: WinningHunterDiscoveryExecutionUnit,
  discoveredPage: number,
): WinningHunterCandidateDiscoveryContext {
  return {
    market: unit.market,
    niche: unit.niche,
    executionUnitId: unit.id,
    discoveredPage,
  };
}

function mapFailureWarning(executionUnitId: string, error: unknown): WinningHunterDiscoveryRunWarning {
  if (error instanceof WinningHunterRequestTimeoutError) {
    return {
      executionUnitId,
      code: "WINNINGHUNTER_TIMEOUT",
      message: "WinningHunter request timed out for this execution unit",
    };
  }

  if (error instanceof WinningHunterRateLimitedError) {
    return {
      executionUnitId,
      code: "WINNINGHUNTER_RATE_LIMITED",
      message: "WinningHunter rate limited this execution unit",
    };
  }

  if (error instanceof WinningHunterClientUnavailableError) {
    return {
      executionUnitId,
      code: "WINNINGHUNTER_UNAVAILABLE",
      message: "WinningHunter client was unavailable for this execution unit",
    };
  }

  if (error instanceof WinningHunterMalformedExternalResponseError) {
    return {
      executionUnitId,
      code: "WINNINGHUNTER_MALFORMED_RESPONSE",
      message: "WinningHunter returned a malformed response for this execution unit",
    };
  }

  return {
    executionUnitId,
    code: "WINNINGHUNTER_PROVIDER_FAILURE",
    message: "WinningHunter provider failure occurred for this execution unit",
  };
}

async function runBounded<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function runNext(): Promise<void> {
    const item = items[index];
    index += 1;

    if (item === undefined) {
      return;
    }

    await worker(item);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
}

function clampConcurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.min(4, Math.max(1, Math.trunc(value)));
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

function maxDate(left: string | undefined, right: string | undefined): string | undefined {
  if (left === undefined) {
    return right;
  }

  if (right === undefined) {
    return left;
  }

  return Date.parse(left) >= Date.parse(right) ? left : right;
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
