# Product Import Persistence and API

`product-import` is an SACP commerce module. It accepts supplier product input, runs the existing AI Product Import Pipeline, creates Shopify-ready product drafts, and leaves every successful import pending merchant approval.

## Persistence

Product imports are persisted in the `ProductImport` Prisma model. Records store safe operational metadata only: source identity, status, idempotency key, draft and approval linkage, audit reference, failure details, warnings, and a redacted payload snapshot. Supplier credentials, access tokens, API keys, and secrets are not stored.

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

Successful imports return a safe response with `importId`, `status`, `productDraftId`, `approvalId`, duplicate state, and timestamps.

## Status Lifecycle

API persistence supports `RECEIVED`, `VALIDATING`, `PROCESSING`, `DRAFT_CREATED`, `PENDING_APPROVAL`, `COMPLETED`, and `FAILED`. The current pipeline completes successful imports at `PENDING_APPROVAL`; no product is published automatically.

## Idempotency

Duplicate detection uses tenant, store, source platform, and external product ID. Repeated imports return the prior pipeline result and do not create another product draft. Forced re-imports create a separate historical record and link back to the previous import through `parentImportId`.

## Approval Boundary

Every successful import creates a Product Draft and a pending Approval record. Approval is mandatory, execution is disabled, and no Shopify publish operation is called from this module.

## Known Limitations

The persistence layer records Product Draft and Approval IDs, but those modules still use their current repository implementations. Live supplier APIs are intentionally not implemented for AutoDS or WinningHunter; adapters only normalize supplied payloads.
