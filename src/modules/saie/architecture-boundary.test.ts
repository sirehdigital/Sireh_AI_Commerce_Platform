import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("SAIE workflow repository architecture boundaries", () => {
  it("workflow application queries do not import API services or the workflow engine", () => {
    const source = read("src/modules/saie/application/queries/saie-read.queries.ts");

    expect(source).not.toContain("../api/");
    expect(source).not.toContain("api/services");
    expect(source).not.toContain("SAIEWorkflowEngine");
  });

  it("workflow controllers do not import repository implementations", () => {
    const source = read("src/modules/saie/api/controllers/workflow.controller.ts");

    expect(source).not.toContain("InMemoryWorkflowRepository");
    expect(source).not.toContain("infrastructure");
  });

  it("workflow repository implementation does not import Express, Shopify, or execution commands", () => {
    const source = read(
      "src/modules/saie/infrastructure/repositories/in-memory-workflow.repository.ts",
    );

    expect(source).not.toMatch(/express|Request|Response|NextFunction/u);
    expect(source).not.toMatch(/shopify|Shopify/u);
    expect(source).not.toMatch(/execute|approve|reject|dispatch|retry|cancel/u);
  });

  it("approval controller does not import repository implementations", () => {
    const source = read("src/modules/saie/api/controllers/approval.controller.ts");

    expect(source).not.toContain("InMemoryApprovalRepository");
    expect(source).not.toContain("infrastructure");
  });

  it("approval service and repository do not import Express, Shopify, execution services, or integrations", () => {
    const serviceSource = read("src/modules/saie/application/services/approval.service.ts");
    const repositorySource = read(
      "src/modules/saie/infrastructure/repositories/in-memory-approval.repository.ts",
    );
    const combined = `${serviceSource}\n${repositorySource}`;

    expect(combined).not.toMatch(/express|Request|Response|NextFunction/u);
    expect(combined).not.toMatch(/shopify|Shopify/u);
    expect(combined).not.toMatch(/integrations/u);
    expect(combined).not.toMatch(/execution-controller|ControlledSafeUpdateExecutionController/u);
  });

  it("audit repository and recorder do not import Express, Shopify, or execution services", () => {
    const repositorySource = read(
      "src/modules/saie/infrastructure/repositories/in-memory-audit.repository.ts",
    );
    const recorderSource = read("src/modules/saie/application/services/audit-recorder.service.ts");
    const combined = `${repositorySource}\n${recorderSource}`;

    expect(combined).not.toMatch(/express|Request|Response|NextFunction/u);
    expect(combined).not.toMatch(/shopify|Shopify/u);
    expect(combined).not.toMatch(/execute|dispatch|publish|queue|scheduler/u);
  });

  it("audit queries do not import API services and the audit controller stays infrastructure-free", () => {
    const querySource = read("src/modules/saie/application/queries/saie-read.queries.ts");
    const controllerSource = read("src/modules/saie/api/controllers/audit.controller.ts");

    expect(querySource).not.toContain("../api/");
    expect(querySource).not.toContain("api/services");
    expect(controllerSource).not.toContain("InMemoryAuditRepository");
    expect(controllerSource).not.toContain("infrastructure");
  });

  it("execution repository and preparation service do not import Express, Shopify, or external integrations", () => {
    const repositorySource = read(
      "src/modules/saie/infrastructure/repositories/in-memory-execution.repository.ts",
    );
    const serviceSource = read(
      "src/modules/saie/application/services/execution-preparation.service.ts",
    );
    const combined = `${repositorySource}\n${serviceSource}`;

    expect(combined).not.toMatch(/express|Request|Response|NextFunction/u);
    expect(combined).not.toMatch(/shopify|Shopify/u);
    expect(combined).not.toMatch(/integrations|AutoDS|WinningHunter|TikTok|Meta|Amazon|eBay/u);
    expect(combined).not.toMatch(/ControlledSafeUpdateExecutionController|SAIEWorkflowEngine/u);
  });

  it("execution queries do not import API services and the execution controller stays infrastructure-free", () => {
    const querySource = read("src/modules/saie/application/queries/saie-read.queries.ts");
    const controllerSource = read("src/modules/saie/api/controllers/execution.controller.ts");

    expect(querySource).not.toContain("../api/");
    expect(querySource).not.toContain("api/services");
    expect(controllerSource).not.toContain("InMemoryExecutionRepository");
    expect(controllerSource).not.toContain("infrastructure");
  });

  it("dashboard aggregation service is framework-free and integration-free", () => {
    const source = read("src/modules/saie/application/services/dashboard-aggregation.service.ts");

    expect(source).not.toMatch(/express|Request|Response|NextFunction/u);
    expect(source).not.toMatch(/from\s+["'][^"']*shopify|import\s+.*Shopify/u);
    expect(source).not.toMatch(/from\s+["'][^"']*integrations/u);
    expect(source).not.toMatch(/SAIEWorkflowEngine|ControlledSafeUpdateExecutionController/u);
  });

  it("dashboard renderer and controller do not import repository implementations", () => {
    const rendererSource = read(
      "src/modules/saie/presentation/dashboard-preview/dashboard-preview.template.ts",
    );
    const controllerSource = read("src/modules/saie/api/controllers/dashboard.controller.ts");

    expect(rendererSource).not.toMatch(/from\s+["'][^"']*repositories|InMemory/u);
    expect(rendererSource).not.toContain("infrastructure");
    expect(controllerSource).not.toContain("InMemory");
    expect(controllerSource).not.toContain("infrastructure");
  });

  it("observability registry and logger port do not import Express or external monitoring SDKs", () => {
    const metricsSource = read("src/modules/saie/application/observability/metrics-registry.ts");
    const loggerSource = read("src/modules/saie/application/observability/saie-logger.ts");
    const combined = `${metricsSource}\n${loggerSource}`;

    expect(combined).not.toMatch(/express|Request|Response|NextFunction/u);
    expect(combined).not.toMatch(/opentelemetry|prometheus|grafana|datadog|sentry/u);
    expect(combined).not.toMatch(/shopify|Shopify/u);
  });

  it("observability infrastructure does not import Shopify or become an orchestrator", () => {
    const loggerSource = read(
      "src/modules/saie/infrastructure/observability/process-local-saie.logger.ts",
    );
    const middlewareSource = read("src/modules/saie/api/middleware/correlation.middleware.ts");
    const combined = `${loggerSource}\n${middlewareSource}`;

    expect(combined).not.toMatch(/shopify|Shopify/u);
    expect(combined).not.toMatch(/SAIEWorkflowEngine|ExecutiveOrchestrator|executeWorkflow/u);
    expect(combined).not.toMatch(/opentelemetry|prometheus|grafana|datadog|sentry/u);
  });

  it("tenant context model stays framework-free and credential-free", () => {
    const contextSource = read("src/modules/saie/application/tenant/tenant-context.ts");
    const registrySource = read("src/modules/saie/application/tenant/tenant-registry.ts");
    const combined = `${contextSource}\n${registrySource}`;

    expect(combined).not.toMatch(/express|Request|Response|NextFunction/u);
    expect(combined).not.toMatch(/token|secret|password|credential|session/u);
    expect(combined).not.toMatch(/ShopifyClient|shopify\.client|oauth/u);
  });

  it("tenant middleware stays at the API boundary and avoids Shopify clients", () => {
    const source = read("src/modules/saie/api/middleware/tenant-context.middleware.ts");

    expect(source).toMatch(/RequestHandler/u);
    expect(source).not.toMatch(/ShopifyClient|shopify\.client|oauth|Prisma/u);
    expect(source).not.toMatch(/RBAC|jwt|billing|subscription/u);
  });
});
