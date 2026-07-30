# Storefront Module

SACP-03.03A activates the Shopify Storefront Foundation only.

The active public boundary is limited to:

- `StorefrontProfile`
- `StorefrontProject`
- `StorefrontFoundationService`
- repository persistence
- REST endpoints for profiles, projects, project status, and lifecycle transitions
- approval records
- audit records
- `PLAN_ONLY` execution

The module intentionally does not deploy, activate, or mutate Shopify storefront assets. It does not publish products, upload media, create live metafields, create metaobjects, overwrite theme files, or claim Shopify preview URLs.

Several implementation files already exist for later sprints. Homepage planners, product page planners, collection planners, navigation planners, theme gateways, artifact generators, preview models, metafield/metaobject planning, and deployment helpers are reserved for SACP-03.03B through SACP-03.03F. They remain in source control as internal future implementation, but they are not exported from the active storefront barrels, not wired into the REST API, not executed by the foundation service, and not required by SACP-03.03A tests.
