import type { VideoDurationSeconds, VideoTiming } from "../dto/video-script.types.js";

export class VideoTimingFactory {
  public create(totalDuration: VideoDurationSeconds, sceneCount: number): readonly VideoTiming[] {
    const base = Math.floor(totalDuration / sceneCount);
    const remainder = totalDuration % sceneCount;
    let cursor = 0;

    return Array.from({ length: sceneCount }, (_, index) => {
      const durationSeconds = base + (index < remainder ? 1 : 0);
      const timing = {
        startSecond: cursor,
        endSecond: cursor + durationSeconds,
        durationSeconds,
      };
      cursor += durationSeconds;
      return timing;
    });
  }
}
