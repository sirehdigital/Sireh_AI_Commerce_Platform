import type {
  VideoScriptGenerationInput,
  VideoScriptGenerationOptions,
  VideoScriptPackage,
} from "../dto/video-script.types.js";

export interface VideoScriptGeneratorPort {
  generate(input: VideoScriptGenerationInput, options: VideoScriptGenerationOptions): VideoScriptPackage;
}
