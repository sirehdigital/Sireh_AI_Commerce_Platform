import type {
  ProductContentGenerationInput,
  ProductContentGenerationOptions,
  ProductContentPackage,
  ProductFAQItem,
} from "../../application/dto/product-content.types.js";
import {
  ProductContentPackageFactory,
  type ProductContentTextDraft,
} from "../../application/factories/product-content-package.factory.js";
import type { ProductContentGeneratorPort } from "../../application/ports/product-content-generator.port.js";

export class DeterministicProductContentGenerator implements ProductContentGeneratorPort {
  public constructor(private readonly packageFactory = new ProductContentPackageFactory()) {}

  public generate(
    input: ProductContentGenerationInput,
    options: ProductContentGenerationOptions,
  ): ProductContentPackage {
    const language = options.language === "ms" ? "ms" : "en";
    const facts = this.buildFacts(input);
    const title = this.buildTitle(input);
    const benefits = this.limit(
      this.unique([...facts.benefits, ...facts.angleBenefits, this.audienceBenefit(input, language)]),
      options.benefitCount,
    );
    const features = this.limit(this.unique([...facts.features, ...facts.productFacts]), options.featureCount);
    const highlights = this.limit(this.unique([...benefits, ...features]), Math.min(4, options.featureCount));
    const ctas = this.buildCtas(options);
    const draft: ProductContentTextDraft = {
      title,
      subtitle: this.subtitle(input, facts, language),
      shortDescription: this.shortDescription(input, language),
      longDescription: this.longDescription(
        input,
        facts,
        benefits,
        features,
        ctas[0] ?? "Explore this product",
        language,
      ),
      benefits,
      features,
      highlights,
      problemStatement: this.problemStatement(input, language),
      solutionStatement: this.solutionStatement(input, facts, language),
      valueProposition: this.valueProposition(input, facts, language),
      targetAudienceStatement: this.targetAudience(input, language),
      brandPositioningStatement: this.brandPositioning(input, language),
      ...(options.includeUsageGuidance && facts.usage.length > 0
        ? { usageGuidance: this.usageGuidance(facts.usage, language) }
        : {}),
      ...(options.includeTrustContent ? { trustBuildingCopy: this.trustCopy(input, facts, language) } : {}),
      ...(options.includeObjectionHandling && facts.objections.length > 0
        ? { objectionHandlingCopy: this.objectionHandling(facts.objections, language) }
        : {}),
      faq: this.limitFaq(this.faq(input, facts, language), options.faqCount),
      callsToAction: ctas.slice(0, options.ctaCount),
    };

    return this.packageFactory.create(input, options, this.adjustLength(draft, options.desiredLength));
  }

  private buildFacts(input: ProductContentGenerationInput): ProductContentFacts {
    const productFacts = this.unique([
      ...(input.category === undefined ? [] : [`Category: ${input.category}`]),
      ...(input.productType === undefined ? [] : [`Product type: ${input.productType}`]),
      ...(input.brand === undefined ? [] : [`Brand: ${input.brand}`]),
      ...this.variantFacts(input),
      ...this.marketFacts(input),
    ]);

    return {
      benefits: this.unique([
        ...(input.benefits ?? []),
        ...(input.productAnalysis?.keyBenefits ?? []),
      ]),
      angleBenefits: this.unique((input.marketingAngles ?? []).flatMap((angle) => [
        angle.coreBenefit ?? "",
        angle.hook ?? "",
      ])),
      features: this.unique([
        ...(input.features ?? []),
        ...(input.productAnalysis?.keyFeatures ?? []),
        ...(input.tags ?? []).map((tag) => `Tagged for ${tag}`),
      ]),
      productFacts,
      usage: this.unique((input.features ?? []).filter((feature) => /use|usage|daily|routine|wear|apply/iu.test(feature))),
      objections: this.unique([
        ...(input.marketingAudience?.objections ?? []),
        ...(input.productRisk?.reasons ?? []),
      ]),
    };
  }

