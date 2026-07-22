import type { TenantContext } from "../../../saie/application/index.js";
import type {
  AutoDSConnection,
  SupplierCapability,
  SupplierCredentialsReference,
  SupplierHealth,
  SupplierProduct,
  SupplierProviderId,
  SupplierProviderResult,
  SupplierSyncType,
} from "../../domain/models/supplier-integration.model.js";

export interface SupplierProviderConnectionRequest {
  readonly tenant: TenantContext;
  readonly credentialsReference: SupplierCredentialsReference;
}

export interface SupplierProviderProductRequest {
  readonly tenant: TenantContext;
  readonly externalProductIds?: readonly string[];
}

export interface SupplierProviderSyncRequest extends SupplierProviderProductRequest {
  readonly syncType: SupplierSyncType;
}

export interface SupplierProvider {
  readonly id: SupplierProviderId;
  connect(request: SupplierProviderConnectionRequest): Promise<SupplierProviderResult<AutoDSConnection>>;
  disconnect(tenant: TenantContext): Promise<SupplierProviderResult<AutoDSConnection>>;
  health(tenant: TenantContext): Promise<SupplierProviderResult<SupplierHealth>>;
  importProducts(request: SupplierProviderProductRequest): Promise<SupplierProviderResult<readonly SupplierProduct[]>>;
  getProduct(request: SupplierProviderProductRequest & { readonly externalProductId: string }): Promise<SupplierProviderResult<SupplierProduct>>;
  syncInventory(request: SupplierProviderSyncRequest): Promise<SupplierProviderResult<readonly SupplierProduct[]>>;
  syncPricing(request: SupplierProviderSyncRequest): Promise<SupplierProviderResult<readonly SupplierProduct[]>>;
  syncMedia(request: SupplierProviderSyncRequest): Promise<SupplierProviderResult<readonly SupplierProduct[]>>;
  syncShipping(request: SupplierProviderSyncRequest): Promise<SupplierProviderResult<readonly SupplierProduct[]>>;
  supportedCapabilities(): readonly SupplierCapability[];
}
