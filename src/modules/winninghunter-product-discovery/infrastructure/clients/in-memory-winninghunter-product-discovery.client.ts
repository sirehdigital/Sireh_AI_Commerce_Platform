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
  readonly healthStatus?: WinningHunterHealthStatus;
  readonly failureMode?: "timeout" | "rate-limit" | "provider-failure";
}

export class InMemoryWinningHunterProductDiscoveryClient
  implements WinningHunterProductDiscoveryClient
{
  private readonly pages: readonly RawWinningHunterDiscoveryPage[];
  private readonly healthStatus: WinningHunterHealthStatus | undefined;
  private readonly failureMode: "timeout" | "rate-limit" | "provider-failure" | undefined;
  public readonly observedQueries: WinningHunterDiscoveryQuery[] = [];

  public constructor(options: InMemoryWinningHunterClientOptions = {}) {
    this.pages = options.pages?.map((page) => cloneRawPage(page)) ?? [];
    this.healthStatus = options.healthStatus;
    this.failureMode = options.failureMode;
  }

  public findWinningProducts(
    query: WinningHunterDiscoveryQuery,
  ): Promise<RawWinningHunterDiscoveryPage> {
    this.throwIfConfigured();
    this.observedQueries.push({ ...query });

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
}

function cloneRawPage(page: RawWinningHunterDiscoveryPage): RawWinningHunterDiscoveryPage {
  return {
    rows: page.rows.map((row) => ({ ...row })),
    ...(page.nextScroll === undefined ? {} : { nextScroll: page.nextScroll }),
    ...(page.hasMore === undefined ? {} : { hasMore: page.hasMore }),
    ...(page.sourceResultCount === undefined ? {} : { sourceResultCount: page.sourceResultCount }),
  };
}
