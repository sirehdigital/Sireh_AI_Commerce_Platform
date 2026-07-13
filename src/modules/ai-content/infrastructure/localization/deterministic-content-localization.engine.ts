import type {
  ContentLocalizationInput,
  ContentLocalizationOptions,
  LocalizedContentPackage,
  LocalizationReviewRequiredItem,
} from "../../application/dto/content-localization.types.js";
import {
  LocaleProfileFactory,
  LocalizationPhraseFactory,
  LocalizationValidationFactory,
  LocalizedContentPackageFactory,
  ProtectedTermFactory,
} from "../../application/factories/index.js";
import type { ContentLocalizationPort } from "../../application/ports/content-localization.port.js";

export class DeterministicContentLocalizationEngine implements ContentLocalizationPort {
  public constructor(
    private readonly localeProfiles = new LocaleProfileFactory(),
    private readonly terms = new ProtectedTermFactory(),
    private readonly phrases = new LocalizationPhraseFactory(),
    private readonly validation = new LocalizationValidationFactory(),
    private readonly packageFactory = new LocalizedContentPackageFactory(),
  ) {}

  public localize(input: ContentLocalizationInput, options: ContentLocalizationOptions): LocalizedContentPackage {
    const sourceProfile = this.localeProfiles.source(options.sourceLocale);
    const targetProfile = this.localeProfiles.target(options.targetLocale);
    const protectedTerms = this.terms.create(input);
    const placeholders = this.terms.placeholders(input);
    const localizedHeadline = this.localizeText(input.headline, options, protectedTerms);
    const localizedBody = this.localizeText(input.body, options, protectedTerms);
    const localizedStructuredContent = Object.fromEntries(
      Object.entries(input.structuredContent).map(([key, value]) => [key, this.localizeText(value, options, protectedTerms)]),
    );
    const localizedCTA = input.cta === undefined
      ? undefined
      : options.adaptCTA
        ? this.phrases.localizeCTA(input.cta.value, sourceProfile, targetProfile, protectedTerms)
        : input.cta.value;
    const localizedSEOText = input.seo === undefined
      ? undefined
      : this.localizeText(
          [input.seo.primaryKeyword?.value ?? "", input.seo.metaTitle?.value ?? "", input.seo.metaDescription?.value ?? ""].join(" "),
          options,
          protectedTerms,
        );
    const sourceText = [input.headline, input.body, ...Object.values(input.structuredContent), input.cta?.value ?? ""].join(" ");
    const targetText = [localizedHeadline, localizedBody, ...Object.values(localizedStructuredContent), localizedCTA ?? ""].join(" ");
    const reviewRequiredItems = reviewItems(input, targetText, options);
    const warnings = warningsFor(input, options, targetText);
    const validationResult = this.validation.create({
      sourceText,
      targetText,
      sourceStructureKeys: Object.keys(input.structuredContent),
      targetStructureKeys: Object.keys(localizedStructuredContent),
      placeholders,
      protectedTerms,
      verifiedClaims: input.verifiedClaims,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      sourceLocale: options.sourceLocale,
      targetLocale: options.targetLocale,
      ...(input.cta === undefined ? {} : { sourceCTA: input.cta.value }),
      ...(localizedCTA === undefined ? {} : { targetCTA: localizedCTA }),
      ...(input.seo === undefined ? {} : { sourceSEO: input.seo.primaryKeyword?.value ?? input.headline }),
      ...(localizedSEOText === undefined ? {} : { targetSEO: localizedSEOText }),
      warnings,
      reviewRequiredItems,
    });

    return this.packageFactory.create(input, options, {
      localizedHeadline,
      localizedBody,
      localizedStructuredContent,
      ...(localizedCTA === undefined ? {} : { localizedCTA }),
      ...(options.adaptSlug ? { localizedSlug: slugFor(localizedHeadline, targetProfile.seoFillerWords) } : {}),
      localizedHeadings: localizeHeadings(input, (value) => this.localizeText(value, options, protectedTerms)),
      localizedCaptions: localizeCaptions(input, (value) => this.localizeText(value, options, protectedTerms)),
      localizedSubjectLines: input.emailContentPackage?.subjectLines.map((line) => this.localizeText(line, options, protectedTerms)) ?? [],
      localizedPreheaders: input.emailContentPackage?.preheaders.map((line) => this.localizeText(line, options, protectedTerms)) ?? [],
      localizedScriptScenes: input.videoScriptPackage?.scenes.map((scene) => this.localizeText([scene.purpose, scene.visualDirection, scene.voiceover ?? "", scene.presenterDialogue ?? "", scene.onScreenText ?? ""].join(" | "), options, protectedTerms)) ?? [],
      localizedEmailSections: input.emailContentPackage?.htmlSafeSections.map((section) => this.localizeText([section.title, section.body].join(" | "), options, protectedTerms)) ?? [],
      localizedBlogSections: input.blogContentPackage?.sections.map((section) => this.localizeText([section.heading, ...section.paragraphs].join(" | "), options, protectedTerms)) ?? [],
      preservedTerms: protectedTerms,
      preservedPlaceholders: placeholders,
      changedTerms: changedTerms(input, localizedHeadline, localizedBody),
      regionalAdaptations: regionalAdaptations(options),
      warnings,
      reviewRequiredItems,
      validationResult,
    });
  }

