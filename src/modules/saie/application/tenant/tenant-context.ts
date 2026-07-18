export interface TenantContext {
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
}

export const DEFAULT_TENANT_CONTEXT: TenantContext = Object.freeze({
  tenantId: "tenant-default",
  storeId: "store-default",
});

export const TENANT_CONTEXT_HEADERS = Object.freeze({
  tenantId: "x-saie-tenant-id",
  storeId: "x-saie-store-id",
  shopDomain: "x-saie-shop-domain",
});

const MAX_CONTEXT_ID_LENGTH = 80;
const SAFE_CONTEXT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/u;
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/u;

export class TenantContextValidationError extends Error {
  public constructor(
    public readonly field: "tenantId" | "storeId" | "shopDomain",
    message: string,
  ) {
    super(message);
    this.name = "TenantContextValidationError";
  }
}

export const normalizeTenantContextId = (
  value: string,
  field: "tenantId" | "storeId",
): string => {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_CONTEXT_ID_LENGTH ||
    !SAFE_CONTEXT_ID_PATTERN.test(normalized)
  ) {
    throw new TenantContextValidationError(
      field,
      `${field} must be a safe identifier of ${MAX_CONTEXT_ID_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
};

export const normalizeOptionalShopDomain = (
  value: string | undefined,
): `${string}.myshopify.com` | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }

  if (!SHOP_DOMAIN_PATTERN.test(normalized)) {
    throw new TenantContextValidationError(
      "shopDomain",
      "shopDomain must be a normalized *.myshopify.com domain.",
    );
  }

  return normalized as `${string}.myshopify.com`;
};

export const createTenantContext = (input: {
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: string | undefined;
}): TenantContext => {
  const tenantId = normalizeTenantContextId(input.tenantId, "tenantId");
  const storeId = normalizeTenantContextId(input.storeId, "storeId");
  const shopDomain = normalizeOptionalShopDomain(input.shopDomain);

  return Object.freeze({
    tenantId,
    storeId,
    ...(shopDomain === undefined ? {} : { shopDomain }),
  });
};

export const sameTenantStore = (left: TenantContext, right: TenantContext): boolean =>
  left.tenantId === right.tenantId && left.storeId === right.storeId;

export const tenantContextKey = (context: TenantContext): string =>
  `${context.tenantId}:${context.storeId}`;

export const copyTenantContext = (context: TenantContext): TenantContext =>
  Object.freeze({
    tenantId: context.tenantId,
    storeId: context.storeId,
    ...(context.shopDomain === undefined ? {} : { shopDomain: context.shopDomain }),
  });

