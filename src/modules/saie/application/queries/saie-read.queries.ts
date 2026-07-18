import { ApplicationNotFoundError } from "../errors/index.js";
import type {
  ApprovalReadModel,
  AuditReadModel,
  DashboardReadModel,
  ExecutionReadModel,
  HealthReadModel,
  WorkflowReadModel,
} from "../models/index.js";
import type { MetricsSnapshot, ProcessLocalMetricsRegistry } from "../observability/index.js";
import type {
  DashboardReadPort,
  HealthReadPort,
} from "../ports/index.js";
import type {
  ApprovalRepository,
  AuditRepository,
  ExecutionRepository,
  WorkflowRepository,
} from "../repositories/index.js";
import type { TenantContext } from "../tenant/index.js";

export interface GetByIdInput {
  readonly tenant: TenantContext;
  readonly id: string;
}

export interface TenantScopedInput {
  readonly tenant: TenantContext;
}

export interface GetDashboardQuery {
  readonly execute: (input: TenantScopedInput) => DashboardReadModel;
}

export class GetDashboardApplicationQuery implements GetDashboardQuery {
  public constructor(private readonly dashboardReadPort: DashboardReadPort) {}

  public execute(input: TenantScopedInput): DashboardReadModel {
    return this.dashboardReadPort.getDashboard(input.tenant);
  }
}

export interface GetHealthQuery {
  readonly execute: () => HealthReadModel;
}

export class GetHealthApplicationQuery implements GetHealthQuery {
  public constructor(private readonly healthReadPort: HealthReadPort) {}

  public execute(): HealthReadModel {
    return this.healthReadPort.getHealth();
  }
}

export interface GetMetricsQuery {
  readonly execute: () => MetricsSnapshot;
}

export class GetMetricsApplicationQuery implements GetMetricsQuery {
  public constructor(private readonly metricsRegistry: ProcessLocalMetricsRegistry) {}

  public execute(): MetricsSnapshot {
    return this.metricsRegistry.snapshot();
  }
}

export interface ListWorkflowsQuery {
  readonly execute: (input: TenantScopedInput) => readonly WorkflowReadModel[];
}

export class ListWorkflowsApplicationQuery implements ListWorkflowsQuery {
  public constructor(private readonly workflowRepository: WorkflowRepository) {}

  public execute(input: TenantScopedInput): readonly WorkflowReadModel[] {
    return this.workflowRepository.list(input.tenant);
  }
}

export interface GetWorkflowByIdQuery {
  readonly execute: (input: GetByIdInput) => WorkflowReadModel;
}

export class GetWorkflowByIdApplicationQuery implements GetWorkflowByIdQuery {
  public constructor(private readonly workflowRepository: WorkflowRepository) {}

  public execute(input: GetByIdInput): WorkflowReadModel {
    const workflow = this.workflowRepository.findById(input.tenant, input.id);

    if (workflow === undefined) {
      throw new ApplicationNotFoundError("Workflow", input.id);
    }

    return workflow;
  }
}

export interface ListApprovalsQuery {
  readonly execute: (input: TenantScopedInput) => readonly ApprovalReadModel[];
}

export class ListApprovalsApplicationQuery implements ListApprovalsQuery {
  public constructor(private readonly approvalRepository: ApprovalRepository) {}

  public execute(input: TenantScopedInput): readonly ApprovalReadModel[] {
    return this.approvalRepository.list(input.tenant);
  }
}

export interface GetApprovalByIdQuery {
  readonly execute: (input: GetByIdInput) => ApprovalReadModel;
}

export class GetApprovalByIdApplicationQuery implements GetApprovalByIdQuery {
  public constructor(private readonly approvalRepository: ApprovalRepository) {}

  public execute(input: GetByIdInput): ApprovalReadModel {
    const approval = this.approvalRepository.findById(input.tenant, input.id);

    if (approval === undefined) {
      throw new ApplicationNotFoundError("Approval", input.id);
    }

    return approval;
  }
}

export interface ListAuditsQuery {
  readonly execute: (input: TenantScopedInput) => readonly AuditReadModel[];
}

export class ListAuditsApplicationQuery implements ListAuditsQuery {
  public constructor(private readonly auditRepository: AuditRepository) {}

  public execute(input: TenantScopedInput): readonly AuditReadModel[] {
    return this.auditRepository.list(input.tenant);
  }
}

export interface GetAuditByIdQuery {
  readonly execute: (input: GetByIdInput) => AuditReadModel;
}

export class GetAuditByIdApplicationQuery implements GetAuditByIdQuery {
  public constructor(private readonly auditRepository: AuditRepository) {}

  public execute(input: GetByIdInput): AuditReadModel {
    const audit = this.auditRepository.findById(input.tenant, input.id);

    if (audit === undefined) {
      throw new ApplicationNotFoundError("Audit", input.id);
    }

    return audit;
  }
}

export interface ListExecutionsQuery {
  readonly execute: (input: TenantScopedInput) => readonly ExecutionReadModel[];
}

export class ListExecutionsApplicationQuery implements ListExecutionsQuery {
  public constructor(private readonly executionRepository: ExecutionRepository) {}

  public execute(input: TenantScopedInput): readonly ExecutionReadModel[] {
    return this.executionRepository.list(input.tenant);
  }
}

export interface GetExecutionByIdQuery {
  readonly execute: (input: GetByIdInput) => ExecutionReadModel;
}

export class GetExecutionByIdApplicationQuery implements GetExecutionByIdQuery {
  public constructor(private readonly executionRepository: ExecutionRepository) {}

  public execute(input: GetByIdInput): ExecutionReadModel {
    const execution = this.executionRepository.findById(input.tenant, input.id);

    if (execution === undefined) {
      throw new ApplicationNotFoundError("Execution", input.id);
    }

    return execution;
  }
}