  private localizeText(
    value: string,
    options: ContentLocalizationOptions,
    protectedTerms: readonly string[],
  ): string {
    if (options.localizationMode === "validate-only") {
      return value;
    }
    const sourceProfile = this.localeProfiles.source(options.sourceLocale);
    const targetProfile = this.localeProfiles.target(options.targetLocale);
    return this.phrases.localizeText(value, sourceProfile, targetProfile, protectedTerms, options.adaptSpelling);
  }
}

function localizeHeadings(input: ContentLocalizationInput, localize: (value: string) => string): readonly string[] {
  return [
    ...(input.seoContentPackage === undefined ? [] : [input.seoContentPackage.h1, ...input.seoContentPackage.h2Headings]),
    ...(input.blogContentPackage?.outline.map((item) => item.heading) ?? []),
    ...(input.blogContentPackage?.sections.map((section) => section.heading) ?? []),
  ].map(localize);
}

function localizeCaptions(input: ContentLocalizationInput, localize: (value: string) => string): readonly string[] {
  return [
    ...(input.socialMediaContentPackage === undefined
      ? []
      : [input.socialMediaContentPackage.primaryCaption, input.socialMediaContentPackage.shortCaption, input.socialMediaContentPackage.longCaption ?? ""]),
    ...(input.videoScriptPackage?.captionText === undefined ? [] : [input.videoScriptPackage.captionText]),
  ].filter((value) => value.length > 0).map(localize);
}

function reviewItems(
  input: ContentLocalizationInput,
  targetText: string,
  options: ContentLocalizationOptions,
): readonly LocalizationReviewRequiredItem[] {
  const items: LocalizationReviewRequiredItem[] = [];
  const sourceText = [input.headline, input.body, ...Object.values(input.structuredContent)].join(" ");
  if (/\b(clinically proven|cure|medical grade|regulatory|legal|warranty)\b/iu.test(sourceText)) {
    items.push(item("claims", "Medical, safety, legal or regulated wording requires specialist review.", "critical", true, "compliance reviewer"));
  }
  if (options.adaptCurrencyReferences && /[$£€RM]\s?\d/u.test(sourceText)) {
    items.push(item("currency", "Currency references require verified conversion data before adaptation.", "high", true, "regional commerce reviewer"));
  }
  if (sourceText.length > 180 && changedRatio(sourceText, targetText) < 0.08 && options.sourceLocale !== options.targetLocale) {
    items.push(item("body", "Free-form prose has limited controlled phrase coverage and requires review.", "medium", false, "bilingual content reviewer"));
  }
  if (input.contentType === "video-script" && targetText.length > sourceText.length * 1.35) {
    items.push(item("video", "Localized script may overflow timing limits.", "medium", false, "video producer"));
  }
  return items;
}

function item(
  section: string,
  reason: string,
  severity: LocalizationReviewRequiredItem["severity"],
  blocking: boolean,
  reviewer: string,
): LocalizationReviewRequiredItem {
  return { section, reason, severity, blocking, suggestedReviewerType: reviewer, sourceTextReference: section };
}

function warningsFor(input: ContentLocalizationInput, options: ContentLocalizationOptions, targetText: string): readonly string[] {
  return [
    ...(options.adaptCurrencyReferences ? ["Currency formatting guidance only; no conversion performed."] : []),
    ...(input.regulatoryNotes.length > 0 ? ["Regulatory notes preserved; specialist review may be required."] : []),
    ...(targetText.includes("{{unsubscribe_url}}") ? ["Email unsubscribe placeholder preserved."] : []),
  ];
}

function changedTerms(input: ContentLocalizationInput, headline: string, body: string): readonly string[] {
  const source = `${input.headline} ${input.body}`;
  const target = `${headline} ${body}`;
  return ["product", "guide", "benefit", "cart", "learn more"].filter((term) => source.toLowerCase().includes(term) && !target.toLowerCase().includes(term));
}

function regionalAdaptations(options: ContentLocalizationOptions): readonly string[] {
  return [
    ...(options.adaptSpelling ? [`Regional spelling adapted for ${options.targetLocale}.`] : []),
    ...(options.adaptDateFormatGuidance ? [`Date format guidance follows ${options.targetLocale}.`] : []),
    ...(options.adaptNumberFormatGuidance ? ["Numeric values preserved; formatting guidance only."] : []),
  ];
}

function slugFor(value: string, fillerWords: readonly string[]): string {
  const words = value
    .toLowerCase()
    .split(/\s+/u)
    .filter((word) => !fillerWords.includes(word));
  return words.join("-").replace(/[^a-z0-9-]/gu, "").replace(/-+/gu, "-").replace(/^-|-$/gu, "") || "localized-content";
}

function changedRatio(source: string, target: string): number {
  if (source.length === 0) {
    return 1;
  }
  return Math.abs(source.length - target.length) / source.length;
}
