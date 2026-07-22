import type { TenantContext } from "../../../saie/application/index.js";
import type { SupplierProvider } from "../../application/providers/supplier-provider.js";
import type {
  AutoDSConnection,
  SupplierCapability,
  SupplierCredentialsReference,
  SupplierHealth,
  SupplierProduct,
  SupplierProviderResult,
  SupplierSyncType,
} from "../../domain/models/supplier-integration.model.js";

export class AutoDSProvider implements SupplierProvider {
  public readonly id = "autods";

  public constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  public connect(request: {
    readonly tenant: TenantContext;
    readonly credentialsReference: SupplierCredentialsReference;
  }): Promise<SupplierProviderResult<AutoDSConnection>> {
    const timestamp = this.now();
    return Promise.resolve({
      ok: true,
      warnings: ["AutoDS live API calls are not enabled until a documented AutoDS client contract is configured."],
      value: {
        id: `supplier-connection:${request.tenant.tenantId}:${request.tenant.storeId}:${this.id}`,
        tenantId: request.tenant.tenantId,
        storeId: request.tenant.storeId,
        ...(request.tenant.shopDomain === undefined ? {} : { shopDomain: request.tenant.shopDomain }),
        supplierProvider: this.id,
        status: "CONNECTED",
        credentialsReference: request.credentialsReference,
        capabilities: this.supportedCapabilities(),
        health: this.unknownHealth(),
        connectedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
  }

  public disconnect(tenant: TenantContext): Promise<SupplierProviderResult<AutoDSConnection>> {
    const timestamp = this.now();
    return Promise.resolve({
      ok: true,
      warnings: [],
      value: {
        id: `supplier-connection:${tenant.tenantId}:${tenant.storeId}:${this.id}`,
        tenantId: tenant.tenantId,
        storeId: tenant.storeId,
        ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
        supplierProvider: this.id,
        status: "DISCONNECTED",
        capabilities: this.supportedCapabilities(),
        health: this.unknownHealth(),
        disconnectedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
  }

  public health(): Promise<SupplierProviderResult<SupplierHealth>> {
    return Promise.resolve({
      ok: true,
      warnings: ["AutoDS provider boundary is configured without undocumented network calls."],
      value: this.unknownHealth(),
    });
  }

  public importProducts(): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(notConfigured("AUTODS_CLIENT_NOT_CONFIGURED", "AutoDS import requires a documented AutoDS client integration."));
  }

  public getProduct(): Promise<SupplierProviderResult<SupplierProduct>> {
    return Promise.resolve(notConfigured("AUTODS_CLIENT_NOT_CONFIGURED", "AutoDS product lookup requires a documented AutoDS client integration."));
  }

  public syncInventory(request: { readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(notConfigured("AUTODS_CLIENT_NOT_CONFIGURED", `AutoDS ${request.syncType} sync requires a documented AutoDS client integration.`));
  }

  public syncPricing(request: { readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(notConfigured("AUTODS_CLIENT_NOT_CONFIGURED", `AutoDS ${request.syncType} sync requires a documented AutoDS client integration.`));
  }

  public syncMedia(request: { readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(notConfigured("AUTODS_CLIENT_NOT_CONFIGURED", `AutoDS ${request.syncType} sync requires a documented AutoDS client integration.`));
  }

  public syncShipping(request: { readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(notConfigured("AUTODS_CLIENT_NOT_CONFIGURED", `AutoDS ${request.syncType} sync requires a documented AutoDS client integration.`));
  }

  public supportedCapabilities(): readonly SupplierCapability[] {
    return ["product_import", "inventory_sync", "pricing_sync", "media_sync", "shipping_sync"];
  }

  private unknownHealth(): SupplierHealth {
    return {
      status: "UNKNOWN",
      checkedAt: this.now(),
      capabilities: this.supportedCapabilities(),
    };
  }
}

function notConfigured<T>(code: string, message: string): SupplierProviderResult<T> {
  return {
    ok: false,
    warnings: [],
    failure: {
      code,
      message,
      retryable: false,
    },
  };
}
