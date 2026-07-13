import { describe, expect, it } from "vitest";
import { DeterministicEmailContentGenerator } from "../../infrastructure/generators/index.js";
import { GenerateEmailContentUseCase } from "./generate-email-content.use-case.js";
import { buildEmailInput } from "../../infrastructure/generators/deterministic-email-content.generator.test.js";
import {
  InvalidEmailOfferContextError,
  InvalidPersonalizationTokenError,
  MissingEmailCampaignContextError,
  UnsafeEmailContentError,
  UnsupportedEmailCampaignTypeError,
} from "../errors/index.js";

describe("GenerateEmailContentUseCase", () => {
  const useCase = new GenerateEmailContentUseCase(new DeterministicEmailContentGenerator());

  it("generates complete email package with content aggregates", () => {
    const result = useCase.execute({ input: buildEmailInput(), options: { campaignType: "promotional" } });

    expect(result.campaignType).toBe("promotional");
    expect(result.contents.some((content) => content.snapshot().type === "email-subject")).toBe(true);
    expect(result.contents.some((content) => content.snapshot().type === "email-body")).toBe(true);
    expect(result.sourceMetadata.campaignId).toBe("email-campaign-001");
  });

  it("preserves metadata and deterministic output", () => {
    const first = useCase.execute({ input: buildEmailInput(), options: { includeSequence: true, sequenceLength: 3 } });
    const second = useCase.execute({ input: buildEmailInput(), options: { includeSequence: true, sequenceLength: 3 } });

    expect(first.mainBody).toBe(second.mainBody);
    expect(first.sourceMetadata.correlationId).toBe("email-correlation-001");
  });

  it("rejects unsupported campaign and invalid tokens", () => {
    expect(() => useCase.execute({ input: buildEmailInput(), options: { campaignType: "drip" as never } })).toThrow(
      UnsupportedEmailCampaignTypeError,
    );
    expect(() =>
      useCase.execute({ input: buildEmailInput(), options: { personalizationTokens: ["{{unknown}}"] } }),
    ).toThrow(InvalidPersonalizationTokenError);
  });

  it("rejects missing campaign context", () => {
    expect(() => useCase.execute({ input: buildEmailInput(), options: { campaignType: "abandoned-cart" } })).toThrow(
      MissingEmailCampaignContextError,
    );
    expect(() =>
      useCase.execute({ input: buildEmailInput(), options: { campaignType: "limited-offer-framework" } }),
    ).toThrow(InvalidEmailOfferContextError);
  });

  it("propagates safety errors", () => {
    expect(() =>
      useCase.execute({ input: { ...buildEmailInput(), benefits: ["guaranteed overnight cure"] } }),
    ).toThrow(UnsafeEmailContentError);
  });
});
