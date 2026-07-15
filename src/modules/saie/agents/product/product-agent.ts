import type { SAIEAgentDefinition } from "../../types/index.js";
import { PRODUCT_AGENT_PORT_IDENTIFIERS } from "./product-agent.ports.js";
import { createProductAgentSteps } from "./product-agent.steps.js";
import type {
  ProductAgentInput,
  ProductAgentOutput,
  ProductAgentRequestedCapabilities,
  ProductAgentStep,
} from "./product-agent.types.js";
import { ProductAgentInputValidationError } from "./product-agent.types.js";

const SHOPIFY_PRODUCT_ID_PATTERN = /^gid:\/\/shopify\/Product\/\d+$/u;
const SHOPIFY_HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/u;

const PRODUCT_AGENT_SAFETY_WARNINGS = [
  "No direct publication is allowed.",
  "No product deletion is allowed.",
  "No product recreation is allowed.",
  "No variant recreation is allowed.",
  "No SKU changes are allowed.",
  "No inventory item changes are allowed.",
  "No fulfillment or supplier linkage changes are allowed.",
  "No inventory quantity or location changes are allowed.",
  "No mutation is allowed in plan-only mode.",
  "Human approval is mandatory before any future execution.",
] as const;

export const PRODUCT_AGENT_DEFINITION: SAIEAgentDefinition = {
  type: "ProductAgent",
  name: "Product Agent",
  description:
    "Creates deterministic product orchestration plans around existing SACP product services without executing them.",
  capabilities: [
    "product-analysis",
    "product-risk-assessment",
    "brand-positioning",
    "copy-planning",
    "pricing-planning",
    "shopify-mapping",
    "safe-update-planning",
  ],
  implementationStatus: "planner-only",
};

export class ProductAgent {
  public readonly definition = PRODUCT_AGENT_DEFINITION;

  public planFromPayload(
    payload: Readonly<Record<string, unknown>>,
    generatedAt: Date = new Date(),
  ): ProductAgentOutput {
    return this.plan(parseProductAgentInput(payload), generatedAt);
  }

  public plan(input: ProductAgentInput, generatedAt: Date = new Date()): ProductAgentOutput {
    const validated = validateProductAgentInput(input);
    const orderedSteps = createProductAgentSteps(validated.requestedCapabilities);

    return {
      agentType: "ProductAgent",
      executionMode: validated.executionMode,
      workflowId: "saie-product-agent-plan",
      orderedSteps,
      requiredPorts: collectRequiredPorts(orderedSteps),
      requestedCapabilities: { ...validated.requestedCapabilities },
      safetyWarnings: [...PRODUCT_AGENT_SAFETY_WARNINGS],
      readyForExecution: false,
      generatedAt: generatedAt.toISOString(),
    };
  }
}

export const parseProductAgentInput = (
  payload: Readonly<Record<string, unknown>>,
): ProductAgentInput => {
  const productReference = asRecord(payload.productReference, "Product reference is required.");
  const brand = asRecord(payload.brand, "Brand input is required.");
  const requestedCapabilities = asRecord(
    payload.requestedCapabilities,
    "Requested capabilities are required.",
  );
  const market = asStringArray(brand.market);

  if (market === null) {
    throw new ProductAgentInputValidationError("Brand market must be a readonly string array.");
  }

  return {
    productReference: {
      kind: asProductReferenceKind(productReference.kind),
      value: asString(productReference.value, "Product reference value is required."),
    },
    brand: {
      name: asString(brand.name, "Brand name is required."),
      market: [...market],
      currency: asString(brand.currency, "Brand currency is required."),
    },
    requestedCapabilities: {
      analyzeProduct: asBoolean(requestedCapabilities.analyzeProduct, "analyzeProduct"),
      assessRisk: asBoolean(requestedCapabilities.assessRisk, "assessRisk"),
      generateBranding: asBoolean(requestedCapabilities.generateBranding, "generateBranding"),
      generateCopy: asBoolean(requestedCapabilities.generateCopy, "generateCopy"),
      recommendPricing: asBoolean(requestedCapabilities.recommendPricing, "recommendPricing"),
      mapForShopify: asBoolean(requestedCapabilities.mapForShopify, "mapForShopify"),
      prepareSafeUpdate: asBoolean(requestedCapabilities.prepareSafeUpdate, "prepareSafeUpdate"),
    },
    executionMode: asExecutionMode(payload.executionMode),
  };
};

