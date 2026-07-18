# SAIE v0.2.0 Beta Risk Register

| Risk | Severity | Impact | Current mitigation | Release classification | Required future action |
| --- | --- | --- | --- | --- | --- |
| In-memory-only storage | high | State is not durable across process restarts. | Explicit health/dashboard/readiness metadata. | Beta limitation | Add persistent repositories. |
| Restart data loss | high | Approval, audit, execution, and metrics state reset. | Process-local scope is documented. | Beta limitation | Add database-backed state and migrations. |
| Request-supplied `decidedBy` | medium | Actor identity is user-supplied and unauthenticated. | Value is bounded and logged only as controlled metadata where needed. | Beta limitation | Add authenticated identity and server-side actor resolution. |
| Tenant headers not authenticated | high | Tenant context is request-supplied and not proof of ownership. | Headers are validated and explicitly marked `not-enforced`. | Beta limitation | Add auth, tenant ownership checks, and RBAC. |
| Process-local tenant isolation | high | Isolation is not distributed or persistent. | Repository-level tenant filtering and default context are explicit. | Beta limitation | Add persistent tenant model and scoped storage. |
| Non-atomic approval/audit coordination | medium | Approval update can succeed while audit append fails. | Audit failure is surfaced by service flow and tests. | Beta limitation | Add transaction or outbox pattern. |
| Non-atomic execution/audit coordination | medium | Execution preparation can be recorded while audit append fails. | Recording error classification exists. | Beta limitation | Add transaction or outbox pattern. |
| Process-local metrics | medium | Metrics are node-local and reset on restart. | Metrics endpoint states process-local storage. | Beta limitation | Add external telemetry sink. |
| Metrics reset on restart | medium | Operational trend history is lost. | Health and docs state limitation. | Beta limitation | Add persistent metrics export. |
| Known Shopify OAuth HMAC test failures | critical | Shopify production execution cannot be trusted. | Tests remain failing and visible; no suppression. | SACP/Shopify production blocker | Repair OAuth HMAC validation before controlled Shopify execution. |
| Untracked SAIE files | critical | Release tag may omit required SAIE implementation. | Git status reports broad untracked SAIE paths. | SAIE Beta blocker until staged/reviewed | Stage and review complete SAIE file set before tagging. |
| No persistent approval history | high | Approval evidence is not production-grade. | Approval repository is explicitly process-local. | Beta limitation | Persist approval records. |
| No persistent audit evidence | high | Audit trail is not production-grade evidence. | Audit repository is append-only in process. | Beta limitation | Persist append-only audit records. |
| No execution worker | medium | Approved work cannot progress to operational execution. | Execution remains disabled and preview-only. | Accepted Beta scope | Design worker after Shopify security repair. |
| No RBAC | high | No role-level access controls exist. | No production access claim is made. | Beta limitation | Add auth and RBAC. |
| No production secret-management review | high | Production deployment secret posture is not certified. | SAIE responses avoid exposing known secret fields. | Future production requirement | Complete secret management review before production. |
