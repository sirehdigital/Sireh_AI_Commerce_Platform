import type { VideoScriptPackage } from "../dto/video-script.types.js";
import { InvalidSceneTimingError } from "../errors/product-content.errors.js";

export class VideoTimingValidationService {
  public validate(contentPackage: VideoScriptPackage): void {
    const scenes = contentPackage.scenes;
    const total = scenes.reduce((sum, scene) => sum + scene.timing.durationSeconds, 0);
    const errors = [
      ...(total !== contentPackage.targetDurationSeconds ? ["duration_total_mismatch"] : []),
      ...scenes.flatMap((scene, index) => [
        ...(scene.timing.durationSeconds <= 0 ? [`scene_${scene.sceneNumber}_zero_or_negative_duration`] : []),
        ...(scene.timing.startSecond < 0 ? [`scene_${scene.sceneNumber}_negative_start`] : []),
        ...(scene.timing.endSecond <= scene.timing.startSecond ? [`scene_${scene.sceneNumber}_invalid_end`] : []),
        ...(index > 0 && scene.timing.startSecond !== scenes[index - 1]!.timing.endSecond
          ? [`scene_${scene.sceneNumber}_overlap_or_gap`]
          : []),
      ]),
    ];

    if (errors.length > 0) {
      throw new InvalidSceneTimingError("Video scene timing is invalid.", { errors });
    }
  }
}