  private buildTitle(input: ProductContentGenerationInput): string {
    const title = input.productTitle;
    const brand = input.brand;

    if (brand === undefined || title.toLowerCase().includes(brand.toLowerCase())) {
      return title;
    }

    return `${brand} ${title}`;
  }

  private subtitle(
    input: ProductContentGenerationInput,
    facts: ProductContentFacts,
    language: SupportedContentLanguage,
  ): string {
    const value = input.valueProposition ?? facts.benefits[0] ?? input.productAnalysis?.summary;

    if (language === "ms") {
      return value === undefined
        ? `${input.productTitle} untuk keperluan pelanggan yang jelas.`
        : `${input.productTitle} membantu pelanggan dengan ${value.toLowerCase()}.`;
    }

    return value === undefined
      ? `${input.productTitle} built around clear customer value.`
      : `${input.productTitle} helps customers with ${value.toLowerCase()}.`;
  }

  private shortDescription(
    input: ProductContentGenerationInput,
    language: SupportedContentLanguage,
  ): string {
    const description = input.productDescription ?? input.productAnalysis?.summary;
    const audience = input.marketingAudience?.primaryAudience ?? input.customerPersona ?? this.marketLabel(input);

    if (language === "ms") {
      const category = input.category ?? input.productType ?? "produk";

      return `${input.productTitle} disusun untuk ${audience} dalam kategori ${category} dengan maklumat produk yang tersedia.`;
    }

    return description === undefined
      ? `${input.productTitle} is positioned for ${audience} using the available product details.`
      : `${input.productTitle} offers ${description.toLowerCase()}`;
  }

  private longDescription(
    input: ProductContentGenerationInput,
    facts: ProductContentFacts,
    benefits: readonly string[],
    features: readonly string[],
    cta: string,
    language: SupportedContentLanguage,
  ): string {
    const problem = this.problemStatement(input, language);
    const solution = this.solutionStatement(input, facts, language);
    const benefitText = benefits.length > 0 ? benefits.join("; ") : this.audienceBenefit(input, language);
    const featureText = features.length > 0 ? features.join("; ") : this.fallbackFeature(input, language);

    if (language === "ms") {
      return `${problem} ${solution} Manfaat utama termasuk ${benefitText}. Ciri yang disokong oleh data produk termasuk ${featureText}. ${cta}.`;
    }

    return `${problem} ${solution} Key benefits include ${benefitText}. Supported product features include ${featureText}. ${cta}.`;
  }

  private problemStatement(
    input: ProductContentGenerationInput,
    language: SupportedContentLanguage,
  ): string {
    const problem = input.marketingAudience?.customerProblems?.[0];

    if (language === "ms") {
      return problem === undefined
        ? `Pelanggan memerlukan pilihan yang jelas untuk ${input.category ?? "keperluan produk"}.`
        : `Pelanggan mungkin menghadapi cabaran seperti ${problem.toLowerCase()}.`;
    }

    return problem === undefined
      ? `Customers need a clear option for ${input.category ?? "their product needs"}.`
      : `Customers may be trying to solve ${problem.toLowerCase()}.`;
  }

  private solutionStatement(
    input: ProductContentGenerationInput,
    facts: ProductContentFacts,
    language: SupportedContentLanguage,
  ): string {
    const benefit = facts.benefits[0] ?? facts.features[0] ?? input.productTitle;

    if (language === "ms") {
      return `${input.productTitle} memberi penyelesaian berasaskan ${benefit.toLowerCase()}.`;
    }

    return `${input.productTitle} provides a product-led solution centered on ${benefit.toLowerCase()}.`;
  }

  private valueProposition(
    input: ProductContentGenerationInput,
    facts: ProductContentFacts,
    language: SupportedContentLanguage,
  ): string {
    if (input.valueProposition !== undefined) {
      return input.valueProposition;
    }

    const benefit = facts.benefits[0] ?? this.audienceBenefit(input, language);

    if (language === "ms") {
      return `${input.productTitle} menyatukan maklumat produk yang jelas dengan manfaat seperti ${benefit.toLowerCase()}.`;
    }

    return `${input.productTitle} combines clear product information with customer value such as ${benefit.toLowerCase()}.`;
  }

