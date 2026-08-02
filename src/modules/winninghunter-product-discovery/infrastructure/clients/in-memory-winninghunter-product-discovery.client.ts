import {
  WinningHunterClientUnavailableError,
  WinningHunterRateLimitedError,
  WinningHunterRequestTimeoutError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type { WinningHunterDiscoveryQuery } from "../../domain/models/winninghunter-discovery-query.model.js";
import type { WinningHunterHealthStatus } from "../../domain/models/winninghunter-product-candidate.model.js";
import type { WinningHunterProductDiscoveryClient } from "../../application/ports/winninghunter-product-discovery-client.js";
import type { RawWinningHunterDiscoveryPage } from "./raw-winninghunter-product.dto.js";

export interface InMemoryWinningHunterClientOptions {
  readonly pages?: readonly RawWinningHunterDiscoveryPage[];
  readonly routes?: readonly InMemoryWinningHunterClientRoute[];
  readonly healthStatus?: WinningHunterHealthStatus;
  readonly failureMode?: "timeout" | "rate-limit" | "provider-failure";
}

export interface InMemoryWinningHunterClientRoute {
  readonly market?: string;
  readonly niche?: string;
  readonly pages: readonly RawWinningHunterDiscoveryPage[];
  readonly failureMode?: "timeout" | "rate-limit" | "provider-failure";
}

export class InMemoryWinningHunterProductDiscoveryClient
  implements WinningHunterProductDiscoveryClient
{
  private readonly pages: readonly RawWinningHunterDiscoveryPage[];
  private readonly routes: readonly InMemoryWinningHunterClientRoute[];
  private readonly routeInvocationCounts = new Map<string, number>();
  private readonly healthStatus: WinningHunterHealthStatus | undefined;
  private readonly failureMode: "timeout" | "rate-limit" | "provider-failure" | undefined;
  public readonly observedQueries: WinningHunterDiscoveryQuery[] = [];
  public readonly invocationHistory: WinningHunterDiscoveryQuery[] = this.observedQueries;

  public constructor(options: InMemoryWinningHunterClientOptions = {}) {
    this.pages = options.pages?.map((page) => cloneRawPage(page)) ?? [];
    this.routes =
      options.routes?.map((route) => ({
        ...(route.market === undefined ? {} : { market: route.market }),
        ...(route.niche === undefined ? {} : { niche: route.niche }),
        pages: route.pages.map((page) => cloneRawPage(page)),
        ...(route.failureMode === undefined ? {} : { failureMode: route.failureMode }),
      })) ?? [];
    this.healthStatus = options.healthStatus;
    this.failureMode = options.failureMode;
  }

  public findWinningProducts(
    query: WinningHunterDiscoveryQuery,
  ): Promise<RawWinningHunterDiscoveryPage> {
    this.throwIfConfigured();
    this.observedQueries.push(cloneQuery(query));

    const route = this.findRoute(query);

    if (route !== undefined) {
      throwRouteFailure(route.failureMode);

      const routeKey = buildRouteKey(route);
      const invocationCount = this.routeInvocationCounts.get(routeKey) ?? 0;
      this.routeInvocationCounts.set(routeKey, invocationCount + 1);

      return Promise.resolve(cloneRawPage(route.pages[invocationCount] ?? { rows: [] }));
    }

    const pageIndex = this.observedQueries.length - 1;

    return Promise.resolve(cloneRawPage(this.pages[pageIndex] ?? { rows: [] }));
  }

  public checkHealth(): Promise<WinningHunterHealthStatus> {
    this.throwIfConfigured();

    return Promise.resolve(
      this.healthStatus ?? {
        status: "AVAILABLE",
        checkedAt: new Date().toISOString(),
      },
    );
  }

  private throwIfConfigured(): void {
    if (this.failureMode === "timeout") {
      throw new WinningHunterRequestTimeoutError();
    }

    if (this.failureMode === "rate-limit") {
      throw new WinningHunterRateLimitedError();
    }

    if (this.failureMode === "provider-failure") {
      throw new WinningHunterClientUnavailableError();
    }
  }

  private findRoute(query: WinningHunterDiscoveryQuery): InMemoryWinningHunterClientRoute | undefined {
    const market = query.countries?.[0];
    const niche = query.niches?.[0];

    return this.routes.find((route) => {
      const marketMatches = route.market === undefined || route.market === market;
      const nicheMatches = route.niche === undefined || route.niche === niche;

      return marketMatches && nicheMatches;
    });
  }
}

function cloneRawPage(page: RawWinningHunterDiscoveryPage): RawWinningHunterDiscoveryPage {
  return {
    rows: page.rows.map((row) => ({ ...row })),
    ...(page.nextScroll === undefined ? {} : { nextScroll: page.nextScroll }),
    ...(page.hasMore === undefined ? {} : { hasMore: page.hasMore }),
    ...(page.sourceResultCount === undefined ? {} : { sourceResultCount: page.sourceResultCount }),
  };
}

function cloneQuery(query: WinningHunterDiscoveryQuery): WinningHunterDiscoveryQuery {
  return {
    ...query,
    ...(query.countries === undefined ? {} : { countries: [...query.countries] }),
    ...(query.niches === undefined ? {} : { niches: [...query.niches] }),
  };
}

function buildRouteKey(route: InMemoryWinningHunterClientRoute): string {
  return `${route.market ?? "*"}:${route.niche ?? "*"}`;
}

function throwRouteFailure(
  failureMode: InMemoryWinningHunterClientRoute["failureMode"],
): void {
  if (failureMode === "timeout") {
    throw new WinningHunterRequestTimeoutError();
  }

  if (failureMode === "rate-limit") {
    throw new WinningHunterRateLimitedError();
  }

  if (failureMode === "provider-failure") {
    throw new WinningHunterClientUnavailableError();
  }
}
