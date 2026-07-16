import type { SAIEAgentDefinition } from "../../types/index.js";
import { MARKETING_AGENT_PORT_IDENTIFIERS } from "./marketing-agent.ports.js";
import { createMarketingAgentSteps } from "./marketing-agent.steps.js";
import type {
  MarketingAgentBrandContext,
  MarketingAgentInput,
  MarketingAgentOutput,
  MarketingAgentPreparedProductContext,
  MarketingAgentStep,
  MarketingBudgetTier,
  MarketingProposal,
} from "./marketing-agent.types.js";
import { MarketingAgentInputValidationError } from "./marketing-agent.types.js";

const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/u;

const MARKETING_AGENT_SAFETY_WARNINGS = [
  "Proposal only; no campaign execution is supported.",
  "No external marketing platform API is called.",
  "No Shopify mutation is performed.",
  "No email, ad, social post, marketplace action, or AutoDS action is produced.",
  "Human approval is mandatory before any future execution outside SAIE.",
] as const;

export const MARKETING_AGENT_DEFINITION: SAIEAgentDefinition = {
  type: "MarketingAgent",
  name: "Marketing Agent",
  description:
    "Creates deterministic proposal-only marketing plans from prepared product and brand context.",
  capabilities: ["marketing-planning"],
  implementationStatus: "planner-only",
};

export class MarketingAgent {
  public readonly definition = MARKETING_AGENT_DEFINITION;

  public planFromPayload(
    payload: Readonly<Record<string, unknown>>,
    generatedAt: Date = new Date(),
  ): MarketingAgentOutput {
    return this.plan(parseMarketingAgentInput(payload), generatedAt);
  }

  public plan(input: MarketingAgentInput, generatedAt: Date = new Date()): MarketingAgentOutput {
    const validated = validateMarketingAgentInput(input);
    const orderedSteps = createMarketingAgentSteps();

    return {
      agentType: "MarketingAgent",
      executionMode: "proposal-only",
      workflowId: "saie-marketing-agent-plan",
      orderedSteps,
      requiredPorts: collectRequiredPorts(orderedSteps),
      proposal: createMarketingProposal(validated),
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
      safetyWarnings: [...MARKETING_AGENT_SAFETY_WARNINGS],
      generatedAt: generatedAt.toISOString(),
    };
  }
}

export const parseMarketingAgentInput = (
  payload: Readonly<Record<string, unknown>>,
): MarketingAgentInput => {
  const product = asRecord(payload.product, "Prepared product context is required.");
  const brand = asRecord(payload.brand, "Brand context is required.");
  const category = optionalString(product.category);
  const productType = optionalString(product.productType);
  const keyBenefits = optionalStringArray(product.keyBenefits);
  const keyFeatures = optionalStringArray(product.keyFeatures);
  const price = optionalNumber(product.price);
  const productCurrency = optionalString(product.currency);
  const positioning = optionalString(brand.positioning);
  const tone = optionalString(brand.tone);

  return {
    product: {
      title: asString(product.title, "Product title is required."),
      description: asString(product.description, "Product description is required."),
      ...(category === undefined ? {} : { category }),
      ...(productType === undefined ? {} : { productType }),
      tags: asStringArray(product.tags, "Product tags must be a readonly string array."),
      targetMarkets: asStringArray(
        product.targetMarkets,
        "Product target markets must be a readonly string array.",
      ),
      ...(keyBenefits === undefined ? {} : { keyBenefits }),
      ...(keyFeatures === undefined ? {} : { keyFeatures }),
      ...(price === undefined ? {} : { price }),
      ...(productCurrency === undefined ? {} : { currency: productCurrency }),
    },
    brand: {
      name: asString(brand.name, "Brand name is required."),
      market: asStringArray(brand.market, "Brand market must be a readonly string array."),
      currency: asString(brand.currency, "Brand currency is required."),
      ...(positioning === undefined ? {} : { positioning }),
      ...(tone === undefined ? {} : { tone }),
    },
    executionMode: asExecutionMode(payload.executionMode),
  };
};

