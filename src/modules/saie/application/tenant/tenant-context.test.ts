import { describe, expect, it } from "vitest";

import {
  DEFAULT_TENANT_CONTEXT,
  ProcessLocalTenantRegistry,
  TenantContextValidationError,
  createTenantContext,
} from "./index.js";

describe("SAIE tenant context", () => {
  it("normalizes valid tenant, store, and shop domain values", () => {
    expect(
      createTenantContext({
        tenantId: " Tenant-A ",
        storeId: " Store-A ",
        shopDomain: "SHOP-A.myshopify.com",
      }),
    ).toEqual({
      tenantId: "tenant-a",
      storeId: "store-a",
      shopDomain: "shop-a.myshopify.com",
    });
  });

  it("rejects malformed identifiers and full shop URLs", () => {
    expect(() => createTenantContext({ tenantId: "bad tenant", storeId: "store-a" })).toThrow(
      TenantContextValidationError,
    );
    expect(() =>
      createTenantContext({
        tenantId: "tenant-a",
        storeId: "store-a",
        shopDomain: "https://shop-a.myshopify.com",
      }),
    ).toThrow(TenantContextValidationError);
  });

  it("returns defensive copies from process-local registry", () => {
    const registry = new ProcessLocalTenantRegistry([DEFAULT_TENANT_CONTEXT]);
    const resolved = registry.resolveTenant(DEFAULT_TENANT_CONTEXT);

    expect(resolved).toEqual(DEFAULT_TENANT_CONTEXT);
    expect(registry.listConfiguredContexts()).toEqual([DEFAULT_TENANT_CONTEXT]);
    expect(resolved).not.toBe(DEFAULT_TENANT_CONTEXT);
  });
});