  private targetAudience(
    input: ProductContentGenerationInput,
    language: SupportedContentLanguage,
  ): string {
    const audience = input.marketingAudience?.primaryAudience ?? input.customerPersona ?? "general consumers";
    const markets = this.marketLabel(input);

    if (language === "ms") {
      return `Sesuai untuk ${audience} di pasaran ${markets}.`;
    }

    return `Suitable for ${audience} across ${markets}.`;
  }

  private brandPositioning(
    input: ProductContentGenerationInput,
    language: SupportedContentLanguage,
  ): string {
    if (input.brandPositioning !== undefined) {
      return input.brandPositioning;
    }

    const brand = input.brand ?? input.productTitle;

    if (language === "ms") {
      return `${brand} diposisikan melalui maklumat produk yang telus dan manfaat yang disokong oleh input.`;
    }

    return `${brand} is positioned through transparent product details and input-supported benefits.`;
  }

  private usageGuidance(usage: readonly string[], language: SupportedContentLanguage): string {
    if (language === "ms") {
      return `Gunakan berdasarkan maklumat produk yang tersedia: ${usage.join("; ")}.`;
    }

    return `Use according to the available product details: ${usage.join("; ")}.`;
  }

  private trustCopy(
    input: ProductContentGenerationInput,
    facts: ProductContentFacts,
    language: SupportedContentLanguage,
  ): string {
    const details = this.unique([
      ...(input.supplier?.supplierName === undefined ? [] : [`supplier: ${input.supplier.supplierName}`]),
      ...(input.supplier?.shippingOrigin === undefined ? [] : [`origin: ${input.supplier.shippingOrigin}`]),
      ...facts.productFacts,
    ]).slice(0, 3);

    if (language === "ms") {
      return details.length === 0
        ? "Salinan ini menggunakan butiran produk yang tersedia tanpa tuntutan tambahan."
        : `Dibina berdasarkan butiran telus seperti ${details.join(", ")}.`;
    }

    return details.length === 0
      ? "This copy uses available product details without adding unsupported claims."
      : `Built from transparent details such as ${details.join(", ")}.`;
  }

  private objectionHandling(objections: readonly string[], language: SupportedContentLanguage): string {
    const first = objections[0] ?? "";

    if (language === "ms") {
      return `Untuk kebimbangan seperti ${first.toLowerCase()}, salinan produk harus jelas tentang butiran yang tersedia dan tidak menyembunyikan risiko.`;
    }

    return `For concerns such as ${first.toLowerCase()}, the product copy should be clear about available details and avoid hiding risk.`;
  }

  private faq(
    input: ProductContentGenerationInput,
    facts: ProductContentFacts,
    language: SupportedContentLanguage,
  ): readonly ProductFAQItem[] {
    const items: ProductFAQItem[] = [];

    items.push({
      question: language === "ms" ? `Apakah ${input.productTitle}?` : `What is ${input.productTitle}?`,
      answer:
        language === "ms"
          ? `${input.productTitle} ialah produk dalam kategori ${input.category ?? "umum"} berdasarkan data yang tersedia.`
          : `${input.productTitle} is a ${input.category ?? "product"} based on the available product data.`,
    });

    if (facts.features.length > 0) {
      items.push({
        question: language === "ms" ? "Apakah ciri utamanya?" : "What are the key features?",
        answer: facts.features.slice(0, 3).join("; "),
      });
    }

    if (facts.benefits.length > 0) {
      items.push({
        question: language === "ms" ? "Apakah manfaat utamanya?" : "What are the main benefits?",
        answer: facts.benefits.slice(0, 3).join("; "),
      });
    }

    if (
      input.supplier?.estimatedDeliveryDaysMin !== undefined &&
      input.supplier.estimatedDeliveryDaysMax !== undefined
    ) {
      items.push({
        question: language === "ms" ? "Apakah anggaran penghantaran?" : "What is the estimated delivery window?",
        answer:
          language === "ms"
            ? `Anggaran tersedia ialah ${input.supplier.estimatedDeliveryDaysMin}-${input.supplier.estimatedDeliveryDaysMax} hari.`
            : `The available estimate is ${input.supplier.estimatedDeliveryDaysMin}-${input.supplier.estimatedDeliveryDaysMax} days.`,
      });
    }

    return items;
  }

