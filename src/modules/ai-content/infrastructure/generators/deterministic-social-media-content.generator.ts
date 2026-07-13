import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
  SocialMediaContentPackage,
  SocialPlatformWarning,
  SocialVisualDirection,
} from "../../application/dto/social-media-content.types.js";
import {
  SocialCarouselFactory,
  SocialHashtagSetFactory,
  SocialMediaContentPackageFactory,
  SocialStoryFactory,
} from "../../application/factories/index.js";
import type { SocialMediaContentGeneratorPort } from "../../application/ports/social-media-content-generator.port.js";
import {
  SocialCaptionPolicyService,
  SocialCTAPolicyService,
  SocialHookPolicyService,
} from "../../application/services/index.js";

export class DeterministicSocialMediaContentGenerator implements SocialMediaContentGeneratorPort {
  public constructor(
    private readonly hookPolicy = new SocialHookPolicyService(),
    private readonly captionPolicy = new SocialCaptionPolicyService(),
    private readonly ctaPolicy = new SocialCTAPolicyService(),
    private readonly hashtagFactory = new SocialHashtagSetFactory(),
    private readonly carouselFactory = new SocialCarouselFactory(),
    private readonly storyFactory = new SocialStoryFactory(),
    private readonly packageFactory = new SocialMediaContentPackageFactory(),
  ) {}

  public generate(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): SocialMediaContentPackage {
    const hook = this.hookPolicy.build(input, options);
    const ctas = this.ctaPolicy.build(options);
    const primaryCta = ctas[0] ?? (options.language === "ms" ? "Ketahui lebih lanjut" : "Learn more");
    const longCaption = this.captionPolicy.buildLong(input, options, hook, primaryCta);
    const shortFormPostConcept = this.shortFormConcept(input, options);
    const draft = {
      hook,
      primaryCaption: this.captionPolicy.buildPrimary(input, options, hook, primaryCta),
      shortCaption: this.captionPolicy.buildShort(input, options, hook, primaryCta),
      ...(longCaption === undefined ? {} : { longCaption }),
      ctas,
      hashtags: this.hashtagFactory.create(input, options),
      productHighlights: this.highlights(input),
      benefitBullets: this.benefits(input),
      ...(options.includeEngagementQuestion ? { engagementQuestion: this.engagementQuestion(input, options) } : {}),
      commentPrompt: options.language === "ms" ? "Kongsi pandangan anda dalam komen." : "Share your thoughts in the comments.",
      ...(options.includeSavePrompt ? { savePrompt: options.language === "ms" ? "Simpan untuk rujukan nanti." : "Save this for later reference." } : {}),
      ...(options.includeSharePrompt ? { sharePrompt: options.language === "ms" ? "Kongsi dengan seseorang yang mungkin berminat." : "Share this with someone who may find it useful." } : {}),
      linkPrompt: options.language === "ms" ? "Lihat butiran produk melalui pautan rasmi." : "Visit the official product page for details.",
      ...(options.includeVisualDirection ? { visualDirection: this.visualDirection(input, options) } : {}),
      imageOverlayText: this.overlayText(input, options),
      ...(shortFormPostConcept === undefined ? {} : { shortFormPostConcept }),
      socialProofGuidance: [
        options.language === "ms"
          ? "Tambah ulasan pelanggan yang disahkan sahaja jika tersedia."
          : "Add a verified customer review only when approved source data is available.",
      ],
      riskAndComplianceNotes: this.riskNotes(input, options),
      platformWarnings: this.platformWarnings(input, options),
    };
    const packageWithoutStructured = this.packageFactory.create(input, options, draft);

    return this.packageFactory.withStructuredContent(
      packageWithoutStructured,
      this.carouselFactory.create(input, options),
      this.storyFactory.create(input, options),
    );
  }

  private highlights(input: SocialMediaContentGenerationInput): readonly string[] {
    return (input.highlights?.length === undefined || input.highlights.length === 0
      ? [input.productType, input.category, input.brand].filter((value): value is string => value !== undefined)
      : input.highlights
    ).slice(0, 4);
  }

  private benefits(input: SocialMediaContentGenerationInput): readonly string[] {
    return (input.benefits?.length === undefined || input.benefits.length === 0
      ? [input.valueProposition ?? "Review the product benefits before deciding."]
      : input.benefits
    ).slice(0, 4);
  }

  private engagementQuestion(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): string {
    const subject = input.productType ?? input.category ?? input.productTitle;
    return options.language === "ms"
      ? `Apakah yang paling anda nilai dalam ${subject}?`
      : `What matters most to you when choosing ${subject}?`;
  }

  private visualDirection(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): SocialVisualDirection {
    const focus = input.productType ?? input.category ?? "product";
    return {
      concept:
        options.language === "ms"
          ? `Paparan ${focus} yang bersih dengan konteks gaya hidup yang berdasarkan maklumat produk.`
          : `Clean ${focus} presentation with lifestyle context grounded in product information.`,
      overlayText: this.overlayText(input, options),
      notes: [
        options.language === "ms"
          ? "Gunakan teks ringkas dan elakkan tuntutan hasil yang tidak disahkan."
          : "Use concise overlay copy and avoid unverified outcome claims.",
      ],
    };
  }

  private overlayText(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): string {
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const value = options.language === "ms" ? `${input.productTitle}: ${benefit}` : `${input.productTitle}: ${benefit}`;

    return value.length <= 64 ? value : `${value.slice(0, 61).trim()}...`;
  }

  private shortFormConcept(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): string | undefined {
    if (options.platform !== "tiktok" && options.platform !== "youtube") {
      return undefined;
    }

    return options.language === "ms"
      ? `Konsep post pendek: tunjukkan ${input.productTitle}, satu manfaat utama dan CTA ringkas.`
      : `Short-form post concept: show ${input.productTitle}, one grounded benefit and a concise CTA.`;
  }

  private riskNotes(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): readonly string[] {
    return input.productRisks?.length === undefined || input.productRisks.length === 0
      ? [
          options.language === "ms"
            ? "Tiada risiko produk khusus dibekalkan; kekalkan tuntutan berdasarkan fakta sumber."
            : "No specific product risks supplied; keep claims grounded in source facts.",
        ]
      : input.productRisks.map((risk) => `Source risk note: ${risk}`);
  }

  private platformWarnings(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): readonly SocialPlatformWarning[] {
    return [
      ...(options.platform === "x"
        ? [{ code: "CONCISE_COPY_REQUIRED", message: "X content should stay concise and focused on one message." }]
        : []),
      ...(options.contentAngle === "social-proof-framework"
        ? [
            {
              code: "VERIFIED_PROOF_REQUIRED",
              message: "Use only verified reviews, ratings or testimonial source data.",
            },
          ]
        : []),
      ...(input.productRisks?.length === undefined || input.productRisks.length === 0
        ? []
        : [{ code: "SOURCE_RISK_PRESENT", message: "Product risk notes must remain visible in review workflows." }]),
    ];
  }
}
