import type {
  ContentQualityDimension,
  ContentQualityRuleEvaluation,
  ContentQualityScoringInput,
  ContentQualityScoringOptions,
} from "../dto/content-quality-scoring.types.js";

interface RuleDefinition {
  readonly ruleId: string;
  readonly dimension: ContentQualityDimension;
  readonly description: string;
  readonly evaluate: (input: ContentQualityScoringInput, options: ContentQualityScoringOptions) => RuleResult;
}

interface RuleResult {
  readonly score: number;
  readonly evidence: readonly string[];
  readonly recommendation?: string;
  readonly applicable?: boolean;
}

export class ContentScoringRuleFactory {
  public create(): readonly RuleDefinition[] {
    return RULES;
  }
}

const RULES: readonly RuleDefinition[] = [
  rule("headline-clarity", "clarity", "Headline should be clear and specific.", (input) => {
    const length = input.headline.length;
    return scored(length >= 8 && length <= 120, length < 3 ? 25 : 88, ["headline length checked"], "Clarify the headline.");
  }),
  rule("sentence-complexity", "clarity", "Sentences should remain readable.", (input) => {
    const avg = averageSentenceWords(text(input));
    return scored(avg <= 28, avg > 40 ? 45 : 82, [`average sentence words: ${avg}`], "Split long sentences.");
  }),
  rule("excessive-punctuation", "clarity", "Avoid excessive punctuation.", (input) =>
    scored(!/[!?]{4,}/u.test(text(input)), 35, ["punctuation checked"], "Reduce excessive punctuation.")),
  rule("product-relevance", "relevance", "Content should reference its product or source.", (input) => {
    const sourceProduct = safeString(input.sourceMetadata.productId) ?? safeString(input.productSourceData?.productTitle) ?? "";
    const hasProduct = sourceProduct.length === 0 || text(input).toLowerCase().includes(sourceProduct.toLowerCase());
    return scored(hasProduct || input.contentType !== "product-description", 62, ["product relevance checked"], "Reference the source product more clearly.");
  }),
  rule("objective-alignment", "relevance", "Content should align with objective metadata.", (input, options) => {
    const objective = options.objective ?? safeString(input.sourceMetadata.objective) ?? "";
    return scored(objective.length === 0 || text(input).toLowerCase().includes(objective.split("-")[0] ?? ""), 72, ["objective alignment checked"], "Connect the content to its stated objective.");
  }),
  rule("search-intent-alignment", "relevance", "Search intent should be reflected when present.", (input) =>
    scored(input.searchIntent === undefined || input.seo !== undefined || input.contentType !== "blog-article", 70, ["search intent checked"], "Add SEO metadata for search-intent-driven content.")),
  rule("benefit-clarity", "persuasiveness", "Content should communicate a benefit.", (input) =>
    scored(/\b(benefit|helps|supports|improves|membantu|menyokong|manfaat)\b/iu.test(text(input)), 68, ["benefit language checked"], "Clarify the primary benefit.")),
  rule("value-proposition", "persuasiveness", "Content should explain practical value.", (input) =>
    scored(text(input).length > 80, 65, ["content length checked"], "Add a grounded value proposition.")),
  rule("cta-relevance", "ctaQuality", "CTA should be present when channel commonly needs action.", (input) =>
    scored(input.cta !== undefined || !requiresCta(input.channel, input.contentType), 55, ["CTA presence checked"], "Add a grounded CTA.")),
  rule("manipulative-tactics", "persuasiveness", "Avoid manipulative urgency.", (input) =>
    safetyRule(input, "manipulative_tactics", /\b(last chance|act now|you will regret|dangerous mistake)\b/iu, "Replace manipulative urgency with grounded guidance.")),
  rule("paragraph-length", "readability", "Paragraphs should not be too long.", (input) => {
    const max = maxParagraphWords(input.body);
    return scored(max <= 120, max > 180 ? 45 : 78, [`max paragraph words: ${max}`], "Split long paragraphs.");
  }),
  rule("heading-frequency", "readability", "Long content should include structure.", (input) => {
    const words = wordCount(text(input));
    const headings = Object.keys(input.structuredContent).length;
    return scored(words < 350 || headings > 0, 66, [`word count: ${words}`, `structured sections: ${headings}`], "Add headings or structured sections.");
  }),
  rule("repetition-diversity", "originalityHeuristic", "Avoid repeated template phrasing.", (input) => {
    const rate = repeatedPhraseRate(text(input));
    return scored(rate < 0.18, rate > 0.35 ? 45 : 72, [`internal repetition rate: ${rate}`], "Reduce repeated phrases and duplicate sections.");
  }),
  rule("primary-keyword-presence", "seoQuality", "SEO content should include a primary keyword.", (input) => {
    const keyword = input.seo?.primaryKeyword?.value;
    return scored(keyword === undefined || text(input).toLowerCase().includes(keyword.toLowerCase()), 60, ["primary keyword checked"], "Place the primary keyword naturally.");
  }),
  rule("keyword-stuffing", "seoQuality", "Avoid keyword stuffing.", (input) => {
    const keyword = input.seo?.primaryKeyword?.value;
    const density = keyword === undefined ? 0 : keywordDensity(text(input), keyword);
    return scored(density <= 0.08, 52, [`keyword density: ${density}`], "Reduce repeated keyword usage.");
  }),
  rule("meta-quality", "seoQuality", "SEO-oriented content should have metadata.", (input) =>
    scored(!seoRequired(input.contentType) || input.seo?.metaTitle !== undefined || input.seoContentPackage !== undefined, 58, ["meta data checked"], "Add a valid meta title and meta description.")),
  rule("slug-quality", "seoQuality", "SEO slug should be available where applicable.", (input) =>
    scored(!seoRequired(input.contentType) || input.seo?.slug !== undefined || input.seoContentPackage !== undefined, 65, ["slug checked"], "Add a concise SEO slug.")),
  rule("brand-tone", "brandAlignment", "Tone should align with brand-safe language.", (input) =>
    scored(!/\b(shocking|secret|crushes|destroys)\b/iu.test(text(input)), 55, ["brand tone checked"], "Use brand-safe wording.")),
  rule("audience-fit", "audienceAlignment", "Audience context should be present for campaign content.", (input) =>
    scored(input.audience !== undefined || input.channel === "generic", 70, ["audience context checked"], "Add audience or persona context.")),
  rule("channel-compatibility", "channelSuitability", "Content should fit the target channel.", (input) => {
    const length = input.body.length;
    const ok = input.channel === "email" ? length < 5000 : input.channel === "x" ? length <= 280 : true;
    return scored(ok, 62, [`channel: ${input.channel}`], "Adjust length or structure for the target channel.");
  }),
  rule("platform-spam-risk", "channelSuitability", "Social content should avoid spam signals.", (input) => {
    const hashtags = (text(input).match(/#/gu) ?? []).length;
    return scored(!["instagram", "tiktok", "facebook", "linkedin", "x"].includes(input.channel) || hashtags <= 12, 55, [`hashtags: ${hashtags}`], "Reduce hashtag volume.");
  }),
  rule("required-structure", "structuralQuality", "Content should have enough structure.", (input) =>
    scored(input.body.length > 0 || Object.keys(input.structuredContent).length > 0, 25, ["structure checked"], "Add body copy or structured content.")),
  rule("duplicate-sections", "structuralQuality", "Structured sections should not be duplicated.", (input) => {
    const values = Object.values(input.structuredContent).map((value) => value.toLowerCase());
    return scored(new Set(values).size === values.length, 60, ["duplicate sections checked"], "Remove duplicate sections.");
  }),
  rule("cta-placement", "structuralQuality", "CTA placement should be available for action-driven content.", (input) =>
    scored(input.cta !== undefined || !requiresCta(input.channel, input.contentType), 58, ["CTA placement checked"], "Place the CTA near the end or action block.")),
  rule("medical-claim", "claimSafety", "Medical claims must be avoided unless verified.", (input) =>
    safetyRule(input, "medical_claim", /\b(cure|treats|heals|prevents disease|medical grade|clinically proven)\b/iu, "Remove unsupported medical or safety claims.")),
  rule("guaranteed-outcome", "claimSafety", "Guaranteed outcomes are unsafe.", (input) =>
    safetyRule(input, "guaranteed_outcome", /\b(guaranteed results|works for everyone|instant transformation|permanent result)\b/iu, "Replace guaranteed outcomes with qualified source-backed language.")),
  rule("fabricated-social-proof", "claimSafety", "Avoid fabricated reviews or social proof.", (input) =>
    safetyRule(input, "fabricated_social_proof", /\b(verified review|five-star|5-star|customers are saying|thousands love)\b/iu, "Remove unverified reviews or social proof.")),
  rule("fabricated-offer", "claimSafety", "Offers must be verified.", (input) =>
    safetyRule(input, "fabricated_offer", /\b\d+%\s*off|coupon code|free gift|limited stock\b/iu, "Use only verified offer context.")),
  rule("unsafe-instructions", "claimSafety", "Usage instructions must be safe and sourced.", (input) =>
    safetyRule(input, "unsafe_instructions", /\b(ignore safety|use without instructions|mix with chemicals)\b/iu, "Remove unsafe usage guidance.")),
  rule("email-unsubscribe", "complianceReadiness", "Email content should include unsubscribe guidance.", (input) =>
    scored(input.channel !== "email" || /unsubscribe|berhenti melanggan/iu.test(text(input)), 45, ["email compliance checked"], "Add unsubscribe guidance for email content.")),
  rule("source-evidence", "complianceReadiness", "Evidence placeholders should be clear when needed.", (input) =>
    scored(!/\b(study published|according to experts|journal of)\b/iu.test(text(input)), 42, ["evidence references checked"], "Replace fabricated citation language with an evidence placeholder.")),
  rule("personalization-token", "complianceReadiness", "Personalization tokens should be controlled.", (input) =>
    scored(!/\{\{(?!first_name|brand_name|product_name|cart_url|product_url|order_number|support_url|unsubscribe_url)[^}]+\}\}/u.test(text(input)), 50, ["personalization tokens checked"], "Use approved personalization tokens only.")),
  rule("tone-consistency", "toneConsistency", "Tone should be consistent with configured tone.", (input) =>
    scored(toneConsistent(input.tone, text(input)), 72, [`tone: ${input.tone}`], "Adjust wording to match the selected tone.")),
  rule("language-consistency", "languageConsistency", "Content should match configured language.", (input) =>
    scored(languageConsistent(input.language, text(input)), 70, [`language: ${input.language}`], "Keep generated content in the selected language.")),
  rule("factual-grounding", "factualGrounding", "Claims should be grounded in supplied source data.", (input) => {
    const hasSource = Object.keys(input.sourceMetadata).length > 0 || input.productContentPackage !== undefined || input.blogContentPackage !== undefined;
    return scored(hasSource, 62, ["source metadata checked"], "Attach source product, campaign or generator metadata.");
  }),
  rule("certification-claim", "factualGrounding", "Certification claims must be supplied.", (input) =>
    safetyRule(input, "fabricated_certification", /\b(certified|approved by|officially endorsed)\b/iu, "Remove certification claims unless supplied as verified source data.")),
  rule("actionable-next-step", "actionability", "Content should provide a clear next step.", (input) =>
    scored(input.cta !== undefined || /\b(learn more|read|view|explore|compare|lihat|ketahui)\b/iu.test(text(input)), 68, ["actionability checked"], "Add a clear next step.")),
];

function rule(
  ruleId: string,
  dimension: ContentQualityDimension,
  description: string,
  evaluate: RuleDefinition["evaluate"],
): RuleDefinition {
  return { ruleId, dimension, description, evaluate };
}

export function evaluateRule(
  definition: RuleDefinition,
  input: ContentQualityScoringInput,
  options: ContentQualityScoringOptions,
): ContentQualityRuleEvaluation {
  const result = definition.evaluate(input, options);
  const status = result.score >= 80 ? "pass" : result.score >= 60 ? "warning" : "fail";
  const criticality = result.score < 50 && safetyDimension(definition.dimension) ? "critical" : result.score < 60 ? "high" : result.score < 80 ? "medium" : "low";
  return {
    ruleId: definition.ruleId,
    dimension: definition.dimension,
    description: definition.description,
    status,
    score: result.score,
    evidence: result.evidence,
    ...(result.recommendation === undefined ? {} : { recommendation: result.recommendation }),
    criticality,
    applicable: result.applicable ?? true,
  };
}

function scored(pass: boolean, failScore: number, evidence: readonly string[], recommendation: string): RuleResult {
  return {
    score: pass ? 90 : failScore,
    evidence,
    ...(pass ? {} : { recommendation }),
  };
}

function safetyRule(
  input: ContentQualityScoringInput,
  category: string,
  pattern: RegExp,
  recommendation: string,
): RuleResult {
  const matched = pattern.test(text(input));
  return {
    score: matched ? 20 : 94,
    evidence: [`${category}: ${matched ? "found" : "not found"}`],
    ...(matched ? { recommendation } : {}),
  };
}

function text(input: ContentQualityScoringInput): string {
  return [input.headline, input.body, ...Object.values(input.structuredContent), input.cta?.value ?? ""].join(" ");
}

function wordCount(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
}

function averageSentenceWords(value: string): number {
  const sentences = value.split(/[.!?]+/u).map((sentence) => sentence.trim()).filter(Boolean);
  if (sentences.length === 0) {
    return 0;
  }
  return Math.round(sentences.reduce((sum, sentence) => sum + wordCount(sentence), 0) / sentences.length);
}

function maxParagraphWords(value: string): number {
  return Math.max(0, ...value.split(/\n{2,}/u).map((paragraph) => wordCount(paragraph)));
}

function repeatedPhraseRate(value: string): number {
  const words = value.toLowerCase().split(/\s+/u).filter((word) => word.length > 3);
  if (words.length < 8) {
    return 0;
  }
  const phrases = words.slice(0, -2).map((word, index) => `${word} ${words[index + 1] ?? ""} ${words[index + 2] ?? ""}`);
  return Math.round((1 - new Set(phrases).size / phrases.length) * 100) / 100;
}

function keywordDensity(value: string, keyword: string): number {
  const words = wordCount(value);
  if (words === 0) {
    return 0;
  }
  const count = value.toLowerCase().split(keyword.toLowerCase()).length - 1;
  return Math.round((count / words) * 100) / 100;
}

function seoRequired(contentType: ContentQualityScoringInput["contentType"]): boolean {
  return contentType === "seo-title" || contentType === "seo-description" || contentType === "blog-article";
}

function requiresCta(channel: ContentQualityScoringInput["channel"], contentType: ContentQualityScoringInput["contentType"]): boolean {
  return ["shopify", "website", "email", "facebook", "instagram", "tiktok"].includes(channel) || contentType === "cta";
}

function toneConsistent(tone: ContentQualityScoringInput["tone"], value: string): boolean {
  if (tone === "professional" || tone === "authoritative") {
    return !/\b(super fun|lol|omg)\b/iu.test(value);
  }
  if (tone === "educational") {
    return !/\b(buy now now|last chance)\b/iu.test(value);
  }
  return true;
}

function languageConsistent(language: ContentQualityScoringInput["language"], value: string): boolean {
  if (language === "ms") {
    return /\b(dan|untuk|produk|panduan|ketahui|lihat)\b/iu.test(value);
  }
  if (language === "en") {
    return /\b(the|and|for|product|guide|learn|view)\b/iu.test(value);
  }
  return true;
}

function safetyDimension(dimension: ContentQualityDimension): boolean {
  return dimension === "claimSafety" || dimension === "complianceReadiness" || dimension === "factualGrounding";
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