export const validateMarketingAgentInput = (input: MarketingAgentInput): MarketingAgentInput => {
  if (input.executionMode !== "proposal-only") {
    throw new MarketingAgentInputValidationError(
      "Marketing Agent only supports proposal-only execution mode.",
    );
  }

  validateProduct(input.product);
  validateBrand(input.brand);

  return {
    product: {
      ...input.product,
      tags: [...input.product.tags],
      targetMarkets: [...input.product.targetMarkets],
      ...(input.product.keyBenefits === undefined ? {} : { keyBenefits: [...input.product.keyBenefits] }),
      ...(input.product.keyFeatures === undefined ? {} : { keyFeatures: [...input.product.keyFeatures] }),
    },
    brand: {
      ...input.brand,
      market: [...input.brand.market],
    },
    executionMode: input.executionMode,
  };
};

const createMarketingProposal = (input: MarketingAgentInput): MarketingProposal => {
  const product = input.product;
  const brand = input.brand;
  const primaryMarket = product.targetMarkets[0] ?? brand.market[0] ?? "GLOBAL";
  const primaryBenefit = product.keyBenefits?.[0] ?? product.tags[0] ?? "practical value";
  const category = product.category ?? product.productType ?? "commerce product";
  const tone = brand.tone ?? "clear, confident, and customer-first";

  return {
    campaignObjective: `Validate demand for ${product.title} in ${primaryMarket} before any scaled execution.`,
    targetAudience: `${primaryMarket} shoppers interested in ${category} from ${brand.name}.`,
    audiencePainPoints: buildPainPoints(product),
    valueProposition: `${product.title} helps customers get ${primaryBenefit} with a ${tone} brand experience.`,
    recommendedChannels: buildRecommendedChannels(product, brand),
    campaignMessage: `${brand.name} presents ${product.title}: ${firstSentence(product.description)}`,
    contentThemes: buildContentThemes(product, brand),
    contentFormats: ["short-form video concept", "product benefit carousel", "landing-page copy block"],
    budgetRecommendation: {
      tier: resolveBudgetTier(product),
      currency: product.currency ?? brand.currency,
      recommendedTestBudget: resolveRecommendedBudget(product),
      notes: [
        "Use a controlled test budget until product-market signal is reviewed.",
        "Do not spend automatically; budget requires human approval.",
      ],
    },
    kpiRecommendations: [
      { name: "Click-through rate", target: "Review after first controlled campaign test." },
      { name: "Add-to-cart rate", target: "Compare against store baseline before scaling." },
      { name: "Cost per qualified visit", target: "Keep within approved test-budget threshold." },
    ],
    risksOrCautions: buildRisksOrCautions(product),
    approvalRequirement:
      "Human approval is required before publishing, posting, sending, spending, or mutating any external system.",
  };
};

const buildPainPoints = (product: MarketingAgentPreparedProductContext): readonly string[] => {
  const benefits = product.keyBenefits ?? [];
  if (benefits.length > 0) {
    return benefits.slice(0, 3).map((benefit) => `Customer needs a clearer path to ${benefit}.`);
  }

  return [
    "Customer may not immediately understand the product value.",
    "Customer may compare alternatives before trusting a new brand.",
    "Customer may need reassurance before purchase.",
  ];
};

const buildRecommendedChannels = (
  product: MarketingAgentPreparedProductContext,
  brand: MarketingAgentBrandContext,
): readonly string[] => {
  const markets = new Set([...product.targetMarkets, ...brand.market].map((market) => market.toUpperCase()));

  if (markets.has("MY")) {
    return ["TikTok organic concept", "Instagram product education", "Shopify landing-page merchandising"];
  }

  if (markets.has("US") || markets.has("UK") || markets.has("AU")) {
    return ["Meta creative test", "TikTok organic concept", "Email campaign draft"];
  }

  return ["Shopify landing-page merchandising", "Social content concept", "Email campaign draft"];
};

const buildContentThemes = (
  product: MarketingAgentPreparedProductContext,
  brand: MarketingAgentBrandContext,
): readonly string[] => {
  const featureTheme = product.keyFeatures?.[0] ?? product.tags[0] ?? "product differentiation";

  return [
    `${brand.name} brand promise`,
    `${product.title} core benefit`,
    `${featureTheme} education`,
  ];
};

