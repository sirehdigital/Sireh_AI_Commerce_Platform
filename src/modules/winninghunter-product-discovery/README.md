# WinningHunter Product Discovery

SACP-07.03 composes a side-effect-free discovery workflow for SirehLuxe product research.

## Pipeline Stages

- 07.03A: WinningHunter integration foundation and in-memory client boundary.
- 07.03B: deterministic discovery query strategy execution.
- 07.03C: product normalization and signal aggregation.
- 07.03D: opportunity scoring.
- 07.03E: merchant-review shortlist generation.
- 07.03F: end-to-end internal orchestration and sprint closure.

## Boundaries

The module is a decision-support layer only. It can discover, normalize, score, and shortlist product opportunities for human review. It does not match suppliers, calculate landed cost, calculate profit margin, import through AutoDS, create Shopify drafts, publish Shopify products, approve products automatically, or launch ads.

## Public API

The module barrel exports the discovery, normalization, scoring, shortlist, and pipeline contracts plus the internal application services needed to compose the pipeline. No HTTP routes, controllers, Prisma models, migrations, queues, or background workers are part of this sprint.

## Verification

SACP-07.03F is expected to pass TypeScript noEmit, build, lint, targeted WinningHunter tests, the full backend test suite, `git diff --check`, and side-effect scans before architectural review.
