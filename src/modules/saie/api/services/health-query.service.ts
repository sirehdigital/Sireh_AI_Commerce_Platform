import type { HealthReadModel, HealthReadPort } from "../../application/index.js";

export interface HealthQueryServiceOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly now?: () => Date;
  readonly orchestratorAvailable?: boolean;
}

export class HealthQueryService implements HealthReadPort {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly now: () => Date;
  private readonly orchestratorAvailable: boolean;

  public constructor(options: HealthQueryServiceOptions = {}) {
    this.environment = options.environment ?? process.env;
    this.now = options.now ?? (() => new Date());
    this.orchestratorAvailable = options.orchestratorAvailable ?? true;
  }

  public getHealth(): HealthReadModel {
    return {
      status: "healthy",
      version: "0.2.0-beta",
      environment: this.safeNodeEnvironment(this.environment.NODE_ENV),
      orchestrator: this.orchestratorAvailable ? "available" : "not_checked",
      executionEnabled: false,
      approvalRequired: true,
      timestamp: this.now().toISOString(),
      observability: {
        logging: "process-local",
        metrics: "process-local",
        correlationIds: true,
        persistentTelemetry: false,
      },
      tenancy: {
        tenantContextSupported: true,
        tenantIsolationMode: "process-local",
        authenticatedTenantResolution: false,
        defaultContextEnabled: true,
      },
    };
  }

  private safeNodeEnvironment(value: string | undefined): "development" | "production" | "test" {
    if (value === "production" || value === "test") {
      return value;
    }

    return "development";
  }
}
