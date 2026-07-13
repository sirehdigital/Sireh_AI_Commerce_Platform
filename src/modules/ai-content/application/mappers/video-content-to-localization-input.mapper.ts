import type { ContentLocalizationInput, SupportedLocale } from "../dto/content-localization.types.js";
import type { VideoScriptPackage } from "../dto/video-script.types.js";

export class VideoContentToLocalizationInputMapper {
  public map(contentPackage: VideoScriptPackage, targetLocale: SupportedLocale): ContentLocalizationInput {
    return {
      sourceContentId: `video-content:${contentPackage.productId}`,
      sourceLanguage: contentPackage.language,
      targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale,
      contentType: "video-script",
      channel: contentPackage.channel,
      tone: contentPackage.tone,
      headline: contentPackage.scriptTitle,
      body: contentPackage.voiceoverScript,
      structuredContent: {
        scenes: contentPackage.scenes.map((scene) => `${scene.sceneNumber}. ${scene.purpose}: ${scene.visualDirection}`).join("\n"),
        onScreenText: contentPackage.onScreenText.join("\n"),
      },
      ...(contentPackage.cta === undefined ? {} : { cta: contentPackage.cta }),
      videoScriptPackage: contentPackage,
      productFacts: contentPackage.productDemonstrationNotes,
      brandTerminology: [],
      protectedTerms: [],
      productNames: [],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: [],
      campaignMetadata: { platform: contentPackage.platform, duration: contentPackage.targetDurationSeconds },
      correlationMetadata: {},
    };
  }
}
