import { Content, CTA, Headline, type ContentChannel, type ContentType } from "../../domain/index.js";
import type {
  VideoScene,
  VideoScriptGenerationInput,
  VideoScriptGenerationOptions,
  VideoScriptPackage,
  VideoScriptWarning,
  VideoShot,
} from "../dto/video-script.types.js";

export interface VideoScriptPackageDraft {
  readonly scriptTitle: string;
  readonly hook: string;
  readonly scenes: readonly VideoScene[];
  readonly shotList: readonly VideoShot[];
  readonly voiceoverScript: string;
  readonly presenterDialogue: string;
  readonly onScreenText: readonly string[];
  readonly visualDirection: readonly string[];
  readonly productDemonstrationNotes: readonly string[];
  readonly bRollSuggestions: readonly string[];
  readonly transitionGuidance: readonly string[];
  readonly musicOrMoodGuidance?: string;
  readonly captionText?: string;
  readonly cta?: string;
  readonly endCardText?: string;
  readonly thumbnailTextSuggestion?: string;
  readonly safetyNotes: readonly string[];
  readonly complianceNotes: readonly string[];
  readonly missingSourceWarnings: readonly VideoScriptWarning[];
}

export class VideoScriptPackageFactory {
  public create(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
    draft: VideoScriptPackageDraft,
  ): VideoScriptPackage {
    const cta = draft.cta === undefined ? undefined : CTA.create(draft.cta);
    const contents = [
      this.content(input, options, primaryContentType(options), "script", draft.scriptTitle, draft.voiceoverScript, cta, {
        scenes: JSON.stringify(draft.scenes),
      }),
      this.content(input, options, "generic-content", "hook", draft.hook, draft.hook),
      this.content(input, options, "generic-content", "voiceover", "Voiceover", draft.voiceoverScript),
      ...(draft.presenterDialogue.length === 0
        ? []
        : [this.content(input, options, "generic-content", "presenter-dialogue", "Presenter Dialogue", draft.presenterDialogue)]),
      ...(draft.onScreenText.length === 0
        ? []
        : [
            this.content(
              input,
              options,
              "generic-content",
              "on-screen-text",
              "On-screen Text",
              draft.onScreenText.join("\n"),
            ),
          ]),
      ...(draft.captionText === undefined
        ? []
        : [this.content(input, options, "social-caption", "caption", draft.scriptTitle, draft.captionText, cta)]),
      ...(cta === undefined
        ? []
        : [this.content(input, options, ctaContentType(options), "cta", cta.value, cta.value, cta)]),
      ...(draft.thumbnailTextSuggestion === undefined
        ? []
        : [
            this.content(
              input,
              options,
              "generic-content",
              "thumbnail",
              draft.thumbnailTextSuggestion,
              draft.thumbnailTextSuggestion,
            ),
          ]),
    ];

    return {
      productId: input.productId,
      platform: options.platform,
      channel: platformToChannel(options.platform),
      format: options.format,
      objective: options.objective,
      contentAngle: options.contentAngle,
      targetDurationSeconds: options.targetDurationSeconds,
      language: options.language,
      tone: options.tone,
      scriptTitle: draft.scriptTitle,
      hook: draft.hook,
      scenes: draft.scenes,
      shotList: draft.shotList,
      voiceoverScript: draft.voiceoverScript,
      presenterDialogue: draft.presenterDialogue,
      onScreenText: draft.onScreenText,
      visualDirection: draft.visualDirection,
      productDemonstrationNotes: draft.productDemonstrationNotes,
      bRollSuggestions: draft.bRollSuggestions,
      transitionGuidance: draft.transitionGuidance,
      ...(draft.musicOrMoodGuidance === undefined ? {} : { musicOrMoodGuidance: draft.musicOrMoodGuidance }),
      ...(draft.captionText === undefined ? {} : { captionText: draft.captionText }),
      ...(cta === undefined ? {} : { cta }),
      ...(draft.endCardText === undefined ? {} : { endCardText: draft.endCardText }),
      ...(draft.thumbnailTextSuggestion === undefined ? {} : { thumbnailTextSuggestion: draft.thumbnailTextSuggestion }),
      safetyNotes: draft.safetyNotes,
      complianceNotes: draft.complianceNotes,
      missingSourceWarnings: draft.missingSourceWarnings,
      contents,
      sourceMetadata: sourceMetadata(input, options),
      generatedAt: new Date(),
    };
  }

  private content(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
    type: ContentType,
    component: string,
    headline: string,
    body: string,
    cta?: CTA,
    structuredContent?: Readonly<Record<string, string>>,
  ): Content {
    return Content.create({
      id: `content:${input.productId}:${options.platform}:${component}`,
      type,
      channel: platformToChannel(options.platform),
      language: options.language,
      tone: options.tone,
      headline: Headline.create(headline.slice(0, 120)),
      body,
      structuredContent: structuredContent ?? {},
      ...(cta === undefined ? {} : { cta }),
      metadata: {
        sourceProductId: input.productId,
        ...(input.sourceMarketingAnalysisId === undefined
          ? {}
          : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
        ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
        tags: ["video-script", options.platform, options.format, component],
        custom: {
          component,
          platform: options.platform,
          format: options.format,
          objective: options.objective,
          contentAngle: options.contentAngle,
        },
      },
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
    });
  }
}

export function platformToChannel(platform: VideoScriptGenerationOptions["platform"]): ContentChannel {
  if (platform === "instagram-reels") {
    return "instagram";
  }
  if (platform === "facebook-reels") {
    return "facebook";
  }
  if (platform === "youtube-shorts") {
    return "youtube";
  }
  if (platform === "generic-video") {
    return "generic";
  }
  return platform;
}

function primaryContentType(options: VideoScriptGenerationOptions): ContentType {
  return options.platform === "facebook-reels" ? "generic-content" : "video-script";
}

function ctaContentType(options: VideoScriptGenerationOptions): ContentType {
  return options.platform === "instagram-reels" ? "cta" : options.platform === "facebook-reels" ? "cta" : "cta";
}

function sourceMetadata(
  input: VideoScriptGenerationInput,
  options: VideoScriptGenerationOptions,
): Readonly<Record<string, unknown>> {
  return {
    productId: input.productId,
    platform: options.platform,
    format: options.format,
    objective: options.objective,
    ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
    ...(input.sourceMarketingAnalysisId === undefined ? {} : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
  };
}
