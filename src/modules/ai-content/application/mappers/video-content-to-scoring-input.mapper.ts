import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import type { VideoScriptPackage } from "../dto/video-script.types.js";

export class VideoContentToScoringInputMapper {
  public map(contentPackage: VideoScriptPackage): ContentQualityScoringInput {
    return {
      contentId: `score:${contentPackage.productId}:video-content`,
      contentType: "video-script",
      channel: contentPackage.channel,
      language: contentPackage.language,
      tone: contentPackage.tone,
      headline: contentPackage.scriptTitle,
      body: contentPackage.voiceoverScript,
      structuredContent: {
        scenes: contentPackage.scenes.map((scene) => `${scene.sceneNumber}. ${scene.purpose}: ${scene.visualDirection}`).join("\n"),
        shots: contentPackage.shotList.map((shot) => `${shot.sequence}. ${shot.direction}`).join("\n"),
      },
      ...(contentPackage.cta === undefined ? {} : { cta: contentPackage.cta }),
      sourceMetadata: { productId: contentPackage.productId, sourcePackage: "video-content", platform: contentPackage.platform },
      campaignMetadata: {},
      correlationMetadata: {},
      videoScriptPackage: contentPackage,
    };
  }
}
