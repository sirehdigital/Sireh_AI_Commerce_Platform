import type { AutoDsProductDto } from "../../application/dtos/autods-product.dto.js";

export interface AutoDsAuthenticationResult {
  readonly authenticated: boolean;
  readonly authenticatedAt: string;
  readonly expiresAt?: string;
}

export interface AutoDsProductSearchQuery {
  readonly query: string;
  readonly supplierId?: string;
  readonly marketplace?: string;
  readonly countryCode?: string;
}

export interface AutoDsProductListQuery {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface AutoDsProductCollectionResult {
  readonly products: readonly AutoDsProductDto[];
  readonly nextCursor?: string;
}

export interface AutoDsClientHealth {
  readonly available: boolean;
  readonly checkedAt: string;
  readonly message?: string;
}

export interface AutoDsClient {
  authenticate(): Promise<AutoDsAuthenticationResult>;
  getProduct(autoDsProductId: string): Promise<AutoDsProductDto | undefined>;
  searchProducts(query: AutoDsProductSearchQuery): Promise<AutoDsProductCollectionResult>;
  listProducts(query?: AutoDsProductListQuery): Promise<AutoDsProductCollectionResult>;
  health(): Promise<AutoDsClientHealth>;
}