export const validateProductAgentInput = (input: ProductAgentInput): ProductAgentInput => {
  if (input.executionMode !== "plan-only") {
    throw new ProductAgentInputValidationError("Product Agent only supports plan-only execution mode.");
  }

  validateProductReference(input);
  validateBrand(input);
  validateCapabilities(input.requestedCapabilities);

  return {
    productReference: { ...input.productReference },
    brand: {
      ...input.brand,
      market: [...input.brand.market],
    },
    requestedCapabilities: { ...input.requestedCapabilities },
    executionMode: input.executionMode,
  };
};

const asRecord = (value: unknown, message: string): Readonly<Record<string, unknown>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProductAgentInputValidationError(message);
  }

  return value as Readonly<Record<string, unknown>>;
};

const asString = (value: unknown, message: string): string => {
  if (typeof value !== "string") {
    throw new ProductAgentInputValidationError(message);
  }

  return value;
};

const asBoolean = (value: unknown, capability: string): boolean => {
  if (typeof value !== "boolean") {
    throw new ProductAgentInputValidationError(
      `Requested capability ${capability} must be an explicit boolean.`,
    );
  }

  return value;
};

const asStringArray = (value: unknown): readonly string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    strings.push(item);
  }

  return strings;
};

const asProductReferenceKind = (value: unknown): ProductAgentInput["productReference"]["kind"] => {
  if (value === "shopify-product-id" || value === "shopify-handle" || value === "supplier-url") {
    return value;
  }

  throw new ProductAgentInputValidationError("Product reference kind is unsupported.");
};

const asExecutionMode = (value: unknown): ProductAgentInput["executionMode"] => {
  if (value === "plan-only") {
    return value;
  }

  throw new ProductAgentInputValidationError("Product Agent only supports plan-only execution mode.");
};

const validateProductReference = (input: ProductAgentInput): void => {
  const { kind, value } = input.productReference;
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new ProductAgentInputValidationError("Product reference value is required.");
  }

  if (kind === "shopify-product-id" && !SHOPIFY_PRODUCT_ID_PATTERN.test(normalizedValue)) {
    throw new ProductAgentInputValidationError("Shopify product ID must be a Shopify Product GID.");
  }

  if (kind === "shopify-handle" && !SHOPIFY_HANDLE_PATTERN.test(normalizedValue)) {
    throw new ProductAgentInputValidationError("Shopify handle must be a lowercase URL handle.");
  }

  if (kind === "supplier-url") {
    validateSupplierUrl(normalizedValue);
  }
};

const validateSupplierUrl = (value: string): void => {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "https:") {
      throw new ProductAgentInputValidationError("Supplier URL must use HTTPS.");
    }
  } catch (error) {
    if (error instanceof ProductAgentInputValidationError) {
      throw error;
    }

    throw new ProductAgentInputValidationError("Supplier URL must be a valid URL.");
  }
};

const validateBrand = (input: ProductAgentInput): void => {
  if (input.brand.name.trim().length === 0) {
    throw new ProductAgentInputValidationError("Brand name is required.");
  }

  if (input.brand.market.length === 0 || input.brand.market.some((market) => market.trim().length === 0)) {
    throw new ProductAgentInputValidationError("At least one brand market is required.");
  }

  if (!ISO_CURRENCY_PATTERN.test(input.brand.currency)) {
    throw new ProductAgentInputValidationError("Brand currency must be a three-letter uppercase ISO code.");
  }
};

const validateCapabilities = (capabilities: ProductAgentRequestedCapabilities): void => {
  const capabilityValues: readonly boolean[] = [
    capabilities.analyzeProduct,
    capabilities.assessRisk,
    capabilities.generateBranding,
    capabilities.generateCopy,
    capabilities.recommendPricing,
    capabilities.mapForShopify,
    capabilities.prepareSafeUpdate,
  ];

  if (capabilityValues.some((value) => typeof value !== "boolean")) {
    throw new ProductAgentInputValidationError("Requested capabilities must be explicit booleans.");
  }
};

const collectRequiredPorts = (steps: readonly ProductAgentStep[]): readonly ProductAgentOutput["requiredPorts"][number][] => {
  const ports = steps.map((step) => step.requiredPort);

  return PRODUCT_AGENT_PORT_IDENTIFIERS.filter((port) => ports.includes(port));
};
