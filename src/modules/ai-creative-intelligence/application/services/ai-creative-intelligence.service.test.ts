import { describe, expect, it } from "vitest";

import {
  AiCreativeIntelligenceService,
  CreativeIntelligenceInvalidRequestError,
  CreativeIntelligenceInvalidTimestampError,
  CreativeIntelligenceMissingCreativeMaterialError,
  InMemoryCreativeIntelligenceRepository,
  type CreateCreativeIntelligenceRequest,
  type CreativeIntelligenceRecord,
} from "../../index.js";
import * as publicExports from "../../../ai-creative-intelligence/index.js";

const REGISTERED_AT = "2026-08-10T02:30:00.000Z";

const buildRequest = (overrides: Partial<CreateCreativeIntelligenceRequest> = {}): CreateCreativeIntelligenceRequest => ({
  creativeId: "Creative Launch 001",
  productId: "product-100",
  sourceContentId: "content-200",
  assetType: "IMAGE",
  platforms: ["INSTAGRAM", "FACEBOOK"],
  targetMarkets: ["us", "GB"],
  brief: {
    hook: "Style faster before the morning rush",
    headline: "Velvet Glow Wand",
    primaryText: "A compact styling tool for polished daily routines.",
    callToAction: "Shop Now",
    visualConcept: "Warm vanity scene with the tool beside travel essentials.",
  },
  brandName: "Sireh Beauty",
  brandTone: "Confident and helpful",
  registeredAt: REGISTERED_AT,
  ...overrides,
});

const createRecord = async (request: CreateCreativeIntelligenceRequest = buildRequest()) => {
  const repository = new InMemoryCreativeIntelligenceRepository();
  return new AiCreativeIntelligenceService(repository).createCreativeIntelligence(request);
};

