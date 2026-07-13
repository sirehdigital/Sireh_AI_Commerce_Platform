import { Content, CTA, Headline, type ContentChannel } from "../../domain/index.js";
import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
  SocialMediaContentPackage,
  SocialPlatformWarning,
  SocialVisualDirection,
} from "../dto/social-media-content.types.js";

export interface SocialMediaContentPackageDraft {
  readonly hook: string;
  readonly primaryCaption: string;
  readonly shortCaption: string;
  readonly longCaption?: string;
  readonly ctas: readonly string[];
  readonly hashtags: readonly string[];
  readonly productHighlights: readonly string[];
  readonly benefitBullets: readonly string[];
  readonly engagementQuestion?: string;
  readonly commentPrompt?: string;
  readonly savePrompt?: string;
  readonly sharePrompt?: string;
  readonly linkPrompt?: string;
  readonly visualDirection?: SocialVisualDirection;
  readonly imageOverlayText?: string;
  readonly shortFormPostConcept?: string;
  readonly socialProofGuidance: readonly string[];
  readonly riskAndComplianceNotes: readonly string[];
  readonly platformWarnings: readonly SocialPlatformWarning[];
}

export class SocialMediaContentPackageFactory {
  public create(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
    draft: SocialMediaContentPackageDraft,
  ): SocialMediaContentPackage {
    const ctas = draft.ctas.map((cta) => CTA.create(cta));
    const contents = [
      this.content(input, options, primaryContentType(options), "primary-post", draft.hook, draft.primaryCaption, ctas[0]),
      this.content(input, options, "social-caption", "short-caption", draft.hook, draft.shortCaption, ctas[0]),
      ...(draft.longCaption === undefined
        ? []
        : [this.content(input, options, "social-caption", "long-caption", draft.hook, draft.longCaption, ctas[0])]),
      this.content(
        input,
        options,
        ctaContentType(options),
        "cta",
        ctas[0]?.value ?? "Learn more",
        ctas.map((cta) => cta.value).join("\n"),
        ctas[0],
      ),
      ...(draft.imageOverlayText === undefined
        ? []
        : [
            this.content(
              input,
              options,
              "generic-content",
              "image-overlay",
              draft.imageOverlayText,
              draft.imageOverlayText,
            ),
          ]),
    ];

    return {
      productId: input.productId,
      platform: options.platform,
      channel: platformToChannel(options.platform),
      language: options.language,
      tone: options.tone,
      objective: options.objective,
      contentAngle: options.contentAngle,
      hook: draft.hook,
      primaryCaption: draft.primaryCaption,
      shortCaption: draft.shortCaption,
      ...(draft.longCaption === undefined ? {} : { longCaption: draft.longCaption }),
      ctas,
      hashtags: draft.hashtags,
      productHighlights: draft.productHighlights,
      benefitBullets: draft.benefitBullets,
      ...(draft.engagementQuestion === undefined ? {} : { engagementQuestion: draft.engagementQuestion }),
      ...(draft.commentPrompt === undefined ? {} : { commentPrompt: draft.commentPrompt }),
      ...(draft.savePrompt === undefined ? {} : { savePrompt: draft.savePrompt }),
      ...(draft.sharePrompt === undefined ? {} : { sharePrompt: draft.sharePrompt }),
      ...(draft.linkPrompt === undefined ? {} : { linkPrompt: draft.linkPrompt }),
      ...(draft.visualDirection === undefined ? {} : { visualDirection: draft.visualDirection }),
      ...(draft.imageOverlayText === undefined ? {} : { imageOverlayText: draft.imageOverlayText }),
      carouselSlides: [],
      storyFrames: [],
      ...(draft.shortFormPostConcept === undefined ? {} : { shortFormPostConcept: draft.shortFormPostConcept }),
      socialProofGuidance: draft.socialProofGuidance,
      riskAndComplianceNotes: draft.riskAndComplianceNotes,
      platformWarnings: draft.platformWarnings,
      contents,
      sourceMetadata: this.sourceMetadata(input, options),
      generatedAt: new Date(),
    };
  }

