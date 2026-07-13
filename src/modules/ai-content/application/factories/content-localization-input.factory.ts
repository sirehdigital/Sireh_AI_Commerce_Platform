import type { ContentSnapshot } from "../../domain/index.js";
import type { ContentLocalizationInput } from "../dto/content-localization.types.js";
import {
  InvalidContentLocalizationInputError,
  InvalidPersonalizationTokenError,
  MissingLocalizationSourceError,
} from "../errors/product-content.errors.js";
import { LocaleProfileFactory } from "./locale-profile.factory.js";
import { PersonalizationTokenFactory } from "./personalization-token.factory.js";

const PLACEHOLDER_PATTERN = /\{\{[a-z_]+\}\}/gu;

export class ContentLocalizationInputFactory {
  public constructor(
    private readonly localeProfiles = new LocaleProfileFactory(),
    private readonly personalizationTokens = new PersonalizationTokenFactory(),
  ) {}

  public create(input: ContentLocalizationInput): ContentLocalizationInput {
    const sourceContentId = clean(input.sourceContentId);
    const headline = clean(input.headline);
    const body = input.body.trim();
    if (sourceContentId === undefined) {
      throw new MissingLocalizationSourceError("Source content ID is required for localization.");
    }
    if (headline === undefined && body.length === 0 && Object.keys(input.structuredContent).length === 0) {
      throw new MissingLocalizationSourceError("Headline, body or structured content is required for localization.");
    }

    const sourceLocale = input.sourceLocale === undefined ? undefined : this.localeProfiles.source(input.sourceLocale).locale;
    const targetProfile = this.localeProfiles.target(input.targetLocale);
    if (targetProfile.language !== input.targetLanguage) {
      throw new InvalidContentLocalizationInputError("Target language must match the target locale.", {
        targetLanguage: input.targetLanguage,
        targetLocale: input.targetLocale,
      });
    }
    if (sourceLocale !== undefined && this.localeProfiles.source(sourceLocale).language !== input.sourceLanguage) {
      throw new InvalidContentLocalizationInputError("Source language must match the source locale.", {
        sourceLanguage: input.sourceLanguage,
        sourceLocale,
      });
    }

    const sourceTexts = [input.headline, input.body, ...Object.values(input.structuredContent)];
    const detectedTokens = sourceTexts.flatMap((value) => value.match(PLACEHOLDER_PATTERN) ?? []);
    assertBalancedPlaceholders(sourceTexts);
    const validatedTokens = this.personalizationTokens.create([...input.personalizationTokens, ...detectedTokens]);

    return {
      sourceContentId,
      ...(input.sourceContent === undefined ? {} : { sourceContent: input.sourceContent }),
      sourceLanguage: input.sourceLanguage,
      ...(sourceLocale === undefined ? {} : { sourceLocale }),
      targetLanguage: input.targetLanguage,
      targetLocale: targetProfile.locale,
      contentType: input.contentType,
      channel: input.channel,
      tone: input.tone,
      ...(input.audience === undefined ? {} : { audience: input.audience }),
      headline: headline ?? "",
      body,
      structuredContent: { ...input.structuredContent },
      ...(input.cta === undefined ? {} : { cta: input.cta }),
      ...(input.seo === undefined ? {} : { seo: input.seo }),
      ...(input.productContentPackage === undefined ? {} : { productContentPackage: input.productContentPackage }),
      ...(input.seoContentPackage === undefined ? {} : { seoContentPackage: input.seoContentPackage }),
      ...(input.socialMediaContentPackage === undefined ? {} : { socialMediaContentPackage: input.socialMediaContentPackage }),
      ...(input.videoScriptPackage === undefined ? {} : { videoScriptPackage: input.videoScriptPackage }),
      ...(input.emailContentPackage === undefined ? {} : { emailContentPackage: input.emailContentPackage }),
      ...(input.blogContentPackage === undefined ? {} : { blogContentPackage: input.blogContentPackage }),
      productFacts: cleanList(input.productFacts),
      brandTerminology: cleanList(input.brandTerminology),
      protectedTerms: cleanList(input.protectedTerms),
      productNames: cleanList(input.productNames),
      brandNames: cleanList(input.brandNames),
      personalizationTokens: cleanList(validatedTokens),
      verifiedClaims: cleanList(input.verifiedClaims),
      regulatoryNotes: cleanList(input.regulatoryNotes),
      campaignMetadata: { ...input.campaignMetadata },
      correlationMetadata: { ...input.correlationMetadata },
    };
  }

  public fromContent(content: ContentLocalizationInput["sourceContent"], targetLocale: ContentLocalizationInput["targetLocale"]): ContentLocalizationInput {
    if (content === undefined) {
      throw new MissingLocalizationSourceError("Source Content aggregate is required for localization.");
    }
    const snapshot: ContentSnapshot = content.snapshot();
    return {
      sourceContentId: snapshot.id,
      sourceContent: content,
      sourceLanguage: snapshot.language,
      targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale,
      contentType: snapshot.type,
      channel: snapshot.channel,
      tone: snapshot.tone,
      ...(snapshot.audience === undefined ? {} : { audience: snapshot.audience }),
      headline: snapshot.headline.value,
      body: snapshot.body,
      structuredContent: snapshot.structuredContent,
      ...(snapshot.cta === undefined ? {} : { cta: snapshot.cta }),
      ...(snapshot.seo === undefined ? {} : { seo: snapshot.seo }),
      productFacts: [],
      brandTerminology: [],
      protectedTerms: [],
      productNames: [],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: [],
      campaignMetadata: {
        ...(snapshot.metadata.campaignId === undefined ? {} : { campaignId: snapshot.metadata.campaignId }),
      },
      correlationMetadata: {
        ...(snapshot.metadata.correlationId === undefined ? {} : { correlationId: snapshot.metadata.correlationId }),
      },
    };
  }
}

function assertBalancedPlaceholders(values: readonly string[]): void {
  const malformed = values.filter((value) => {
    const withoutValidTokens = value.replace(PLACEHOLDER_PATTERN, "");
    return withoutValidTokens.includes("{{") || withoutValidTokens.includes("}}");
  });
  if (malformed.length > 0) {
    throw new InvalidPersonalizationTokenError("Localization source contains a malformed personalization token.");
  }
}

function clean(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function cleanList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => clean(value)).filter((value): value is string => value !== undefined))];
}
