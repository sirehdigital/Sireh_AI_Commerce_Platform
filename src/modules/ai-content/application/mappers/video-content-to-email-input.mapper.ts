import type { EmailContentGenerationInput } from "../dto/email-content.types.js";
import type { VideoScriptPackage } from "../dto/video-script.types.js";

export class VideoContentToEmailInputMapper {
  public map(videoScriptPackage: VideoScriptPackage): Partial<EmailContentGenerationInput> {
    return {
      productId: videoScriptPackage.productId,
      productTitle: videoScriptPackage.scriptTitle,
      highlights: videoScriptPackage.onScreenText,
      videoScriptPackage,
      language: videoScriptPackage.language,
      tone: videoScriptPackage.tone,
    };
  }
}
