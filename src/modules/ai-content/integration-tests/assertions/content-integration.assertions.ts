import { expect } from "vitest";
import type { AIContentPortfolio, Content } from "../../index.js";

export function expectValidContentAggregates(contents: readonly Content[]): void {
  const ids = contents.map((content) => content.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const content of contents) {
    const snapshot = content.snapshot();
    expect(snapshot.status).toBe("draft");
    expect(snapshot.headline.value.length).toBeGreaterThan(0);
    expect(["en", "ms"]).toContain(snapshot.language);
    expect(snapshot.revision).toBeGreaterThanOrEqual(1);
    if (snapshot.score !== undefined) {
      expect(snapshot.score.overallQuality.value).toBeGreaterThanOrEqual(0);
      expect(snapshot.score.overallQuality.value).toBeLessThanOrEqual(100);
    }
  }
}

export function expectTraceablePortfolio(portfolio: AIContentPortfolio): void {
  expect(portfolio.correlationId).toBe("correlation-content-integration-001");
  expect(portfolio.campaignReferences).toContain("campaign-content-integration-001");
  expect(portfolio.sourceReferences).toContain("product-integration-001");
  expect(portfolio.orchestrationVersion).toBe("SACP AI Content Orchestrator v1");
  expect(portfolio.auditTrail.map((record) => record.sequence)).toEqual(
    portfolio.auditTrail.map((_, index) => index + 1),
  );
  expect(
    portfolio.auditTrail.every((record) => record.correlationId === portfolio.correlationId),
  ).toBe(true);
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Readonly<Record<string, unknown>>)) deepFreeze(child);
  return value;
}
