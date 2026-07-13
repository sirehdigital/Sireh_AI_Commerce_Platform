import type {
  VideoScriptGenerationInput,
  VideoScriptGenerationOptions,
  VideoScriptPackage,
  VideoScriptWarning,
} from "../../application/dto/video-script.types.js";
import {
  VideoSceneFactory,
  VideoScriptPackageFactory,
  VideoShotListFactory,
  VideoTimingFactory,
} from "../../application/factories/index.js";
import type { VideoScriptGeneratorPort } from "../../application/ports/video-script-generator.port.js";

export class DeterministicVideoScriptGenerator implements VideoScriptGeneratorPort {
  public constructor(
    private readonly timingFactory = new VideoTimingFactory(),
    private readonly sceneFactory = new VideoSceneFactory(),
    private readonly shotListFactory = new VideoShotListFactory(),
    private readonly packageFactory = new VideoScriptPackageFactory(),
  ) {}

  public generate(input: VideoScriptGenerationInput, options: VideoScriptGenerationOptions): VideoScriptPackage {
    const sceneCount = this.sceneCount(input, options);
    const hook = this.hook(input, options);
    const cta = this.cta(options);
    const timings = this.timingFactory.create(options.targetDurationSeconds, sceneCount);
    const scenes = this.sceneFactory.create(input, options, timings, hook, cta);
    const shotList = this.shotListFactory.create(scenes);
    const voiceoverScript = scenes.map((scene) => scene.voiceover).filter(Boolean).join(" ");
    const presenterDialogue = scenes.map((scene) => scene.presenterDialogue).filter(Boolean).join(" ");
    const onScreenText = dedupe(scenes.map((scene) => scene.onScreenText).filter((text): text is string => text !== undefined));

    return this.packageFactory.create(input, options, {
      scriptTitle: this.scriptTitle(input, options),
      hook,
      scenes,
      shotList,
      voiceoverScript,
      presenterDialogue,
      onScreenText,
      visualDirection: scenes.map((scene) => scene.visualDirection),
      productDemonstrationNotes: this.demonstrationNotes(input, options),
      bRollSuggestions: scenes.map((scene) => scene.bRollSuggestion).filter((text): text is string => text !== undefined),
      transitionGuidance: scenes.map((scene) => scene.transition).filter((text): text is string => text !== undefined),
      ...(options.includeMusicOrMoodGuidance ? { musicOrMoodGuidance: this.mood(options) } : {}),
      ...(options.captionEnabled ? { captionText: this.caption(input, options, hook) } : {}),
      ...(options.ctaEnabled ? { cta } : {}),
      ...(options.ctaEnabled ? { endCardText: this.endCard(options) } : {}),
      ...(options.includeThumbnailSuggestion ? { thumbnailTextSuggestion: this.thumbnail(input, options) } : {}),
      safetyNotes: ["Use only verified product facts, approved claims and safe product-use context."],
      complianceNotes: this.complianceNotes(input, options),
      missingSourceWarnings: this.missingSourceWarnings(input, options),
    });
  }

  private sceneCount(input: VideoScriptGenerationInput, options: VideoScriptGenerationOptions): number {
    const preferred = options.targetDurationSeconds <= 30 ? 5 : options.targetDurationSeconds <= 90 ? 7 : 10;
    const supportedSections = [
      "hook",
      ...(input.targetAudience?.customerProblems?.length === undefined ? [] : ["problem"]),
      "solution",
      ...(input.benefits?.length === undefined || input.benefits.length === 0 ? [] : ["benefit"]),
      ...(input.features?.length === undefined || input.features.length === 0 ? [] : ["feature"]),
      ...(options.includeDemonstration && input.usageInstructions?.[0] !== undefined ? ["demonstration"] : []),
      "cta",
    ];

    return Math.min(options.sceneLimit, Math.max(3, Math.min(preferred, supportedSections.length + 1)));
  }

  private scriptTitle(input: VideoScriptGenerationInput, options: VideoScriptGenerationOptions): string {
    const format = options.format.replace(/-/gu, " ");
    return `${input.productTitle} ${format}`.slice(0, 120);
  }

