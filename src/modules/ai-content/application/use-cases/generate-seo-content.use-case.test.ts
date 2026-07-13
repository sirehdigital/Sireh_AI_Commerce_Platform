import { describe, expect, it } from "vitest";
import { DeterministicSEOContentGenerator } from "../../infrastructure/generators/index.js";
import {
  MissingSEOSourceError,
  UnsafeSEOKeywordError,
  UnsupportedSEOChannelError,
  UnsupportedSEOLanguageError,
} from "../errors/index.js";
import { GenerateSEOContentUseCase } from "./generate-seo-content.use-case.js";
import { buildSEOInput } from "../../infrastructure/generators/deterministic-seo-content.generator.test.js";

describe("GenerateSEOContentUseCase", () => {
  it("generates a complete SEO package mapped to Content aggregates", () => {
    const result = new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator()).execute({
      input: buildSEOInput(),
      options: { templateId: "seo-template-001" },
    });

    expect(result.productId).toBe("seo-product-001");
    expect(result.contents).toHaveLength(4);
    expect(result.contents[0]?.snapshot().type).toBe("seo-title");
    expect(result.contents[1]?.snapshot().type).toBe("seo-description");
    expect(result.contents.every((content) => content.snapshot().seo !== undefined)).toBe(true);
    expect(result.contents.every((content) => content.snapshot().metadata.sourceProductId === result.productId)).toBe(
      true,
    );
    expect(result.contents.every((content) => content.snapshot().templateId === "seo-template-001")).toBe(true);
  });

  it("infers and accepts explicit search intent", () => {
    const useCase = new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator());
    const { valueProposition: removedValueProposition, ...inputWithoutValueProposition } = buildSEOInput();
    void removedValueProposition;
    const inferred = useCase.execute({
      input: { ...inputWithoutValueProposition, benefits: [], searchIntentHints: ["comparison"] },
    });
    const explicit = useCase.execute({
      input: buildSEOInput(),
      options: { searchIntent: "transactional" },
    });

    expect(inferred.searchIntent).toBe("comparison");
    expect(explicit.searchIntent).toBe("transactional");
  });

  it("rejects unsupported language, channel and missing source data", () => {
    const useCase = new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator());

    expect(() => useCase.execute({ input: buildSEOInput(), options: { language: "fr" } })).toThrow(
      UnsupportedSEOLanguageError,
    );
    expect(() => useCase.execute({ input: buildSEOInput(), options: { channel: "email" } })).toThrow(
      UnsupportedSEOChannelError,
    );
    expect(() => useCase.execute({ input: { productId: " ", productTitle: " " } })).toThrow(
      MissingSEOSourceError,
    );
  });

  it("propagates keyword safety errors", () => {
    expect(() =>
      new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator()).execute({
        input: buildSEOInput(),
        options: { preferredPrimaryKeyword: "guaranteed cure beauty treatment" },
      }),
    ).toThrow(UnsafeSEOKeywordError);
  });

  it("is deterministic across repeated execution except timestamps", () => {
    const useCase = new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator());
    const first = useCase.execute({ input: buildSEOInput() });
    const second = useCase.execute({ input: buildSEOInput() });

    expect(first.metaTitle.value).toBe(second.metaTitle.value);
    expect(first.metaDescription.value).toBe(second.metaDescription.value);
    expect(first.slug.value).toBe(second.slug.value);
    expect(first.contents.map((content) => content.snapshot().body)).toEqual(
      second.contents.map((content) => content.snapshot().body),
    );
  });
});
