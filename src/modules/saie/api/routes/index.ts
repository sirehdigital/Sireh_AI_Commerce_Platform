import { Router } from "express";

import {
  GetApprovalByIdApplicationQuery,
  GetAuditByIdApplicationQuery,
  GetDashboardApplicationQuery,
  GetExecutionByIdApplicationQuery,
  GetHealthApplicationQuery,
  GetMetricsApplicationQuery,
  GetWorkflowByIdApplicationQuery,
  ApprovalService,
  AuditRecorderService,
  ApproveApprovalApplicationCommand,
  DashboardAggregationService,
  ExecutionPreparationService,
  ListApprovalsApplicationQuery,
  ListAuditsApplicationQuery,
  ListExecutionsApplicationQuery,
  ListWorkflowsApplicationQuery,
  PrepareExecutionApplicationCommand,
  RejectApprovalApplicationCommand,
  type AuditClock,
  type AuditIdGenerator,
  type ApprovalRecord,
  type ExecutionClock,
  type ExecutionIdGenerator,
  type PrepareExecutionCommand,
  type SaieLogger,
  ProcessLocalMetricsRegistry,
  ProcessLocalTenantRegistry,
} from "../../application/index.js";
import { DashboardAggregationReadAdapter } from "../../application/read-adapters/index.js";
import {
  InMemoryApprovalRepository,
  InMemoryAuditRepository,
  InMemoryExecutionRepository,
  InMemoryWorkflowRepository,
  ProcessLocalSaieLogger,
  createDeterministicApprovalSeedRecords,
  createDeterministicAuditSeedRecords,
  createDeterministicExecutionSeedRecords,
  createDeterministicWorkflowSeedRecords,
} from "../../infrastructure/index.js";
import {
  createApprovalController,
  createAuditController,
  createDashboardController,
  createExecutionController,
  createHealthController,
  createMetricsController,
  createWorkflowController,
} from "../controllers/index.js";
import { createSaieRequestObservabilityMiddleware, createTenantContextMiddleware } from "../middleware/index.js";
import { HealthQueryService } from "../services/index.js";
import { createApprovalRouter } from "./approval.routes.js";
import { createAuditRouter } from "./audit.routes.js";
import { createDashboardRouter } from "./dashboard.routes.js";
import { createExecutionRouter } from "./execution.routes.js";
import { createHealthRouter } from "./health.routes.js";
import { createMetricsRouter } from "./metrics.routes.js";
import { createWorkflowRouter } from "./workflow.routes.js";

export interface SaieApiRouterOptions {
  readonly approvalSeedRecords?: readonly ApprovalRecord[];
  readonly auditIdGenerator?: AuditIdGenerator;
  readonly auditClock?: AuditClock;
  readonly executionIdGenerator?: ExecutionIdGenerator;
  readonly executionClock?: ExecutionClock;
  readonly configureInternalExecutionPreparation?: (command: PrepareExecutionCommand) => void;
  readonly metricsRegistry?: ProcessLocalMetricsRegistry;
  readonly logger?: SaieLogger;
  readonly correlationIdGenerator?: () => string;
  readonly durationNow?: () => number;
  readonly tenantRegistry?: ProcessLocalTenantRegistry;
}

