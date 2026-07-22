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

export class FakeSupplierProvider implements SupplierProvider {
  public readonly id = "fake";
  private readonly products = new Map<string, SupplierProduct>();
  private readonly now: () => string;

  public constructor(input: {
    readonly products?: readonly SupplierProduct[];
    readonly now?: () => string;
  } = {}) {
    this.now = input.now ?? (() => new Date().toISOString());
    for (const product of input.products ?? [createFakeSupplierProduct()]) {
      this.products.set(product.externalProductId, clone(product));
    }
  }

  public connect(request: {
    readonly tenant: TenantContext;
    readonly credentialsReference: SupplierCredentialsReference;
  }): Promise<SupplierProviderResult<AutoDSConnection>> {
    const timestamp = this.now();
    return Promise.resolve(ok({
      id: `supplier-connection:${request.tenant.tenantId}:${request.tenant.storeId}:${this.id}`,
      tenantId: request.tenant.tenantId,
      storeId: request.tenant.storeId,
      ...(request.tenant.shopDomain === undefined ? {} : { shopDomain: request.tenant.shopDomain }),
      supplierProvider: this.id,
      status: "CONNECTED",
      credentialsReference: request.credentialsReference,
      capabilities: this.supportedCapabilities(),
      health: this.healthSnapshot("ONLINE"),
      connectedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }

  public disconnect(tenant: TenantContext): Promise<SupplierProviderResult<AutoDSConnection>> {
    const timestamp = this.now();
    return Promise.resolve(ok({
      id: `supplier-connection:${tenant.tenantId}:${tenant.storeId}:${this.id}`,
      tenantId: tenant.tenantId,
      storeId: tenant.storeId,
      ...(tenant.shopDomain === undefined ? {} : { shopDomain: tenant.shopDomain }),
      supplierProvider: this.id,
      status: "DISCONNECTED",
      capabilities: this.supportedCapabilities(),
      health: this.healthSnapshot("UNKNOWN"),
      disconnectedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }

  public health(): Promise<SupplierProviderResult<SupplierHealth>> {
    return Promise.resolve(ok(this.healthSnapshot("ONLINE")));
  }

  public importProducts(request: { readonly externalProductIds?: readonly string[] }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(ok(this.selectProducts(request.externalProductIds)));
  }

  public getProduct(request: { readonly externalProductId: string }): Promise<SupplierProviderResult<SupplierProduct>> {
    const product = this.products.get(request.externalProductId);
    return Promise.resolve(product === undefined
      ? failed("SUPPLIER_PRODUCT_NOT_FOUND", "Supplier product was not found.", false)
      : ok(clone(product)));
  }

  public syncInventory(request: { readonly externalProductIds?: readonly string[]; readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(ok(this.selectProducts(request.externalProductIds)));
  }

  public syncPricing(request: { readonly externalProductIds?: readonly string[]; readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(ok(this.selectProducts(request.externalProductIds)));
  }

  public syncMedia(request: { readonly externalProductIds?: readonly string[]; readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(ok(this.selectProducts(request.externalProductIds)));
  }

  public syncShipping(request: { readonly externalProductIds?: readonly string[]; readonly syncType: SupplierSyncType }): Promise<SupplierProviderResult<readonly SupplierProduct[]>> {
    return Promise.resolve(ok(this.selectProducts(request.externalProductIds)));
  }

  public supportedCapabilities(): readonly SupplierCapability[] {
    return ["product_import", "inventory_sync", "pricing_sync", "media_sync", "shipping_sync"];
  }

  private selectProducts(externalProductIds: readonly string[] | undefined): readonly SupplierProduct[] {
    if (externalProductIds === undefined || externalProductIds.length === 0) {
      return [...this.products.values()].map((product) => clone(product));
    }

    return externalProductIds
      .map((externalProductId) => this.products.get(externalProductId))
      .filter((product): product is SupplierProduct => product !== undefined)
      .map((product) => clone(product));
  }

  private healthSnapshot(status: SupplierHealth["status"]): SupplierHealth {
    return {
      status,
      checkedAt: this.now(),
      capabilities: this.supportedCapabilities(),
    };
  }
}

export function createFakeSupplierProduct(overrides: Partial<SupplierProduct> = {}): SupplierProduct {
  return {
    externalProductId: "fake-product-001",
    sourcePlatform: "generic",
    supplierName: "Deterministic Supplier",
    supplierUrl: "https://supplier.example/products/fake-product-001",
    title: "Lumora Velvet Glow Body Lotion",
    description: "A premium botanical body lotion for soft, luminous skin.",
    brand: "Lumora Beauty",
    category: "Body Care",
    productType: "Body Lotion",
    media: [{ url: "https://cdn.example.test/lumora-lotion.jpg", altText: "Lumora lotion bottle", position: 1 }],
    variants: [{
      externalVariantId: "fake-variant-001",
      sku: "LUMORA-LOTION-001",
      title: "Default Title",
      pricing: { supplierPrice: 12, compareAtPrice: 32, currency: "USD" },
      inventory: { available: true, quantity: 50 },
      optionValues: { Size: "250 ml" },
    }],
    pricing: { supplierPrice: 12, compareAtPrice: 32, currency: "USD" },
    inventory: { available: true, quantity: 50 },
    shipping: { origin: "US", destinations: ["US", "MY"], estimatedDelivery: { minDays: 5, maxDays: 12 } },
    tags: ["beauty", "body-care"],
    rawMetadata: { deterministic: true },
    ...overrides,
  };
}

function ok<T>(value: T): SupplierProviderResult<T> {
  return { ok: true, value, warnings: [] };
}

function failed<T>(code: string, message: string, retryable: boolean): SupplierProviderResult<T> {
  return { ok: false, warnings: [], failure: { code, message, retryable } };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
