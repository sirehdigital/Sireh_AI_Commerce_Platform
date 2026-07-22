# Product Import Persistence and API

`product-import` is an SACP commerce module. It accepts supplier product input, runs the existing AI Product Import Pipeline, creates Shopify-ready product drafts, and leaves every successful import pending merchant approval.

## Persistence

Product imports are persisted in the `ProductImport` Prisma model. Records store safe operational metadata only: source identity, status, idempotency key, draft and approval linkage, audit reference, failure details, warnings, and a redacted payload snapshot. Supplier credentials, access tokens, API keys, and secrets are not stored.

The production API composition also uses durable repositories for linked Product Draft, Approval, and Audit records:

- Product Drafts are stored in `ProductDraft` with the complete draft payload plus indexed tenant/store/source/status metadata.
- Approval records are stored in `ApprovalRecord` and remain `pending` with `requiresHumanApproval: true` and `executionEnabled: false`.
- Audit records are stored in `AuditRecord`; sensitive detail keys such as tokens, secrets, passwords, credentials, authorization headers, and API keys are redacted before persistence.

## API

- `POST /api/product-imports`
- `GET /api/product-imports`
- `GET /api/product-imports/:importId`
- `GET /api/product-imports/:importId/status`
- `POST /api/product-imports/:importId/retry`

Example import request:

```json
{
  "sourcePlatform": "generic",
  "requestedBy": "merchant-api",
  "payload": {
    "externalProductId": "supplier-001",
    "sourcePlatform": "generic",
    "title": "Lumora Body Lotion",
    "images": [{ "url": "https://images.example/lotion.jpg" }],
    "variants": [{ "sku": "LUMORA-LOTION", "supplierPrice": 8 }],
    "currency": "USD",
    "shippingDestinations": ["US"],
    "tags": ["beauty"],
    "rawMetadata": {}
  }
}
```

Successful imports return a safe response with `importId`, `status`, `productDraftId`, `approvalId`, duplicate state, and timestamps. Detail responses may include safe linked summaries for the Product Draft, Approval, and Audit records. Raw database internals, supplier credentials, stack traces, and complete sensitive payloads are not exposed.

## Status Lifecycle

API persistence supports `RECEIVED`, `VALIDATING`, `PROCESSING`, `DRAFT_CREATED`, `PENDING_APPROVAL`, `COMPLETED`, and `FAILED`. The current pipeline completes successful imports at `PENDING_APPROVAL`; no product is published automatically.

## Idempotency

Duplicate detection uses tenant, store, source platform, and external product ID. Repeated imports return the prior pipeline result and do not create another product draft. Forced re-imports create a separate historical record and link back to the previous import through `parentImportId`.

## Approval Boundary

Every successful import creates a Product Draft and a pending Approval record. Approval is mandatory, execution is disabled, and no Shopify publish operation is called from this module.

## Consistency and Restart Safety

The success path persists the Product Draft, Approval, and Audit records before creating the `PENDING_APPROVAL` Product Import record. If a mandatory linked write fails, the pipeline returns a controlled failed result and persists an inspectable `FAILED` import record with failure stage and code when possible.

Repository instances can be recreated against the same database and still resolve import, draft, approval, and audit records by their durable IDs. Duplicate detection remains based on tenant, store, source platform, and external product ID after restart.

Tenant and store IDs scope Product Import, Product Draft, Approval, and Audit lookups. A tenant or store cannot read another tenant/store's persisted linked records through the product-import API boundary.

## Known Limitations

The current consistency boundary is repository-ordered rather than a broad cross-module Unit of Work. A future sprint can add a shared transaction coordinator if the project standardizes that abstraction. Live supplier APIs are intentionally not implemented for AutoDS or WinningHunter; adapters only normalize supplied payloads.