const buildRisksOrCautions = (product: MarketingAgentPreparedProductContext): readonly string[] => {
  const cautions = [
    "Do not publish, post, email, or spend without explicit human approval.",
    "Validate product claims before using them in paid or public marketing.",
  ];

  if (product.price !== undefined && product.price <= 0) {
    return [...cautions, "Price context is present but not usable for budget or offer positioning."];
  }

  return cautions;
};

const resolveBudgetTier = (product: MarketingAgentPreparedProductContext): MarketingBudgetTier => {
  if (product.price === undefined || product.price < 40) {
    return "lean-test";
  }

  if (product.price < 150) {
    return "validation";
  }

  return "scale-ready";
};

const resolveRecommendedBudget = (product: MarketingAgentPreparedProductContext): number => {
  if (product.price === undefined || product.price < 40) {
    return 150;
  }

  if (product.price < 150) {
    return 300;
  }

  return 500;
};

const firstSentence = (description: string): string => {
  const [sentence] = description.trim().split(".");
  return sentence === undefined || sentence.length === 0 ? description.trim() : `${sentence}.`;
};

const asRecord = (value: unknown, message: string): Readonly<Record<string, unknown>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MarketingAgentInputValidationError(message);
  }

  return value as Readonly<Record<string, unknown>>;
};

const asString = (value: unknown, message: string): string => {
  if (typeof value !== "string") {
    throw new MarketingAgentInputValidationError(message);
  }

  return value;
};

const asStringArray = (value: unknown, message: string): readonly string[] => {
  const strings = optionalStringArray(value);
  if (strings === undefined) {
    throw new MarketingAgentInputValidationError(message);
  }

  return strings;
};

const optionalString = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new MarketingAgentInputValidationError("Optional string fields must be strings when supplied.");
  }

  return value;
};

const optionalStringArray = (value: unknown): readonly string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new MarketingAgentInputValidationError("Optional string array fields must contain only strings.");
  }

  const strings: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      throw new MarketingAgentInputValidationError("Optional string array fields must contain only strings.");
    }

    strings.push(item);
  }

  return strings;
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MarketingAgentInputValidationError("Optional numeric fields must be finite numbers.");
  }

  return value;
};

const asExecutionMode = (value: unknown): MarketingAgentInput["executionMode"] => {
  if (value === "proposal-only") {
    return value;
  }

  throw new MarketingAgentInputValidationError(
    "Marketing Agent only supports proposal-only execution mode.",
  );
};

const validateProduct = (product: MarketingAgentPreparedProductContext): void => {
  if (product.title.trim().length === 0) {
    throw new MarketingAgentInputValidationError("Product title is required.");
  }

  if (product.description.trim().length === 0) {
    throw new MarketingAgentInputValidationError("Product description is required.");
  }

  if (product.tags.length === 0 || product.tags.some((tag) => tag.trim().length === 0)) {
    throw new MarketingAgentInputValidationError("At least one product tag is required.");
  }

  if (
    product.targetMarkets.length === 0 ||
    product.targetMarkets.some((market) => market.trim().length === 0)
  ) {
    throw new MarketingAgentInputValidationError("At least one product target market is required.");
  }

  if (product.currency !== undefined && !ISO_CURRENCY_PATTERN.test(product.currency)) {
    throw new MarketingAgentInputValidationError("Product currency must be a three-letter uppercase ISO code.");
  }
};

const validateBrand = (brand: MarketingAgentBrandContext): void => {
  if (brand.name.trim().length === 0) {
    throw new MarketingAgentInputValidationError("Brand name is required.");
  }

  if (brand.market.length === 0 || brand.market.some((market) => market.trim().length === 0)) {
    throw new MarketingAgentInputValidationError("At least one brand market is required.");
  }

  if (!ISO_CURRENCY_PATTERN.test(brand.currency)) {
    throw new MarketingAgentInputValidationError("Brand currency must be a three-letter uppercase ISO code.");
  }
};

const collectRequiredPorts = (
  steps: readonly MarketingAgentStep[],
): readonly MarketingAgentOutput["requiredPorts"][number][] => {
  const ports = steps.map((step) => step.requiredPort);

  return MARKETING_AGENT_PORT_IDENTIFIERS.filter((port) => ports.includes(port));
};
