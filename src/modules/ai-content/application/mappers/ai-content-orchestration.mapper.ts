import type { Content } from "../../domain/index.js";
import type {
  AIContentOrchestrationInput,
  AIContentStageId,
} from "../dto/ai-content-orchestration.types.js";
import type { BlogContentGenerationInput, BlogContentPackage } from "../dto/blog-content.types.js";
import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import type {
  ContentLocalizationInput,
  SupportedLocale,
} from "../dto/content-localization.types.js";
import type {
  EmailContentGenerationInput,
  EmailContentPackage,
} from "../dto/email-content.types.js";
import type {
  ProductContentGenerationInput,
  ProductContentPackage,
} from "../dto/product-content.types.js";
import type { SEOContentGenerationInput, SEOContentPackage } from "../dto/seo-content.types.js";
import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentPackage,
} from "../dto/social-media-content.types.js";
import type { VideoScriptGenerationInput, VideoScriptPackage } from "../dto/video-script.types.js";
import { BlogContentToScoringInputMapper } from "./blog-content-to-scoring-input.mapper.js";
import { ContentAggregateToLocalizationInputMapper } from "./content-aggregate-to-localization-input.mapper.js";
import { EmailContentToScoringInputMapper } from "./email-content-to-scoring-input.mapper.js";
import { ProductContentToBlogInputMapper } from "./product-content-to-blog-input.mapper.js";
import { ProductContentToEmailInputMapper } from "./product-content-to-email-input.mapper.js";
import { ProductContentToScoringInputMapper } from "./product-content-to-scoring-input.mapper.js";
import { ProductContentToSEOInputMapper } from "./product-content-to-seo-input.mapper.js";
import { ProductContentToSocialInputMapper } from "./product-content-to-social-input.mapper.js";
import { ProductContentToVideoInputMapper } from "./product-content-to-video-input.mapper.js";
import { ProductToContentInputMapper } from "./product-to-content-input.mapper.js";
import { SEOContentToBlogInputMapper } from "./seo-content-to-blog-input.mapper.js";
import { SEOContentToEmailInputMapper } from "./seo-content-to-email-input.mapper.js";
import { SEOContentToScoringInputMapper } from "./seo-content-to-scoring-input.mapper.js";
import { SEOContentToSocialInputMapper } from "./seo-content-to-social-input.mapper.js";
import { SEOContentToVideoInputMapper } from "./seo-content-to-video-input.mapper.js";
import { SocialContentToBlogInputMapper } from "./social-content-to-blog-input.mapper.js";
import { SocialContentToEmailInputMapper } from "./social-content-to-email-input.mapper.js";
import { SocialContentToScoringInputMapper } from "./social-content-to-scoring-input.mapper.js";
import { SocialContentToVideoInputMapper } from "./social-content-to-video-input.mapper.js";
import { VideoContentToBlogInputMapper } from "./video-content-to-blog-input.mapper.js";
import { VideoContentToEmailInputMapper } from "./video-content-to-email-input.mapper.js";
import { VideoContentToScoringInputMapper } from "./video-content-to-scoring-input.mapper.js";
import { EmailContentToBlogInputMapper } from "./email-content-to-blog-input.mapper.js";

export interface AIContentScoringCandidate {
  readonly stageId: AIContentStageId;
  readonly input: ContentQualityScoringInput;
}

export class AIContentOrchestrationMapper {
  public constructor(
    private readonly productMapper = new ProductToContentInputMapper(),
    private readonly productToSEO = new ProductContentToSEOInputMapper(),
    private readonly productToSocial = new ProductContentToSocialInputMapper(),
    private readonly seoToSocial = new SEOContentToSocialInputMapper(),
    private readonly productToVideo = new ProductContentToVideoInputMapper(),
    private readonly seoToVideo = new SEOContentToVideoInputMapper(),
    private readonly socialToVideo = new SocialContentToVideoInputMapper(),
    private readonly productToEmail = new ProductContentToEmailInputMapper(),
    private readonly seoToEmail = new SEOContentToEmailInputMapper(),
    private readonly socialToEmail = new SocialContentToEmailInputMapper(),
    private readonly videoToEmail = new VideoContentToEmailInputMapper(),
    private readonly productToBlog = new ProductContentToBlogInputMapper(),
    private readonly seoToBlog = new SEOContentToBlogInputMapper(),
    private readonly socialToBlog = new SocialContentToBlogInputMapper(),
    private readonly videoToBlog = new VideoContentToBlogInputMapper(),
    private readonly emailToBlog = new EmailContentToBlogInputMapper(),
    private readonly productScoring = new ProductContentToScoringInputMapper(),
    private readonly seoScoring = new SEOContentToScoringInputMapper(),
    private readonly socialScoring = new SocialContentToScoringInputMapper(),
    private readonly videoScoring = new VideoContentToScoringInputMapper(),
    private readonly emailScoring = new EmailContentToScoringInputMapper(),
    private readonly blogScoring = new BlogContentToScoringInputMapper(),
    private readonly localization = new ContentAggregateToLocalizationInputMapper(),
  ) {}

