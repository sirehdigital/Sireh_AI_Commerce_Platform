import type { ExecutiveRecommendedStep } from "./executive-orchestrator.types.js";

export const createExecutiveRecommendedSequence = (): readonly ExecutiveRecommendedStep[] => [
  {
    order: 1,
    owner: "ProductAgent",
    action: "Confirm prepared product context and product planning assumptions.",
  },
  {
    order: 2,
    owner: "MarketingAgent",
    action: "Prepare proposal-only campaign strategy for human review.",
  },
  {
    order: 3,
    owner: "ContentAgent",
    action: "Prepare proposal-only content plan from marketing context.",
  },
  {
    order: 4,
    owner: "HumanReviewer",
    action: "Review consolidated executive plan before any external execution.",
  },
];
