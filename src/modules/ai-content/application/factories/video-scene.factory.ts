import type {
  VideoScene,
  VideoScriptGenerationInput,
  VideoScriptGenerationOptions,
  VideoTiming,
} from "../dto/video-script.types.js";

export class VideoSceneFactory {
  public create(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
    timings: readonly VideoTiming[],
    hook: string,
    cta: string,
  ): readonly VideoScene[] {
    const purposes = this.purposes(input, options).slice(0, timings.length);

    return timings.map((timing, index) => {
      const purpose = purposes[index] ?? "Summary";
      const isLast = index === timings.length - 1;
      const voiceover = options.voiceoverEnabled ? this.voiceover(input, options, purpose, hook, cta, isLast) : undefined;
      const presenterDialogue = options.presenterDialogueEnabled
        ? this.presenterDialogue(input, options, purpose, cta, isLast)
        : undefined;
      const onScreenText = options.onScreenTextEnabled ? this.overlay(input, options, purpose, isLast) : undefined;

      return {
        sceneNumber: index + 1,
        purpose,
        timing,
        shotType: this.shotType(index, isLast, options),
        visualDirection: this.visualDirection(input, purpose, options),
        ...(voiceover === undefined ? {} : { voiceover }),
        ...(presenterDialogue === undefined ? {} : { presenterDialogue }),
        ...(onScreenText === undefined ? {} : { onScreenText }),
        productFocus: input.productType ?? input.category ?? input.productTitle,
        ctaMarker: isLast,
        ...(options.includeTransitions ? { transition: isLast ? "Clean end-card transition." : "Simple cut to next scene." } : {}),
        ...(options.includeBRoll ? { bRollSuggestion: this.bRoll(input, purpose) } : {}),
        complianceNote: "Use only verified product facts and approved source claims.",
        spokenWordEstimate: wordCount([voiceover, presenterDialogue].filter(Boolean).join(" ")),
      };
    });
  }

  private purposes(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
  ): readonly string[] {
    const core =
      options.targetDurationSeconds <= 30
        ? ["Hook", "Problem or context", "Product solution", "Primary benefit", "CTA"]
        : [
            "Opening hook",
            "Audience context",
            "Product introduction",
            "Problem",
            "Solution",
            "Benefits",
            "Feature explanation",
            input.usageInstructions?.length === undefined || input.usageInstructions.length === 0
              ? "Product detail"
              : "Usage or demonstration",
            "Summary",
            "CTA",
          ];

    if (options.format === "testimonial-framework") {
      return ["Hook", "Verified proof placeholder", "Product context", "Benefit", "CTA"];
    }

    if (options.format === "unboxing-framework") {
      return ["Hook", "Product reveal", "Available packaging note", "Feature detail", "CTA"];
    }

    return core;
  }

  private voiceover(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
    purpose: string,
    hook: string,
    cta: string,
    isLast: boolean,
  ): string {
    if (purpose.toLowerCase().includes("hook")) {
      return hook;
    }

    if (isLast) {
      return cta;
    }

    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const feature = input.features?.[0] ?? input.productType ?? input.category ?? "product detail";

    return options.language === "ms"
      ? `${purpose}: ${input.productTitle} memberi tumpuan kepada ${benefit} dengan sokongan ${feature}.`
      : `${purpose}: ${input.productTitle} focuses on ${benefit} with support from ${feature}.`;
  }

  private presenterDialogue(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
    purpose: string,
    cta: string,
    isLast: boolean,
  ): string {
    if (isLast) {
      return cta;
    }

    return options.language === "ms"
      ? `Mari lihat ${input.productTitle} dari sudut ${purpose.toLowerCase()}.`
      : `Let's look at ${input.productTitle} through the ${purpose.toLowerCase()} angle.`;
  }

  private overlay(
    input: VideoScriptGenerationInput,
    options: VideoScriptGenerationOptions,
    purpose: string,
    isLast: boolean,
  ): string {
    const text = isLast ? this.ctaOverlay(options) : `${purpose}: ${input.productTitle}`;
    return text.length <= 54 ? text : `${text.slice(0, 51).trim()}...`;
  }

  private ctaOverlay(options: VideoScriptGenerationOptions): string {
    return options.language === "ms" ? "Lihat butiran produk" : "Explore the product details";
  }

  private shotType(index: number, isLast: boolean, options: VideoScriptGenerationOptions): string {
    if (isLast) {
      return "End card";
    }
    if (index === 0) {
      return options.presenterStyle === "presenter-to-camera" ? "Presenter shot" : "Product close-up";
    }
    return index % 2 === 0 ? "Detail shot" : "Medium shot";
  }

  private visualDirection(
    input: VideoScriptGenerationInput,
    purpose: string,
    options: VideoScriptGenerationOptions,
  ): string {
    if (purpose === "Available packaging note" && input.sourceMediaMetadata?.packagingDescription !== undefined) {
      return `Show packaging only as supplied: ${input.sourceMediaMetadata.packagingDescription}.`;
    }

    if (purpose.toLowerCase().includes("demonstration") && input.usageInstructions?.[0] !== undefined) {
      return `Show safe usage step: ${input.usageInstructions[0]}.`;
    }

    return options.language === "ms"
      ? `Arah visual ringkas untuk ${input.productTitle} berdasarkan maklumat produk.`
      : `Clean visual direction for ${input.productTitle} grounded in product information.`;
  }

  private bRoll(input: VideoScriptGenerationInput, purpose: string): string {
    if (purpose.toLowerCase().includes("feature")) {
      return `Detail shot of ${input.features?.[0] ?? input.productTitle}.`;
    }

    return `Product B-roll for ${input.productTitle}.`;
  }
}

function wordCount(value: string): number {
  return value.split(/\s+/u).filter(Boolean).length;
}