  public productInput(input: AIContentOrchestrationInput): ProductContentGenerationInput {
    return {
      ...this.productMapper.map(input.product),
      ...(input.targetMarket === undefined ? {} : { targetMarkets: [input.targetMarket] }),
      ...(input.sourceLanguage === undefined ? {} : { language: input.sourceLanguage }),
      ...(input.correlationId.length === 0 ? {} : { correlationId: input.correlationId }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
    };
  }

  public seoInput(
    input: AIContentOrchestrationInput,
    product: ProductContentPackage,
  ): SEOContentGenerationInput {
    return { ...this.productToSEO.map(product), ...input.seoInput };
  }

  public socialInput(
    input: AIContentOrchestrationInput,
    product: ProductContentPackage,
    seo?: SEOContentPackage,
  ): SocialMediaContentGenerationInput {
    return {
      ...this.productToSocial.map(product),
      ...(seo === undefined ? {} : this.seoToSocial.map(seo)),
      ...input.socialInput,
      correlationId: input.correlationId,
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
    } as SocialMediaContentGenerationInput;
  }

  public videoInput(
    input: AIContentOrchestrationInput,
    product: ProductContentPackage,
    seo?: SEOContentPackage,
    social?: SocialMediaContentPackage,
  ): VideoScriptGenerationInput {
    return {
      ...this.productToVideo.map(product),
      ...(seo === undefined ? {} : this.seoToVideo.map(seo)),
      ...(social === undefined ? {} : this.socialToVideo.map(social)),
      ...input.videoInput,
      correlationId: input.correlationId,
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
    } as VideoScriptGenerationInput;
  }

  public emailInput(
    input: AIContentOrchestrationInput,
    product: ProductContentPackage,
    seo?: SEOContentPackage,
    social?: SocialMediaContentPackage,
    video?: VideoScriptPackage,
  ): EmailContentGenerationInput {
    return {
      ...this.productToEmail.map(product),
      ...(seo === undefined ? {} : this.seoToEmail.map(seo)),
      ...(social === undefined ? {} : this.socialToEmail.map(social)),
      ...(video === undefined ? {} : this.videoToEmail.map(video)),
      ...input.emailInput,
      correlationId: input.correlationId,
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
    } as EmailContentGenerationInput;
  }

  public blogInput(
    input: AIContentOrchestrationInput,
    product: ProductContentPackage,
    seo?: SEOContentPackage,
    social?: SocialMediaContentPackage,
    video?: VideoScriptPackage,
    email?: EmailContentPackage,
  ): BlogContentGenerationInput {
    return {
      ...this.productToBlog.map(product),
      ...(seo === undefined ? {} : this.seoToBlog.map(seo)),
      ...(social === undefined ? {} : this.socialToBlog.map(social)),
      ...(video === undefined ? {} : this.videoToBlog.map(video)),
      ...(email === undefined ? {} : this.emailToBlog.map(email)),
      ...input.blogInput,
      correlationMetadata: {
        ...input.blogInput?.correlationMetadata,
        correlationId: input.correlationId,
        ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
      },
    } as BlogContentGenerationInput;
  }

  public scoringCandidates(
    product: ProductContentPackage | undefined,
    seo: SEOContentPackage | undefined,
    social: readonly SocialMediaContentPackage[],
    video: readonly VideoScriptPackage[],
    email: readonly EmailContentPackage[],
    blog: readonly BlogContentPackage[],
  ): readonly AIContentScoringCandidate[] {
    return [
      ...(product === undefined
        ? []
        : [{ stageId: "product-content" as const, input: this.productScoring.map(product) }]),
      ...(seo === undefined
        ? []
        : [{ stageId: "seo-content" as const, input: this.seoScoring.map(seo) }]),
      ...social.map((item) => ({
        stageId: "social-content" as const,
        input: this.socialScoring.map(item),
      })),
      ...video.map((item) => ({
        stageId: "video-content" as const,
        input: this.videoScoring.map(item),
      })),
      ...email.map((item) => ({
        stageId: "email-content" as const,
        input: this.emailScoring.map(item),
      })),
      ...blog.map((item) => ({
        stageId: "blog-content" as const,
        input: this.blogScoring.map(item),
      })),
    ];
  }

  public localizationInputs(
    contents: readonly Content[],
    targetLocales: readonly SupportedLocale[],
  ): readonly ContentLocalizationInput[] {
    return contents.flatMap((content) =>
      targetLocales.map((locale) => this.localization.map(content, locale)),
    );
  }

  public collectContents(
    packages: readonly { readonly contents: readonly Content[] }[],
  ): readonly Content[] {
    const unique = new Map<string, Content>();
    for (const contentPackage of packages) {
      for (const content of contentPackage.contents) {
        if (!unique.has(content.id)) unique.set(content.id, content);
      }
    }
    return [...unique.values()];
  }
}
