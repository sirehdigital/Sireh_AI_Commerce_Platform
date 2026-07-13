import { describe, expect, it } from "vitest";
import { DeterministicEmailContentGenerator } from "../../infrastructure/generators/index.js";
import { buildEmailInput } from "../../infrastructure/generators/deterministic-email-content.generator.test.js";
import { EmailContentOptionsFactory } from "../factories/index.js";
import { EmailComplianceError, InvalidPersonalizationTokenError, UnsafeEmailContentError } from "../errors/index.js";
import {
  EmailCompatibilityValidationService,
  EmailComplianceValidationService,
  EmailContentSafetyService,
  EmailPersonalizationValidationService,
} from "./index.js";

describe("email safety and compliance policies", () => {
  it("detects unsafe email content", () => {
    expect(() => new EmailContentSafetyService().validateText("RE: last chance for 50% off guaranteed results!!!!")).toThrow(
      UnsafeEmailContentError,
    );
  });

  it("allows restrained grounded copy", () => {
    expect(() => new EmailContentSafetyService().validateText("Explore verified product details and choose what fits.")).not.toThrow();
  });

  it("validates personalization tokens", () => {
    const validator = new EmailPersonalizationValidationService();

    expect(() => validator.validateText("Hello {{first_name}}", ["{{first_name}}"])).not.toThrow();
    expect(() => validator.validateText("Hello {{secret_token}}", ["{{first_name}}"])).toThrow(InvalidPersonalizationTokenError);
  });

  it("validates compatibility and compliance", () => {
    const options = new EmailContentOptionsFactory().create({ campaignType: "promotional" });
    const result = new DeterministicEmailContentGenerator().generate(buildEmailInput(), options);

    expect(() => new EmailCompatibilityValidationService().validate(result, options)).not.toThrow();
    expect(() => new EmailComplianceValidationService().validate(buildEmailInput(), options, result)).not.toThrow();
  });

  it("rejects missing unsubscribe placeholder", () => {
    const options = new EmailContentOptionsFactory().create();
    const result = new DeterministicEmailContentGenerator().generate(buildEmailInput(), options);
    const broken = { ...result, unsubscribePlaceholderGuidance: "No unsubscribe here." };

    expect(() => new EmailComplianceValidationService().validate(buildEmailInput(), options, broken)).toThrow(
      EmailComplianceError,
    );
  });
});
