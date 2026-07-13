import type { VideoScriptGenerationOptions, VideoScriptPackage } from "../dto/video-script.types.js";
import { isPlatformDurationCompatible, wordsPerSceneLimit } from "../factories/video-script-options.factory.js";
import { VideoPlatformCompatibilityError } from "../errors/product-content.errors.js";

export class VideoPlatformCompatibilityService {
  public validate(
    contentPackage: VideoScriptPackage,
    options: VideoScriptGenerationOptions,
  ): void {
    const maxWordsPerScene = wordsPerSceneLimit(Math.max(15, options.targetDurationSeconds / Math.max(1, contentPackage.scenes.length)));
    const errors = [
      ...(!isPlatformDurationCompatible(options.platform, options.targetDurationSeconds)
        ? ["platform_duration_incompatible"]
        : []),
      ...(contentPackage.scenes.length > options.sceneLimit ? ["scene_limit_exceeded"] : []),
      ...(contentPackage.onScreenText.some((text) => text.length > 60) ? ["on_screen_text_too_long"] : []),
      ...(contentPackage.scenes.some((scene) => scene.spokenWordEstimate > maxWordsPerScene)
        ? ["spoken_word_limit_exceeded"]
        : []),
      ...(options.language !== "en" && options.language !== "ms" ? ["unsupported_language"] : []),
      ...(options.platform === "youtube" && options.format === "short-form" && options.targetDurationSeconds > 90
        ? ["youtube_short_form_duration_mismatch"]
        : []),
    ];

    if (errors.length > 0) {
      throw new VideoPlatformCompatibilityError("Video script is incompatible with the selected platform.", {
        errors,
      });
    }
  }
}
