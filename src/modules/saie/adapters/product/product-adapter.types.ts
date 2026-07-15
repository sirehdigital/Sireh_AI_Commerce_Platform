import type { ProductAgentPortIdentifier } from "../../agents/product/index.js";

export type ProductAdapterReadinessStatus = "ready" | "partial" | "unavailable" | "blocked";

export type ProductAdapterCompatibility = "exact" | "partial" | "unavailable";

export type ProductAdapterRisk = "none" | "external-call" | "mutation" | "external-call-and-mutation";

export type ProductAdapterReadinessMode = "readiness-only";

export interface ProductAdapterDependencyValidation {
  readonly dependencySupplied: boolean;
  readonly notes: readonly string[];
}

export interface ProductAdapterReadinessItem {
  readonly port: ProductAgentPortIdentifier;
  readonly adapterName: string;
  readonly existingServiceName: string;
  readonly existingServiceFile: string;
  readonly existingInputContract: string;
  readonly existingOutputContract: string;
  readonly compatibility: ProductAdapterCompatibility;
  readonly externalCallRisk: ProductAdapterRisk;
  readonly mutationRisk: ProductAdapterRisk;
  readonly readinessStatus: ProductAdapterReadinessStatus;
  readonly canBeCreatedWithoutBusinessLogicChanges: boolean;
  readonly notes: readonly string[];
}

export interface ProductAdapterReadinessReport extends Readonly<Record<string, unknown>> {
  readonly agentType: "ProductAgent";
  readonly mode: ProductAdapterReadinessMode;
  readonly adapters: readonly ProductAdapterReadinessItem[];
  readonly readyPorts: readonly ProductAgentPortIdentifier[];
  readonly partialPorts: readonly ProductAgentPortIdentifier[];
  readonly unavailablePorts: readonly ProductAgentPortIdentifier[];
  readonly blockedPorts: readonly ProductAgentPortIdentifier[];
  readonly safeForExecution: false;
  readonly generatedAt: string;
}

export interface ProductReadinessAdapter {
  readonly mode: ProductAdapterReadinessMode;
  getReadinessItem(): ProductAdapterReadinessItem;
  validateDependency(): ProductAdapterDependencyValidation;
}

export class DuplicateProductAdapterPortError extends Error {
  public constructor(port: ProductAgentPortIdentifier) {
    super(`Product adapter port ${port} is already mapped.`);
    this.name = "DuplicateProductAdapterPortError";
  }
}

export class UnsupportedProductAdapterReadinessModeError extends Error {
  public constructor(mode: string) {
    super(`Product adapter readiness mode ${mode} is not supported.`);
    this.name = "UnsupportedProductAdapterReadinessModeError";
  }
}
