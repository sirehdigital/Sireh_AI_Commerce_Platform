# SAIE v0.2.0 Beta Readiness

## Purpose

SAIE v0.2.0 Beta is a read-oriented, human-approved operating layer for the Sireh AI Commerce Platform. It exposes deterministic planning, approval review, audit preview, execution-preparation intent, dashboard aggregation, observability, and process-local tenant isolation.

## Architecture

The supported dependency direction is:

```text
Routes
  -> Controllers
  -> Application Queries / Commands
  -> Services / Repository Ports
  -> In-Memory Infrastructure
  -> Existing SAIE Engines / Preview Providers
```

Controllers depend on application ports and commands. Repositories do not depend on HTTP. The dashboard renderer receives a view model and does not query repositories. Observability records request and business lifecycle events without controlling business operations. Tenant middleware resolves request context only; it is not authentication or authorization.

## API Endpoints

Supported SAIE Beta endpoints:

```text
GET  /api/saie/dashboard
GET  /api/saie/health
GET  /api/saie/metrics
GET  /api/saie/workflows
GET  /api/saie/workflows/:workflowId
GET  /api/saie/approvals
GET  /api/saie/approvals/:approvalId
POST /api/saie/approvals/:approvalId/approve
POST /api/saie/approvals/:approvalId/reject
GET  /api/saie/audits
GET  /api/saie/audits/:auditId
GET  /api/saie/executions
GET  /api/saie/executions/:executionId
```

Only approval decisions mutate SAIE state. Execution mutation routes are not supported.

## Approval Model

Approval is human decision only. Approval requests require bounded `decidedBy`, optional bounded `reason`, and optional positive integer `expectedVersion`. Approval updates use optimistic version checks and keep `executionEnabled: false`.

## Audit Model

Audit records are process-local and append-only. Approval and execution-preparation actions record audit events after the primary state update. This coordination is non-atomic and is a Beta limitation.

## Execution-Preparation Model

Execution preparation records intent only. Prepared execution records use:

```text
mode: preview
executionEnabled: false
approvalRequired: true
executableActions: []
```

No workflow execution, Shopify mutation, email, ads, marketplace action, queue, retry, cancellation, or background job is available.

## Tenant Model

Tenant context contains `tenantId`, `storeId`, and optional normalized `shopDomain`. Missing headers resolve to the explicit default context:

```text
tenant-default / store-default
```

Tenant isolation is process-local, repository-enforced, not persistent, and not authenticated.

## Observability

SAIE Beta includes structured process-local logging, bounded correlation IDs, request lifecycle metrics, approval metrics, audit metrics, execution-preparation metrics, dashboard metrics, and health metadata. Metrics reset on process restart and do not expose tenant identifiers as labels.

## Security Boundaries

The dashboard enforces CSP and escapes dynamic HTML. API responses use standard success/error envelopes. Inputs are bounded. Correlation IDs and tenant identifiers are validated. Health and metrics responses must not expose credentials, raw logs, request bodies, environment variables, stack traces, actor names, or decision reasons.

## Known Limitations

- In-memory repositories only.
- Data and metrics reset on restart.
- Tenant headers are not authenticated identity.
- No RBAC.
- No durable approval history.
- No durable audit evidence.
- Non-atomic approval-to-audit coordination.
- Non-atomic execution-to-audit coordination.
- No execution worker or queue.
- Known Shopify OAuth HMAC test failures block Shopify production execution.
- Broad SAIE directories must be staged and reviewed before release tagging.

## Release Metadata

```text
version: 0.2.0-beta
releaseStage: beta
executionEnabled: false
approvalRequired: true
storageMode: in-memory
tenantIsolationMode: process-local
observabilityMode: process-local
```

## Readiness Decision

Current classification:

```text
READY_FOR_BETA_WITH_CONDITIONS
```

Conditions before tagging:

- Stage and review all untracked SAIE implementation and documentation paths.
- Keep Shopify OAuth HMAC failures visible and classify them as Shopify production blockers.
- Do not claim Shopify execution or production readiness until OAuth security repair is complete.

## Next Phase

```text
SACP-02.01 - Shopify OAuth Security Repair
```
