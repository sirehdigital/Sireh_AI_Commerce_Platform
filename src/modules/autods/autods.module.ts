import { AutoDsIntegrationService } from "./application/services/autods-integration.service.js";
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
}