  public withStructuredContent(
    contentPackage: SocialMediaContentPackage,
    carouselSlides: SocialMediaContentPackage["carouselSlides"],
    storyFrames: SocialMediaContentPackage["storyFrames"],
  ): SocialMediaContentPackage {
    return {
      ...contentPackage,
      carouselSlides,
      storyFrames,
      contents: [
        ...contentPackage.contents,
        ...(carouselSlides.length === 0
          ? []
          : [
              this.contentFromPackage(
                contentPackage,
                "generic-content",
                "carousel",
                carouselSlides[0]?.title ?? "Carousel",
                carouselSlides.map((slide) => `${slide.sequence}. ${slide.title}: ${slide.body}`).join("\n"),
              ),
            ]),
        ...(storyFrames.length === 0
          ? []
          : [
              this.contentFromPackage(
                contentPackage,
                "generic-content",
                "story",
                storyFrames[0]?.text ?? "Story",
                storyFrames.map((frame) => `${frame.sequence}. ${frame.text}`).join("\n"),
              ),
            ]),
      ],
    };
  }

  private content(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
    type: Parameters<typeof Content.create>[0]["type"],
    component: string,
    headline: string,
    body: string,
    cta?: CTA,
  ): Content {
    return Content.create({
      id: `content:${input.productId}:${options.platform}:${component}`,
      type,
      channel: platformToChannel(options.platform),
      language: options.language,
      tone: options.tone,
      headline: Headline.create(headline.slice(0, 120)),
      body,
      ...(cta === undefined ? {} : { cta }),
      metadata: {
        sourceProductId: input.productId,
        ...(input.sourceMarketingAnalysisId === undefined
          ? {}
          : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
        ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
        tags: ["social-content", options.platform, component],
        custom: {
          component,
          platform: options.platform,
          objective: options.objective,
          contentAngle: options.contentAngle,
        },
      },
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
    });
  }

  private contentFromPackage(
    contentPackage: SocialMediaContentPackage,
    type: Parameters<typeof Content.create>[0]["type"],
    component: string,
    headline: string,
    body: string,
  ): Content {
    return Content.create({
      id: `content:${contentPackage.productId}:${contentPackage.platform}:${component}`,
      type,
      channel: contentPackage.channel,
      language: contentPackage.language,
      tone: contentPackage.tone,
      headline: Headline.create(headline.slice(0, 120)),
      body,
      metadata: {
        sourceProductId: contentPackage.productId,
        ...(typeof contentPackage.sourceMetadata.campaignId === "string"
          ? { campaignId: contentPackage.sourceMetadata.campaignId }
          : {}),
        ...(typeof contentPackage.sourceMetadata.correlationId === "string"
          ? { correlationId: contentPackage.sourceMetadata.correlationId }
          : {}),
        tags: ["social-content", contentPackage.platform, component],
        custom: { component, platform: contentPackage.platform },
      },
    });
  }

  private sourceMetadata(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): Readonly<Record<string, unknown>> {
    return {
      productId: input.productId,
      platform: options.platform,
      objective: options.objective,
      contentAngle: options.contentAngle,
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(input.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
    };
  }
}

export function platformToChannel(platform: SocialMediaContentGenerationOptions["platform"]): ContentChannel {
  return platform === "generic" ? "generic" : platform;
}

function primaryContentType(options: SocialMediaContentGenerationOptions): Parameters<typeof Content.create>[0]["type"] {
  return options.platform === "youtube" ? "social-caption" : "social-post";
}

function ctaContentType(options: SocialMediaContentGenerationOptions): Parameters<typeof Content.create>[0]["type"] {
  return options.platform === "linkedin" || options.platform === "x" ? "generic-content" : "cta";
}
