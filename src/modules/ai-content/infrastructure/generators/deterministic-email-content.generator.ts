import type {
  EmailContentGenerationInput,
  EmailContentGenerationOptions,
  EmailContentPackage,
  EmailSection,
} from "../../application/dto/email-content.types.js";
import {
  EmailContentPackageFactory,
  EmailPreheaderFactory,
  EmailSectionFactory,
  EmailSequenceFactory,
  EmailSubjectLineFactory,
} from "../../application/factories/index.js";
import type { EmailContentGeneratorPort } from "../../application/ports/email-content-generator.port.js";

export class DeterministicEmailContentGenerator implements EmailContentGeneratorPort {
  public constructor(
    private readonly subjectFactory = new EmailSubjectLineFactory(),
    private readonly preheaderFactory = new EmailPreheaderFactory(),
    private readonly sectionFactory = new EmailSectionFactory(),
    private readonly sequenceFactory = new EmailSequenceFactory(),
    private readonly packageFactory = new EmailContentPackageFactory(),
  ) {}

  public generate(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): EmailContentPackage {
    const subjectLines = this.subjectFactory.create(input, options);
    const preheaders = this.preheaderFactory.create(input, options);
    const cta = this.cta(options);
    const secondaryCTA = options.includeSecondaryCTA ? this.secondaryCta(options) : undefined;
    const sections = this.sectionFactory.create(input, options);
    const headline = this.headline(input, options);
    const openingParagraph = this.opening(input, options);
    const mainBody = this.body(openingParagraph, sections, cta);
    const plainTextVersion = options.includePlainTextVersion
      ? this.plainText(subjectLines[0] ?? headline, preheaders[0] ?? openingParagraph, mainBody, cta, options)
      : undefined;
    const sequence = this.sequenceFactory.create(input, options, subjectLines, preheaders, cta);

    const objectionHandlingSection = pickSection(sections, "objection-handling");
    const trustBuildingSection = pickSection(sections, "trust");
    const educationalSection = pickSection(sections, "education");

    return this.packageFactory.create(input, options, {
      subjectLines,
      preheaders,
      headline,
      openingParagraph,
      mainBody,
      productHighlights: (input.highlights ?? []).slice(0, 4),
      benefits: (input.benefits ?? [input.valueProposition ?? input.productTitle]).slice(0, 4),
      supportingFeatures: (input.features ?? []).slice(0, 4),
      ...(objectionHandlingSection === undefined ? {} : { objectionHandlingSection }),
      ...(trustBuildingSection === undefined ? {} : { trustBuildingSection }),
      ...(educationalSection === undefined ? {} : { educationalSection }),
      cta,
      ...(secondaryCTA === undefined ? {} : { secondaryCTA }),
      buttonLabels: [cta, ...(secondaryCTA === undefined ? [] : [secondaryCTA])],
      textLinkLabels: [options.language === "ms" ? "Lihat butiran produk" : "View product details"],
      footerGuidance: this.footer(options),
      unsubscribePlaceholderGuidance:
        options.language === "ms"
          ? "Sertakan pautan berhenti melanggan: {{unsubscribe_url}}."
          : "Include unsubscribe link placeholder: {{unsubscribe_url}}.",
      complianceNotes: this.complianceNotes(input, options),
      ...(plainTextVersion === undefined ? {} : { plainTextVersion }),
      htmlSafeSections: sections,
      sequence,
      warnings: this.warnings(input, options),
    });
  }

  private headline(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): string {
    if (options.campaignType === "product-launch") {
      return options.language === "ms" ? `Memperkenalkan ${input.productTitle}` : `Introducing ${input.productTitle}`;
    }
    if (options.campaignType === "welcome") {
      return options.language === "ms" ? `Selamat datang ke ${input.brand ?? input.productTitle}` : `Welcome to ${input.brand ?? input.productTitle}`;
    }
    return options.language === "ms" ? `Pilihan produk: ${input.productTitle}` : `Product spotlight: ${input.productTitle}`;
  }

  private opening(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): string {
    const token = options.includePersonalization ? "{{first_name}}, " : "";
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;

    return options.language === "ms"
      ? `${token}${input.productTitle} direka untuk membantu dengan ${benefit} berdasarkan maklumat produk yang tersedia.`
      : `${token}${input.productTitle} is positioned around ${benefit} using the available product information.`;
  }

  private body(opening: string, sections: readonly EmailSection[], cta: string): string {
    return [opening, ...sections.map((section) => `${section.title}\n${section.body}`), cta].join("\n\n");
  }

  private cta(options: EmailContentGenerationOptions): string {
    if (options.campaignType === "abandoned-cart") {
      return options.language === "ms" ? "Kembali ke troli anda" : "Return to your cart";
    }
    if (options.campaignType === "review-request-framework") {
      return options.language === "ms" ? "Kongsi maklum balas anda" : "Share your feedback";
    }
    if (options.objective === "education") {
      return options.language === "ms" ? "Baca panduan" : "Read the guide";
    }
    return options.language === "ms" ? "Lihat produk" : "Explore the product";
  }

  private secondaryCta(options: EmailContentGenerationOptions): string {
    return options.language === "ms" ? "Ketahui lebih lanjut" : "Learn more";
  }

  private footer(options: EmailContentGenerationOptions): string {
    return options.language === "ms"
      ? "Sertakan alamat perniagaan, pautan sokongan dan pautan berhenti melanggan yang sah."
      : "Include business address, support link and a valid unsubscribe link.";
  }

  private complianceNotes(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): readonly string[] {
    return [
      "Use verified product facts only.",
      ...(options.campaignType === "limited-offer-framework" ? ["Offer language uses verified offer context only."] : []),
      ...(input.productRisks ?? []).map((risk) => `Source risk note: ${risk}`),
    ];
  }

  private warnings(input: EmailContentGenerationInput, options: EmailContentGenerationOptions) {
    return [
      ...(options.campaignType === "review-request-framework"
        ? [{ code: "REVIEW_FRAMEWORK_ONLY", message: "Request honest feedback only; do not request positive reviews only." }]
        : []),
      ...(input.productRisks?.length === undefined || input.productRisks.length === 0
        ? [{ code: "NO_PRODUCT_RISK_SOURCE", message: "No product risk context supplied." }]
        : []),
    ];
  }

  private plainText(subject: string, preheader: string, body: string, cta: string, options: EmailContentGenerationOptions): string {
    return [subject, preheader, body, cta, options.language === "ms" ? "Berhenti melanggan: {{unsubscribe_url}}" : "Unsubscribe: {{unsubscribe_url}}"].join("\n\n");
  }
}

function pickSection(sections: readonly EmailSection[], key: string): EmailSection | undefined {
  return sections.find((section) => section.key === key);
}
