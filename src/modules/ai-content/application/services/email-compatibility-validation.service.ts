import type { EmailContentGenerationOptions, EmailContentPackage } from "../dto/email-content.types.js";
import { EmailSequenceValidationError, InvalidEmailPreheaderError, InvalidEmailSubjectError } from "../errors/product-content.errors.js";

export class EmailCompatibilityValidationService {
  public validate(contentPackage: EmailContentPackage, options: EmailContentGenerationOptions): void {
    const invalidSubjects = contentPackage.subjectLines.filter((subject) => subject.length > 72 || /^(re|fwd):/iu.test(subject));
    const invalidPreheaders = contentPackage.preheaders.filter((preheader) => preheader.length > 110);

    if (invalidSubjects.length > 0) {
      throw new InvalidEmailSubjectError("Email subject line failed validation.", { invalidSubjects });
    }

    if (invalidPreheaders.length > 0) {
      throw new InvalidEmailPreheaderError("Email preheader failed validation.", { invalidPreheaders });
    }

    if (options.includeSequence && contentPackage.sequence.length !== options.sequenceLength) {
      throw new EmailSequenceValidationError("Email sequence length does not match options.", {
        expected: options.sequenceLength,
        actual: contentPackage.sequence.length,
      });
    }

    const repeatedCtaCount = contentPackage.mainBody.split(contentPackage.cta.value).length - 1;
    if (repeatedCtaCount > 3) {
      throw new EmailSequenceValidationError("Email content repeats CTA too often.", { repeatedCtaCount });
    }
  }
}
