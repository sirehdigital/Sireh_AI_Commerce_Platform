import { AutoDsIntegrationService } from "./application/services/autods-integration.service.js";
import { SupplierIntegrationEngineService, type SupplierIntegrationEngineDependencies } from "./application/services/supplier-integration-engine.service.js";
import type { AutoDsClient } from "./domain/clients/autods.client.js";
import type { AutoDsRepository } from "./domain/repositories/autods.repository.js";
import { InMemoryAutoDsRepository } from "./infrastructure/repositories/in-memory-autods.repository.js";

export interface AutoDsModuleDependencies {
  readonly client: AutoDsClient;
  readonly repository?: AutoDsRepository;
  readonly now?: () => string;
}

export class AutoDsModule {
  public static create(dependencies: AutoDsModuleDependencies): AutoDsIntegrationService {
    const repository = dependencies.repository ?? new InMemoryAutoDsRepository();

    return new AutoDsIntegrationService(dependencies.client, repository, dependencies.now);
  }

  public static createSupplierEngine(dependencies: SupplierIntegrationEngineDependencies): SupplierIntegrationEngineService {
    return new SupplierIntegrationEngineService(dependencies);
  }
}

export * from "./application/providers/supplier-provider.js";
export * from "./application/services/supplier-integration-engine.service.js";
export * from "./domain/models/supplier-integration.model.js";
export * from "./domain/repositories/supplier-integration.repository.js";
export * from "./infrastructure/providers/autods.provider.js";
export * from "./infrastructure/providers/fake-supplier.provider.js";
export * from "./infrastructure/repositories/in-memory-supplier-integration.repository.js";
export * from "./infrastructure/repositories/prisma-supplier-integration.repository.js";
