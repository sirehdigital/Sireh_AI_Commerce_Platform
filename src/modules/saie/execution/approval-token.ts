import { createHash } from "node:crypto";

import type { ProductPreparationProposal } from "../workflows/product-preparation/index.js";
import type { TagReconciliationPolicy } from "./tag-reconciliation/index.js";

export const CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS = [
  "title",
  "descriptionHtml",
  "seo",
  "tags",
  "productType",
  "vendor",
  "price",
  "compareAtPrice",
  "collections",
  "templateSuffix",
  "status",
] as const;

export type ControlledSafeUpdateApprovedField =
  (typeof CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS)[number];

export interface ControlledSafeUpdateApprovalScope {
  readonly executionMode: "controlled-safe-update";
  readonly storeDomain: `${string}.myshopify.com`;
  readonly productId: string;
  readonly targetStatus: "DRAFT";
  readonly tagPolicy: TagReconciliationPolicy;
  readonly approvedFields: readonly ControlledSafeUpdateApprovedField[];
}

export interface ApprovalToken {
  readonly workflowId: string;
  readonly proposalHash: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly expiresAt: string;
  readonly approvalScope: ControlledSafeUpdateApprovalScope;
}

export const REVIEW_ONLY_APPROVER = "REVIEW_ONLY_NOT_APPROVED";

export interface ReviewApprovalTokenInput {
  readonly proposal: ProductPreparationProposal;
  readonly storeDomain: `${string}.myshopify.com`;
  readonly productId: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export const createReviewApprovalToken = (
  input: ReviewApprovalTokenInput,
): ApprovalToken => {
  const tagPolicy = input.proposal.safeUpdateProposal?.tagPolicy;
  if (tagPolicy === undefined) {
    throw new TypeError("Review approval token requires an explicit proposal tag policy.");
  }

  return {
    workflowId: input.proposal.workflowId,
    proposalHash: calculateProposalHash(input.proposal),
    approvedBy: REVIEW_ONLY_APPROVER,
    approvedAt: input.issuedAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    approvalScope: {
      executionMode: "controlled-safe-update",
      storeDomain: input.storeDomain,
      productId: input.productId,
      targetStatus: "DRAFT",
      tagPolicy,
      approvedFields: [...CONTROLLED_SAFE_UPDATE_APPROVED_FIELDS],
    },
  };
};

export const calculateProposalHash = (proposal: ProductPreparationProposal): string =>
  createHash("sha256").update(stableSerialize(proposal)).digest("hex");

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  }

  if (typeof value === "undefined") {
    return '"__undefined__"';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }

  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }

  if (typeof value === "symbol") {
    return JSON.stringify(value.description ?? "");
  }

  if (typeof value === "function") {
    return JSON.stringify(value.name);
  }

  throw new TypeError("Proposal contains an unsupported value.");
};
