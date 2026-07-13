import type { EmailContentGenerationInput, EmailContentGenerationOptions, EmailSequenceItem } from "../dto/email-content.types.js";

export class EmailSequenceFactory {
  public create(
    input: EmailContentGenerationInput,
    options: EmailContentGenerationOptions,
    subjectLines: readonly string[],
    preheaders: readonly string[],
    cta: string,
  ): readonly EmailSequenceItem[] {
    if (!options.includeSequence) {
      return [];
    }

    const purposes = ["Introduction or reminder", "Education or value", "Objection handling", "Verified proof placeholder", "Final CTA without fabricated urgency"];

    return purposes.slice(0, options.sequenceLength).map((purpose, index) => ({
      position: index + 1,
      purpose,
      subjectLine: subjectLines[index % subjectLines.length] ?? subjectLines[0] ?? input.productTitle,
      preheader: preheaders[index % preheaders.length] ?? preheaders[0] ?? input.productTitle,
      headline: `${purpose}: ${input.productTitle}`,
      bodySummary: `${purpose} using verified product details for ${input.productTitle}.`,
      cta,
      delayGuidance: index === 0 ? "Send as the first message in the sequence." : `Send after the previous email when the campaign workflow allows.`,
    }));
  }
}