export const createSaieApiRouter = (options: SaieApiRouterOptions = {}): Router => {
  const router = Router();
  const metricsRegistry = options.metricsRegistry ?? new ProcessLocalMetricsRegistry();
  const tenantRegistry = options.tenantRegistry ?? new ProcessLocalTenantRegistry();
  const logger = options.logger ?? new ProcessLocalSaieLogger();
  const timingObservabilityOptions =
    options.durationNow === undefined ? {} : { durationNow: options.durationNow };
  const commandTimingObservabilityOptions =
    options.durationNow === undefined ? {} : { now: options.durationNow };
  router.use(
    createSaieRequestObservabilityMiddleware({
      metrics: metricsRegistry,
      logger,
      ...(options.correlationIdGenerator === undefined
        ? {}
        : { generateCorrelationId: options.correlationIdGenerator }),
      ...(options.durationNow === undefined ? {} : { now: options.durationNow }),
    }),
  );
  router.use(createTenantContextMiddleware({ registry: tenantRegistry }));
  const healthReadAdapter = new HealthQueryService();
  const workflowRepository = new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords());
  const approvalRepository = new InMemoryApprovalRepository(
    options.approvalSeedRecords ?? createDeterministicApprovalSeedRecords(),
  );
  const auditRepository = new InMemoryAuditRepository(createDeterministicAuditSeedRecords());
  const executionRepository = new InMemoryExecutionRepository(
    createDeterministicExecutionSeedRecords(workflowRepository),
  );
  const approvalService = new ApprovalService(approvalRepository);
  const auditRecorder = new AuditRecorderService(
    auditRepository,
    options.auditIdGenerator,
    options.auditClock,
    { logger, metrics: metricsRegistry },
  );
  const executionPreparationService = new ExecutionPreparationService(
    approvalRepository,
    executionRepository,
    workflowRepository,
    auditRecorder,
    options.executionIdGenerator,
    options.executionClock,
    { logger, metrics: metricsRegistry, ...timingObservabilityOptions },
  );
  options.configureInternalExecutionPreparation?.(
    new PrepareExecutionApplicationCommand(executionPreparationService),
  );
  const dashboardReadAdapter = new DashboardAggregationReadAdapter(
    new DashboardAggregationService(
      workflowRepository,
      approvalRepository,
      auditRepository,
      executionRepository,
      undefined,
      undefined,
      { metrics: metricsRegistry, ...timingObservabilityOptions },
    ),
  );

  router.use(
    "/dashboard",
    createDashboardRouter(
      createDashboardController({
        getDashboard: new GetDashboardApplicationQuery(dashboardReadAdapter),
      }),
    ),
  );
  router.use(
    "/health",
    createHealthRouter(
      createHealthController({
        getHealth: new GetHealthApplicationQuery(healthReadAdapter),
      }),
    ),
  );
  router.use(
    "/metrics",
    createMetricsRouter(
      createMetricsController({
        getMetrics: new GetMetricsApplicationQuery(metricsRegistry),
      }),
    ),
  );
  router.use(
    "/workflows",
    createWorkflowRouter(
      createWorkflowController({
        listWorkflows: new ListWorkflowsApplicationQuery(workflowRepository),
        getWorkflowById: new GetWorkflowByIdApplicationQuery(workflowRepository),
      }),
    ),
  );
  router.use(
    "/approvals",
    createApprovalRouter(
      createApprovalController({
        listApprovals: new ListApprovalsApplicationQuery(approvalRepository),
        getApprovalById: new GetApprovalByIdApplicationQuery(approvalRepository),
        approveApproval: new ApproveApprovalApplicationCommand(approvalService, auditRecorder, {
          logger,
          metrics: metricsRegistry,
          ...commandTimingObservabilityOptions,
        }),
        rejectApproval: new RejectApprovalApplicationCommand(approvalService, auditRecorder, {
          logger,
          metrics: metricsRegistry,
          ...commandTimingObservabilityOptions,
        }),
        metrics: metricsRegistry,
        logger,
      }),
    ),
  );
  router.use(
    "/audits",
    createAuditRouter(
      createAuditController({
        listAudits: new ListAuditsApplicationQuery(auditRepository),
        getAuditById: new GetAuditByIdApplicationQuery(auditRepository),
      }),
    ),
  );
  router.use(
    "/executions",
    createExecutionRouter(
      createExecutionController({
        listExecutions: new ListExecutionsApplicationQuery(executionRepository),
        getExecutionById: new GetExecutionByIdApplicationQuery(executionRepository),
      }),
    ),
  );

  return router;
};

export const saieApiRouter = createSaieApiRouter();

export * from "./approval.routes.js";
export * from "./audit.routes.js";
export * from "./dashboard.routes.js";
export * from "./execution.routes.js";
export * from "./health.routes.js";
export * from "./metrics.routes.js";
export * from "./workflow.routes.js";
