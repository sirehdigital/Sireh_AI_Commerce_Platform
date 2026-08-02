import type { WinningHunterDiscoveryQuery } from "../../domain/models/winninghunter-discovery-query.model.js";
import type { WinningHunterHealthStatus } from "../../domain/models/winninghunter-product-candidate.model.js";
import type { RawWinningHunterDiscoveryPage } from "../../infrastructure/clients/raw-winninghunter-product.dto.js";

export interface WinningHunterProductDiscoveryClient {
  findWinningProducts(
    query: WinningHunterDiscoveryQuery,
  ): Promise<RawWinningHunterDiscoveryPage>;

  checkHealth?(): Promise<WinningHunterHealthStatus>;
}
