import { describe, expect, it } from "vitest";
import {
  DuplicateRequiredPromptVariableError,
  InvalidPromptTemplateError,
  MissingPromptVariableError,
  UnresolvedPromptPlaceholderError,
} from "../prompts/prompt.errors.js";
import type { AIMessage, AITextGenerationRequest } from "../types/ai-provider.types.js";
import type { PromptContext, PromptTemplate } from "../types/prompt.types.js";
import { PromptRendererService } from "./prompt-renderer.service.js";

describe("PromptRendererService", () => {
  it("renders a single message with one variable", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "Analyze {{productTitle}}" }],
        requiredVariables: ["productTitle"],
      }),
      buildContext({ productTitle: "Lumora Serum" }),
    );

    expect(result.messages).toEqual([{ role: "user", content: "Analyze Lumora Serum" }]);
  });

  it("renders multiple messages", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [
          { role: "system", template: "You are {{persona}}" },
          { role: "user", template: "Write for {{audience}}" },
        ],
        requiredVariables: ["persona", "audience"],
      }),
      buildContext({ persona: "an ecommerce strategist", audience: "beauty customers" }),
    );

    expect(result.messages).toEqual([
      { role: "system", content: "You are an ecommerce strategist" },
      { role: "user", content: "Write for beauty customers" },
    ]);
  });

  it("supports system, user and assistant roles", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [
          { role: "system", template: "System message" },
          { role: "user", template: "User message" },
          { role: "assistant", template: "Assistant message" },
        ],
      }),
      buildContext({}),
    );

    expect(result.messages.map((message) => message.role)).toEqual(["system", "user", "assistant"]);
  });

  it("renders string values unchanged", () => {
    const result = renderValue("value", "Plain Text");

    expect(result.messages[0]?.content).toBe("Value: Plain Text");
  });

  it("renders number values deterministically", () => {
    const result = renderValue("value", 1000.5);

    expect(result.messages[0]?.content).toBe("Value: 1000.5");
  });

  it("renders boolean values as true and false", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "Enabled: {{enabled}} Disabled: {{disabled}}" }],
        requiredVariables: ["enabled", "disabled"],
      }),
      buildContext({ enabled: true, disabled: false }),
    );

    expect(result.messages[0]?.content).toBe("Enabled: true Disabled: false");
  });

  it("renders null as an empty string", () => {
    const result = renderValue("value", null);

    expect(result.messages[0]?.content).toBe("Value: ");
  });

  it("renders repeated variables consistently", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "Product: {{productTitle}}. Brand {{productTitle}}." }],
        requiredVariables: ["productTitle"],
      }),
      buildContext({ productTitle: "Lumora Serum" }),
    );

    expect(result.messages[0]?.content).toBe("Product: Lumora Serum. Brand Lumora Serum.");
  });

  it("lists used variables only once", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "{{productTitle}} {{productTitle}}" }],
        requiredVariables: ["productTitle"],
      }),
      buildContext({ productTitle: "Lumora Serum" }),
    );

    expect(result.usedVariables).toEqual(["productTitle"]);
  });

  it("preserves first-use order in usedVariables", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "{{second}} {{first}} {{third}} {{first}}" }],
        requiredVariables: ["first", "second", "third"],
      }),
      buildContext({ first: "1", second: "2", third: "3" }),
    );

    expect(result.usedVariables).toEqual(["second", "first", "third"]);
  });

  it("ignores unused context variables", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "{{used}}" }],
        requiredVariables: ["used"],
      }),
      buildContext({ used: "visible", unused: "hidden" }),
    );

    expect(result.usedVariables).toEqual(["used"]);
    expect(result.messages[0]?.content).toBe("visible");
  });

  it("throws missing-variable error for an absent required variable", () => {
    expect(() => {
      new PromptRendererService().render(
        buildTemplate({ requiredVariables: ["productTitle"] }),
        buildContext({}),
      );
    }).toThrow(MissingPromptVariableError);
  });

  it("does not treat null as a missing variable", () => {
    const result = new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "Optional: {{nullable}}" }],
        requiredVariables: ["nullable"],
      }),
      buildContext({ nullable: null }),
    );

    expect(result.messages[0]?.content).toBe("Optional: ");
  });

  it("throws unresolved-placeholder error", () => {
    expect(() => {
      new PromptRendererService().render(
        buildTemplate({
          messages: [{ role: "user", template: "{{undeclared}}" }],
        }),
        buildContext({}),
      );
    }).toThrow(UnresolvedPromptPlaceholderError);
  });

  it("rejects empty template ID", () => {
    expect(() => {
      new PromptRendererService().render(buildTemplate({ id: " " }), buildContext({}));
    }).toThrow(InvalidPromptTemplateError);
  });

  it("rejects empty version", () => {
    expect(() => {
      new PromptRendererService().render(buildTemplate({ version: " " }), buildContext({}));
    }).toThrow(InvalidPromptTemplateError);
  });

  it("rejects a template with no messages", () => {
    expect(() => {
      new PromptRendererService().render(buildTemplate({ messages: [] }), buildContext({}));
    }).toThrow(InvalidPromptTemplateError);
  });

  it("rejects invalid required variable names", () => {
    expect(() => {
      new PromptRendererService().render(
        buildTemplate({ requiredVariables: ["product-title"] }),
        buildContext({}),
      );
    }).toThrow(InvalidPromptTemplateError);
  });

  it("rejects invalid placeholder names", () => {
    expect(() => {
      new PromptRendererService().render(
        buildTemplate({
          messages: [{ role: "user", template: "Invalid {{product-title}}" }],
        }),
        buildContext({}),
      );
    }).toThrow(InvalidPromptTemplateError);
  });

  it("rejects duplicate required variables", () => {
    expect(() => {
      new PromptRendererService().render(
        buildTemplate({ requiredVariables: ["productTitle", "productTitle"] }),
        buildContext({ productTitle: "Lumora Serum" }),
      );
    }).toThrow(DuplicateRequiredPromptVariableError);
  });

  it("does not mutate the original template", () => {
    const template = buildTemplate({
      messages: [{ role: "user", template: "{{productTitle}}" }],
      requiredVariables: ["productTitle"],
    });
    const before = JSON.stringify(template);

    new PromptRendererService().render(template, buildContext({ productTitle: "Lumora Serum" }));

    expect(JSON.stringify(template)).toBe(before);
  });

  it("does not mutate the original context", () => {
    const context = buildContext({ productTitle: "Lumora Serum" });
    const before = JSON.stringify(context);

    new PromptRendererService().render(
      buildTemplate({
        messages: [{ role: "user", template: "{{productTitle}}" }],
        requiredVariables: ["productTitle"],
      }),
      context,
    );

    expect(JSON.stringify(context)).toBe(before);
  });

  it("produces normalized AIMessage objects compatible with SACP-01.04A", () => {
    const result = new PromptRendererService().render(buildTemplate(), buildContext({}));
    const messages: readonly AIMessage[] = result.messages;
    const request: AITextGenerationRequest = {
      model: "future-model",
      messages,
    };

    expect(request.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("preserves template ID and template version", () => {
    const result = new PromptRendererService().render(
      buildTemplate({ id: "product-copy", version: "2.0.0" }),
      buildContext({}),
    );

    expect(result.templateId).toBe("product-copy");
    expect(result.templateVersion).toBe("2.0.0");
  });

  it("supports a template with no variables", () => {
    const result = new PromptRendererService().render(buildTemplate(), buildContext({ unused: "value" }));

    expect(result.messages).toEqual([{ role: "user", content: "Hello" }]);
    expect(result.usedVariables).toEqual([]);
  });

  it("supports an empty context when the template has no variables", () => {
    const result = new PromptRendererService().render(buildTemplate(), buildContext({}));

    expect(result.messages[0]?.content).toBe("Hello");
  });
});

function renderValue(
  variableName: string,
  value: string | number | boolean | null,
): ReturnType<PromptRendererService["render"]> {
  return new PromptRendererService().render(
    buildTemplate({
      messages: [{ role: "user", template: `Value: {{${variableName}}}` }],
      requiredVariables: [variableName],
    }),
    buildContext({ [variableName]: value }),
  );
}

function buildTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: "test-template",
    version: "1.0.0",
    messages: [{ role: "user", template: "Hello" }],
    requiredVariables: [],
    ...overrides,
  };
}

function buildContext(variables: PromptContext["variables"]): PromptContext {
  return { variables };
}