  private buildCtas(options: ProductContentGenerationOptions): readonly string[] {
    if (options.language === "ms") {
      if (options.channel === "website") {
        return ["Ketahui produk ini", "Lihat butiran", "Terokai pilihan"];
      }

      if (options.channel === "generic") {
        return ["Terokai produk", "Semak butiran", "Lihat maklumat"];
      }

      return ["Tambah ke troli", "Lihat produk", "Pilih pilihan anda"];
    }

    if (options.channel === "website") {
      return ["Learn about this product", "View the details", "Explore the options"];
    }

    if (options.channel === "generic") {
      return ["Explore the product", "Review the details", "See the product information"];
    }

    return ["Add to cart", "View product", "Choose your option"];
  }

  private adjustLength(
    draft: ProductContentTextDraft,
    desiredLength: ProductContentGenerationOptions["desiredLength"],
  ): ProductContentTextDraft {
    if (desiredLength === "short") {
      return {
        ...draft,
        longDescription: draft.longDescription.split(". ").slice(0, 3).join(". "),
      };
    }

    if (desiredLength === "long") {
      return {
        ...draft,
        longDescription: `${draft.longDescription} ${draft.trustBuildingCopy ?? ""}`.trim(),
      };
    }

    return draft;
  }

  private audienceBenefit(
    input: ProductContentGenerationInput,
    language: SupportedContentLanguage,
  ): string {
    const audience = input.marketingAudience?.primaryAudience ?? input.customerPersona;

    if (language === "ms") {
      return audience === undefined ? "nilai yang jelas untuk pelanggan" : `nilai yang jelas untuk ${audience}`;
    }

    return audience === undefined ? "clear customer value" : `clear value for ${audience}`;
  }

  private fallbackFeature(
    input: ProductContentGenerationInput,
    language: SupportedContentLanguage,
  ): string {
    if (language === "ms") {
      return input.productType ?? input.category ?? "butiran produk yang tersedia";
    }

    return input.productType ?? input.category ?? "available product details";
  }

  private marketFacts(input: ProductContentGenerationInput): readonly string[] {
    return input.targetMarkets === undefined || input.targetMarkets.length === 0
      ? []
      : [`Target markets: ${input.targetMarkets.join(", ")}`];
  }

  private variantFacts(input: ProductContentGenerationInput): readonly string[] {
    return input.tags === undefined || input.tags.length === 0
      ? []
      : [`Product tags: ${input.tags.slice(0, 4).join(", ")}`];
  }

  private marketLabel(input: ProductContentGenerationInput): string {
    return input.targetMarkets === undefined || input.targetMarkets.length === 0
      ? "selected markets"
      : input.targetMarkets.join(", ");
  }

  private limit(values: readonly string[], limit: number): readonly string[] {
    return this.unique(values).slice(0, limit);
  }

  private limitFaq(values: readonly ProductFAQItem[], limit: number): readonly ProductFAQItem[] {
    return values.slice(0, limit);
  }

  private unique(values: readonly string[]): readonly string[] {
    return [
      ...new Set(
        values
          .map((value) => value.trim().replace(/\s+/gu, " "))
          .filter((value) => value.length >= 3),
      ),
    ];
  }
}

type SupportedContentLanguage = "en" | "ms";

interface ProductContentFacts {
  readonly benefits: readonly string[];
  readonly angleBenefits: readonly string[];
  readonly features: readonly string[];
  readonly productFacts: readonly string[];
  readonly usage: readonly string[];
  readonly objections: readonly string[];
}
