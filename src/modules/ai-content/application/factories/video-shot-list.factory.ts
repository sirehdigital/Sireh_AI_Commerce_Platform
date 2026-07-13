import type { VideoScene, VideoShot } from "../dto/video-script.types.js";

export class VideoShotListFactory {
  public create(scenes: readonly VideoScene[]): readonly VideoShot[] {
    return scenes.map((scene) => ({
      sequence: scene.sceneNumber,
      shotType: scene.shotType,
      direction: scene.visualDirection,
      sceneNumber: scene.sceneNumber,
    }));
  }
}
