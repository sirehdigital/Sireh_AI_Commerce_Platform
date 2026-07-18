import {
  copyTenantContext,
  createTenantContext,
  DEFAULT_TENANT_CONTEXT,
  type TenantContext,
  tenantContextKey,
} from "./tenant-context.js";

export class DuplicateTenantContextError extends Error {
  public constructor(context: TenantContext) {
    super(`Tenant context ${tenantContextKey(context)} is already configured.`);
    this.name = "DuplicateTenantContextError";
  }
}

export class ProcessLocalTenantRegistry {
  private readonly contextsByKey: ReadonlyMap<string, TenantContext>;

  public constructor(contexts: readonly TenantContext[] = [DEFAULT_TENANT_CONTEXT]) {
    const records = new Map<string, TenantContext>();

    for (const context of contexts) {
      const normalized = createTenantContext(context);
      const key = tenantContextKey(normalized);

      if (records.has(key)) {
        throw new DuplicateTenantContextError(normalized);
      }

      records.set(key, normalized);
    }

    this.contextsByKey = records;
  }

  public resolveTenant(input: {
    readonly tenantId: string;
    readonly storeId: string;
    readonly shopDomain?: string | undefined;
  }): TenantContext {
    const candidate = createTenantContext(input);
    const configured = this.contextsByKey.get(tenantContextKey(candidate));

    if (configured !== undefined) {
      if (candidate.shopDomain !== undefined && configured.shopDomain !== candidate.shopDomain) {
        return copyTenantContext(candidate);
      }

      return copyTenantContext(configured);
    }

    return copyTenantContext(candidate);
  }

  public listConfiguredContexts(): readonly TenantContext[] {
    return [...this.contextsByKey.values()].map((context) => copyTenantContext(context));
  }
}

