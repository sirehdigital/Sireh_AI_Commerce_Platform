import type { BlogContentGenerationInput } from "../dto/blog-content.types.js";
import type { VideoScriptPackage } from "../dto/video-script.types.js";

export class VideoContentToBlogInputMapper {
  public map(contentPackage: VideoScriptPackage): Partial<BlogContentGenerationInput> {
    return {
      productId: contentPackage.productId,
      highlights: contentPackage.scenes.map((scene) => scene.purpose).slice(0, 5),
      usageGuidance: contentPackage.shotList.map((shot) => shot.direction).slice(0, 5),
      videoScriptPackage: contentPackage,
    };
  }
}
