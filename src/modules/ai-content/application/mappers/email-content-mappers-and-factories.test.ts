import { describe, expect, it } from "vitest";
import { DeterministicEmailContentGenerator } from "../../infrastructure/generators/index.js";
import { buildEmailInput } from "../../infrastructure/generators/deterministic-email-content.generator.test.js";
import { EmailContentInputFactory, EmailContentOptionsFactory } from "../factories/index.js";
import { EmailContentMapper, MarketingToEmailInputMapper } from "./index.js";
import { MissingEmailCampaignContextError } from "../errors/index.js";

describe("email content mappers and factories", () => {
  it("normalizes input and rejects missing source", () => {
    const factory = new EmailContentInputFactory();

    expect(factory.create({ ...buildEmailInput(), productTitle: "  Glow Daily Serum  " }).productTitle).toBe("Glow Daily Serum");
    expect(() => factory.create({ ...buildEmailInput(), productId: " " })).toThrow(MissingEmailCampaignContextError);
  });

  it("applies option defaults", () => {
    const options = new EmailContentOptionsFactory().create({ campaignType: "educational-nurture" });

    expect(options.objective).toBe("education");
    expect(options.includePlainTextVersion).toBe(true);
  });

  it("maps marketing inputs without external module coupling", () => {
    const mapped = new MarketingToEmailInputMapper().map({
      audience: { primaryAudience: "beauty enthusiasts" },
      valueProposition: "Daily routine support.",
      campaignObjective: "traffic",
    });

    expect(mapped.targetAudience?.primaryAudience).toBe("beauty enthusiasts");
    expect(mapped.campaignObjective).toBe("traffic");
  });

  it("creates a stable email package snapshot", () => {
    const options = new EmailContentOptionsFactory().create();
    const contentPackage = new DeterministicEmailContentGenerator().generate(buildEmailInput(), options);
    const snapshot = new EmailContentMapper().toSnapshot(contentPackage);

    expect(snapshot.campaignType).toBe("promotional");
    expect(snapshot.contents.length).toBe(contentPackage.contents.length);
  });
});
