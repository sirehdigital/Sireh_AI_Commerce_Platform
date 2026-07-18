import type {
  ExecutionPreparationService,
  PrepareExecutionInput,
} from "../services/execution-preparation.service.js";
import type { ExecutionRecord } from "../repositories/index.js";

export interface PrepareExecutionCommand {
  readonly execute: (input: PrepareExecutionInput) => ExecutionRecord;
}

export class PrepareExecutionApplicationCommand implements PrepareExecutionCommand {
  public constructor(private readonly executionPreparationService: ExecutionPreparationService) {}

  public execute(input: PrepareExecutionInput): ExecutionRecord {
    return this.executionPreparationService.prepareExecution(input);
  }
}
