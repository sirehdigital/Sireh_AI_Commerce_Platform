import type {
  CommerceConsoleArguments,
  CommerceConsoleBrandConfigName,
  CommerceConsoleFormat,
} from "./commerce-console.types.js";
import { CommerceConsoleArgumentError } from "./commerce-console.errors.js";
import type { ShopifyDraftPreparationInput } from "../workflows/shopify-draft-preparation/index.js";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/u;
const PRODUCT_GID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/u;
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;

export const parseCommerceConsoleArguments = (argv: readonly string[]): CommerceConsoleArguments => {
  const flags = toFlagMap(argv);
  const shop = requireFlag(flags, "shop");
  const productId = flags.get("product-id");
  const handle = flags.get("handle");
  const brandConfig = flags.get("brand-config") ?? "lumora";
  const format = flags.get("format") ?? "summary";

  if (!SHOP_DOMAIN_PATTERN.test(shop)) {
    throw new CommerceConsoleArgumentError("--shop must be a normalized *.myshopify.com domain.");
  }

  if ((productId === undefined && handle === undefined) || (productId !== undefined && handle !== undefined)) {
    throw new CommerceConsoleArgumentError("Provide exactly one of --product-id or --handle.");
  }

  if (productId !== undefined && !PRODUCT_GID_PATTERN.test(productId)) {
    throw new CommerceConsoleArgumentError("--product-id must be an exact Shopify product GID.");
  }

  if (handle !== undefined && !HANDLE_PATTERN.test(handle)) {
    throw new CommerceConsoleArgumentError("--handle must be an exact Shopify product handle.");
  }

  if (!isBrandConfig(brandConfig)) {
    throw new CommerceConsoleArgumentError(`Unsupported --brand-config value: ${brandConfig}.`);
  }

  if (!isFormat(format)) {
    throw new CommerceConsoleArgumentError("--format must be either summary or json.");
  }

  return {
    shop: shop as `${string}.myshopify.com`,
    productLocator:
      productId === undefined
        ? { kind: "handle", handle: handle! }
        : { kind: "product-id", productId },
    brandConfig,
    format,
  };
};

export const toShopifyDraftPreparationInput = (
  args: CommerceConsoleArguments,
): ShopifyDraftPreparationInput => ({
  executionMode: "shopify-draft-preparation",
  shopDomain: args.shop,
  productLocator: args.productLocator,
  brandContext: resolveBrandContext(args.brandConfig),
  requestedCapabilities: {
    normalize: true,
    analyze: true,
    assessRisk: true,
    generateBranding: true,
    generateCopy: true,
    recommendPricing: true,
    mapForShopify: true,
    prepareSafeUpdateProposal: true,
  },
});

const resolveBrandContext = (brandConfig: CommerceConsoleBrandConfigName) => {
  switch (brandConfig) {
    case "lumora":
      return {
        brandName: "Lumora Beauty",
        brandVoice: "premium",
        targetMarkets: ["MY"] as const,
        sellingCurrency: "MYR" as const,
        preferredCollections: ["Hair Wellness"] as const,
        templateSuffix: "velvetglow",
      };
  }
};

const toFlagMap = (argv: readonly string[]): ReadonlyMap<string, string> => {
  const flags = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new CommerceConsoleArgumentError(`Missing value for --${key}.`);
    }

    flags.set(key, value);
    index += 1;
  }

  return flags;
};

const requireFlag = (flags: ReadonlyMap<string, string>, key: string): string => {
  const value = flags.get(key);

  if (value === undefined || value.trim().length === 0) {
    throw new CommerceConsoleArgumentError(`Missing required --${key}.`);
  }

  return value.trim();
};

const isBrandConfig = (value: string): value is CommerceConsoleBrandConfigName => value === "lumora";

const isFormat = (value: string): value is CommerceConsoleFormat => value === "summary" || value === "json";
