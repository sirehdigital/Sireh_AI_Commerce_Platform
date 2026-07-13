import type { ContentSnapshot } from "../../domain/index.js";
import type { VideoScriptPackage } from "../dto/video-script.types.js";

export interface VideoScriptPackageSnapshot {
  readonly productId: string;
  readonly platform: string;
  readonly format: string;
  readonly objective: string;
  readonly duration: number;
  readonly scriptTitle: string;
  readonly hook: string;
  readonly sceneCount: number;
  readonly contents: readonly ContentSnapshot[];
  readonly generatedAt: Date;
}

export class VideoScriptMapper {
  public toSnapshot(contentPackage: VideoScriptPackage): VideoScriptPackageSnapshot {
    return {
      productId: contentPackage.productId,
      platform: contentPackage.platform,
      format: contentPackage.format,
      objective: contentPackage.objective,
      duration: contentPackage.targetDurationSeconds,
      scriptTitle: contentPackage.scriptTitle,
      hook: contentPackage.hook,
      sceneCount: contentPackage.scenes.length,
      contents: contentPackage.contents.map((content) => content.snapshot()),
      generatedAt: new Date(contentPackage.generatedAt),
    };
  }
}