  private hook(input: VideoScriptGenerationInput, options: VideoScriptGenerationOptions): string {
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const problem = input.targetAudience?.customerProblems?.[0] ?? "choosing the right product";

    if (options.language === "ms") {
      if (options.hookStyle === "demonstration") {
        return `Mari lihat cara ${input.productTitle} membantu dengan ${benefit}.`;
      }
      if (options.hookStyle === "educational") {
        return `Ini perkara penting sebelum memilih ${input.productTitle}.`;
      }
      if (options.hookStyle === "problem") {
        return `${problem} boleh jadi lebih mudah dengan maklumat yang jelas.`;
      }
      return `Sedang mencari pilihan yang sesuai untuk ${input.productTitle}?`;
    }

    if (options.hookStyle === "demonstration") {
      return `Here is a grounded look at how ${input.productTitle} supports ${benefit}.`;
    }
    if (options.hookStyle === "educational") {
      return `Here is what to know before choosing ${input.productTitle}.`;
    }
    if (options.hookStyle === "problem") {
      return `${problem} gets easier when the product details are clear.`;
    }
    if (options.hookStyle === "direct-benefit") {
      return `${input.productTitle} helps with ${benefit}.`;
    }
    return `Looking for a clearer way to choose ${input.productTitle}?`;
  }

  private cta(options: VideoScriptGenerationOptions): string {
    const english: Record<VideoScriptGenerationOptions["objective"], string> = {
      awareness: "Discover the full details",
      engagement: "Save this video for later",
      traffic: "Visit the product page",
      conversion: "Shop now",
      education: "Learn more",
      "product-launch": "Explore the launch",
      demonstration: "See the product details",
      retargeting: "Take another look",
      "brand-positioning": "Explore the brand story",
    };
    const malay: Record<VideoScriptGenerationOptions["objective"], string> = {
      awareness: "Ketahui butiran penuh",
      engagement: "Simpan video ini untuk rujukan",
      traffic: "Lawati halaman produk",
      conversion: "Beli sekarang",
      education: "Ketahui lebih lanjut",
      "product-launch": "Terokai pelancaran",
      demonstration: "Lihat butiran produk",
      retargeting: "Lihat semula pilihan ini",
      "brand-positioning": "Terokai kisah jenama",
    };

    return options.language === "ms" ? malay[options.objective] : english[options.objective];
  }

  private caption(input: VideoScriptGenerationInput, options: VideoScriptGenerationOptions, hook: string): string {
    const keyword = input.seoContentPackage?.keywords.primaryKeyword.value;
    const text = keyword === undefined ? `${hook} ${this.cta(options)}.` : `${hook} ${this.cta(options)}. ${keyword}.`;
    return text.length <= 220 ? text : `${text.slice(0, 217).trim()}...`;
  }

  private thumbnail(input: VideoScriptGenerationInput, options: VideoScriptGenerationOptions): string {
    const base = options.language === "ms" ? `Kenali ${input.productTitle}` : `Meet ${input.productTitle}`;
    return base.length <= 48 ? base : `${base.slice(0, 45).trim()}...`;
  }

  private endCard(options: VideoScriptGenerationOptions): string {
    return options.language === "ms" ? "Lihat butiran produk" : "Explore the product details";
  }

  private mood(options: VideoScriptGenerationOptions): string {
    return options.language === "ms"
      ? "Mood bersih, jelas dan profesional; elakkan tuntutan dramatik."
      : "Clean, clear and professional mood; avoid dramatic unsupported claims.";
  }

  private demonstrationNotes(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
  ): readonly string[] {
    if (!options.includeDemonstration) {
      return [];
    }

    if (input.usageInstructions?.length === undefined || input.usageInstructions.length === 0) {
      return ["Demonstration should show product details only; no usage steps were supplied."];
    }

    return input.usageInstructions.slice(0, 3).map((instruction) => `Show supplied usage step: ${instruction}`);
  }

  private complianceNotes(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
  ): readonly string[] {
    return [
      ...(options.format === "testimonial-framework"
        ? ["Insert verified testimonial content only. Do not fabricate names, ratings or results."]
        : []),
      ...(options.format === "unboxing-framework" && input.sourceMediaMetadata?.packagingDescription === undefined
        ? ["Unboxing framework must avoid packaging details because no packaging source was supplied."]
        : []),
      ...(input.productRisks ?? []).map((risk) => `Source risk note: ${risk}`),
    ];
  }

  private missingSourceWarnings(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
  ): readonly VideoScriptWarning[] {
    return [
      ...(input.usageInstructions?.length === undefined || input.usageInstructions.length === 0
        ? [{ code: "MISSING_USAGE_INSTRUCTIONS", message: "Usage or demonstration scenes are limited to product facts." }]
        : []),
      ...(options.format === "unboxing-framework" && input.sourceMediaMetadata?.packagingDescription === undefined
        ? [{ code: "MISSING_PACKAGING_SOURCE", message: "Packaging details are not supplied." }]
        : []),
    ];
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