describe("AiCreativeIntelligenceService", () => {
  it("creates a valid image creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "IMAGE", brief: { visualConcept: "Bright product flat lay", callToAction: "Shop Now" } }));

    expect(record.assetType).toBe("IMAGE");
    expect(record.brief.visualConcept).toBe("Bright product flat lay");
  });

  it("creates a valid video creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "VIDEO", brief: { hook: "Three seconds to smoother styling", visualConcept: "Creator demo" } }));

    expect(record.assetType).toBe("VIDEO");
    expect(record.brief.hook).toBe("Three seconds to smoother styling");
  });

  it("creates a valid carousel creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "CAROUSEL", brief: { hook: "One tool, three routines", headline: "Swipe the routine" } }));

    expect(record.assetType).toBe("CAROUSEL");
    expect(record.brief.headline).toBe("Swipe the routine");
  });

  it("creates a valid copy creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "COPY", brief: { headline: "Daily polish, packed small", primaryText: "Keep your routine simple." } }));

    expect(record.assetType).toBe("COPY");
    expect(record.brief.primaryText).toBe("Keep your routine simple.");
  });

  it("creates a valid mixed creative", async () => {
    const record = await createRecord(buildRequest({ assetType: "MIXED", brief: { hook: "Pack light", visualConcept: "Travel pouch scene", callToAction: "Explore" } }));

    expect(record.assetType).toBe("MIXED");
    expect(record.brief.visualConcept).toBe("Travel pouch scene");
  });

  it("generates a stable deterministic ID", async () => {
    await expect(createRecord()).resolves.toMatchObject({ id: "creative-intelligence:creative-launch-001" });
  });

  it("returns the same logical ID for the same creative ID", async () => {
    const first = await createRecord(buildRequest({ creativeId: " Creative Launch 001 " }));
    const second = await createRecord(buildRequest({ creativeId: "creative---launch---001" }));

    expect(first.id).toBe(second.id);
  });

  it("returns different IDs for different creative IDs", async () => {
    const first = await createRecord(buildRequest({ creativeId: "creative-a" }));
    const second = await createRecord(buildRequest({ creativeId: "creative-b" }));

    expect(first.id).not.toBe(second.id);
  });

  it("rejects a missing creative ID", async () => {
    await expect(createRecord(buildRequest({ creativeId: undefined as unknown as string }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a blank creative ID", async () => {
    await expect(createRecord(buildRequest({ creativeId: " " }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a missing product ID", async () => {
    await expect(createRecord(buildRequest({ productId: undefined as unknown as string }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a blank product ID", async () => {
    await expect(createRecord(buildRequest({ productId: " " }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects a missing platform list", async () => {
    await expect(createRecord(buildRequest({ platforms: undefined as unknown as CreateCreativeIntelligenceRequest["platforms"] }))).rejects.toThrow(
      CreativeIntelligenceInvalidRequestError,
    );
  });

  it("rejects an empty platform list", async () => {
    await expect(createRecord(buildRequest({ platforms: [] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("normalizes duplicate platforms", async () => {
    const record = await createRecord(buildRequest({ platforms: ["INSTAGRAM", "FACEBOOK", "INSTAGRAM"] }));

    expect(record.platforms).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });

  it("orders platforms deterministically", async () => {
    const record = await createRecord(buildRequest({ platforms: ["TIKTOK", "EMAIL", "FACEBOOK", "SHOPIFY"] }));

    expect(record.platforms).toEqual(["FACEBOOK", "TIKTOK", "SHOPIFY", "EMAIL"]);
  });

  it("rejects malformed platform values", async () => {
    await expect(createRecord(buildRequest({ platforms: ["INSTAGRAM", "X" as CreateCreativeIntelligenceRequest["platforms"][number]] }))).rejects.toThrow(
      CreativeIntelligenceInvalidRequestError,
    );
  });

  it("rejects a missing market list", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: undefined as unknown as string[] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects an empty market list", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: [] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("normalizes lowercase markets", async () => {
    const record = await createRecord(buildRequest({ targetMarkets: ["us", "gb"] }));

    expect(record.targetMarkets).toEqual(["GB", "US"]);
  });

  it("normalizes duplicate markets", async () => {
    const record = await createRecord(buildRequest({ targetMarkets: ["US", "us", "GB"] }));

    expect(record.targetMarkets).toEqual(["GB", "US"]);
  });

  it("orders markets deterministically", async () => {
    const record = await createRecord(buildRequest({ targetMarkets: ["CA", "us", "AU", "gb"] }));

    expect(record.targetMarkets).toEqual(["AU", "CA", "GB", "US"]);
  });

  it("rejects blank market codes", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: ["US", " "] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects malformed market codes", async () => {
    await expect(createRecord(buildRequest({ targetMarkets: ["USA"] }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects an invalid timestamp", async () => {
    await expect(createRecord(buildRequest({ registeredAt: "2026-08-10" }))).rejects.toThrow(CreativeIntelligenceInvalidTimestampError);
  });

  it("preserves a valid ISO timestamp", async () => {
    const record = await createRecord(buildRequest({ registeredAt: "2026-08-10T12:34:56.000Z" }));

    expect(record.registeredAt).toBe("2026-08-10T12:34:56.000Z");
  });

  it("rejects an empty brief", async () => {
    await expect(createRecord(buildRequest({ brief: {} }))).rejects.toThrow(CreativeIntelligenceMissingCreativeMaterialError);
  });

  it("rejects an all-blank brief", async () => {
    await expect(createRecord(buildRequest({ brief: { hook: " ", primaryText: " " } }))).rejects.toThrow(CreativeIntelligenceMissingCreativeMaterialError);
  });

  it("removes blank optional brief fields", async () => {
    const record = await createRecord(buildRequest({ brief: { hook: "  Fresh start  ", headline: " ", callToAction: "  Shop Now  " } }));

    expect(record.brief).toEqual({ hook: "Fresh start", callToAction: "Shop Now" });
  });

  it("preserves useful creative material after trimming", async () => {
    const record = await createRecord(buildRequest({ brief: { primaryText: "  Keep the look polished.  ", visualConcept: "  Clean bathroom shelf. " } }));

    expect(record.brief).toEqual({ primaryText: "Keep the look polished.", visualConcept: "Clean bathroom shelf." });
  });

  it("rejects non-object brief input", async () => {
    await expect(createRecord(buildRequest({ brief: null as unknown as CreateCreativeIntelligenceRequest["brief"] }))).rejects.toThrow(
      CreativeIntelligenceInvalidRequestError,
    );
  });

  it("rejects non-string brief fields", async () => {
    await expect(createRecord(buildRequest({ brief: { headline: 123 as unknown as string } }))).rejects.toThrow(CreativeIntelligenceInvalidRequestError);
  });

  it("rejects copy creatives without text material", async () => {
    await expect(createRecord(buildRequest({ assetType: "COPY", brief: { visualConcept: "Only a visual idea" } }))).rejects.toThrow(
      CreativeIntelligenceMissingCreativeMaterialError,
    );
  });

  it("defaults status to pending analysis", async () => {
    const record = await createRecord();

    expect(record.analysisStatus).toBe("PENDING_ANALYSIS");
  });

  it("sets the creative version", async () => {
    const record = await createRecord();

    expect(record.version).toBe("SACP-CREATIVE-v1");
  });

  it("warns when hook is absent where appropriate", async () => {
    const record = await createRecord(buildRequest({ assetType: "VIDEO", brief: { visualConcept: "Product demo", callToAction: "Shop Now" } }));

    expect(record.warnings).toContain("Creative hook is missing and should be reviewed before analysis.");
  });

  it("warns when CTA is absent", async () => {
    const record = await createRecord(buildRequest({ brief: { visualConcept: "Product flat lay" } }));

    expect(record.warnings).toContain("Call to action is missing and should be reviewed before analysis.");
  });

  it("keeps warning behavior deterministic", async () => {
    const request = buildRequest({ assetType: "MIXED", platforms: ["OTHER", "INSTAGRAM"], brief: { visualConcept: "Product flat lay" } });

    await expect(createRecord(request)).resolves.toMatchObject({ warnings: (await createRecord(request)).warnings });
  });

  it("warns when platform OTHER is selected", async () => {
    const record = await createRecord(buildRequest({ platforms: ["OTHER"] }));

    expect(record.warnings).toContain("Platform OTHER selected; platform requirements must be reviewed manually.");
  });

  it("does not mutate request input", async () => {
    const request = buildRequest();
    const before = structuredClone(request);

    await createRecord(request);

    expect(request).toEqual(before);
  });
});

describe("InMemoryCreativeIntelligenceRepository", () => {
  it("saves records defensively", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord();

    const saved = await repository.save(record);

    expect(saved).toEqual(record);
    expect(saved).not.toBe(record);
  });

  it("finds records by ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());

    expect(await repository.findById(record.id)).toEqual(record);
    expect(await repository.findById("missing")).toBeNull();
  });

  it("finds records by creative ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());

    expect(await repository.findByCreativeId("Creative Launch 001")).toEqual(record);
  });

  it("lists records in deterministic order", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();

    await repository.save(await createRecord(buildRequest({ creativeId: "later", registeredAt: "2026-08-10T03:00:00.000Z" })));
    await repository.save(await createRecord(buildRequest({ creativeId: "earlier", registeredAt: "2026-08-10T01:00:00.000Z" })));

    expect((await repository.list()).map((record) => record.creativeId)).toEqual(["earlier", "later"]);
  });

  it("replaces duplicate saves by deterministic ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord();
    const updated: CreativeIntelligenceRecord = {
      ...record,
      warnings: ["Replacement warning"],
    };

    await repository.save(record);
    await repository.save(updated);

    expect(await repository.list()).toHaveLength(1);
    expect((await repository.findById(record.id))?.warnings).toEqual(["Replacement warning"]);
  });

  it("removes stale creative ID lookups when replacing the same canonical ID", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord(buildRequest({ creativeId: "Item 1" }));
    const replacement: CreativeIntelligenceRecord = {
      ...record,
      creativeId: "Replacement Item",
      warnings: ["Replacement warning"],
    };

    await repository.save(record);
    const savedReplacement = await repository.save(replacement);
    const expectedReplacement = structuredClone(replacement);
    (replacement.warnings as string[]).push("Injected after save");
    (savedReplacement.brief as { headline?: string }).headline = "Injected through return value";

    expect(await repository.findByCreativeId("Item 1")).toBeNull();
    expect(await repository.findByCreativeId("Replacement Item")).toEqual(expectedReplacement);
    expect(await repository.findById(record.id)).toEqual(expectedReplacement);
    expect((await repository.findByCreativeId("Replacement Item"))?.warnings).toEqual(["Replacement warning"]);
    expect((await repository.findById(record.id))?.brief.headline).toBe("Velvet Glow Wand");
  });

  it("keeps list ordering deterministic when timestamps match", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();

    await repository.save(await createRecord(buildRequest({ creativeId: "b-creative" })));
    await repository.save(await createRecord(buildRequest({ creativeId: "a-creative" })));

    expect((await repository.list()).map((record) => record.id)).toEqual(["creative-intelligence:a-creative", "creative-intelligence:b-creative"]);
  });

  it("protects stored state from mutation after save", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await createRecord();

    await repository.save(record);
    (record.warnings as string[]).push("Injected");
    (record.brief as { headline?: string }).headline = "Injected";

    const found = await repository.findById(record.id);
    expect(found?.warnings).not.toContain("Injected");
    expect(found?.brief.headline).not.toBe("Injected");
  });

  it("protects lookup results from mutation", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const found = await repository.findById(record.id);

    (found?.warnings as string[]).push("Injected");
    (found?.brief as { headline?: string }).headline = "Injected";

    expect((await repository.findById(record.id))?.warnings).not.toContain("Injected");
    expect((await repository.findById(record.id))?.brief.headline).not.toBe("Injected");
  });

  it("prevents nested brief mutation through listed records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const listed = await repository.list();

    (listed[0]?.brief as { headline?: string }).headline = "Injected";

    expect((await repository.findById(record.id))?.brief.headline).not.toBe("Injected");
  });

  it("prevents platform array mutation through returned records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const found = await repository.findById(record.id);

    (found?.platforms as string[]).push("OTHER");

    expect((await repository.findById(record.id))?.platforms).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });

  it("prevents market array mutation through returned records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();
    const record = await repository.save(await createRecord());
    const found = await repository.findById(record.id);

    (found?.targetMarkets as string[]).push("AU");

    expect((await repository.findById(record.id))?.targetMarkets).toEqual(["GB", "US"]);
  });

  it("clears stored records", async () => {
    const repository = new InMemoryCreativeIntelligenceRepository();

    await repository.save(await createRecord());
    repository.clear();

    expect(await repository.list()).toHaveLength(0);
  });
});

describe("ai-creative-intelligence public exports", () => {
  it("exports the public module surface", () => {
    expect(publicExports.AiCreativeIntelligenceService).toBe(AiCreativeIntelligenceService);
    expect(publicExports.InMemoryCreativeIntelligenceRepository).toBe(InMemoryCreativeIntelligenceRepository);
    expect(publicExports.CREATIVE_ASSET_TYPES).toContain("MIXED");
  });
});
