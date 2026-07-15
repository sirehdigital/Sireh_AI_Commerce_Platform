import { randomUUID } from "node:crypto";

import { ShopifyProductUpdateService } from "../../../integrations/shopify/shopify-product-update.service.js";
import type {
  SafeShopifyProductUpdateAudit,
  SafeShopifyProductUpdateCommand,
} from "../../../integrations/shopify/shopify-product-update.types.js";
import type {
  ShopifyDraftPreparationProductSnapshot,
  ShopifyDraftPreparationReadRepository,
} from "../workflows/shopify-draft-preparation/index.js";
import {
  CONTROLLED_EXECUTION_SKIPPED_FIELDS,
  createExecutionSafetyReport,
  createRollbackReport,
} from "./execution-audit.js";
import { ControlledExecutionError } from "./execution-errors.js";
import type { ControlledSafeUpdateExecutionRequest } from "./execution-request.js";
import type {
  ControlledExecutionPreservationVerification,
  ControlledSafeUpdateExecutionResult,
} from "./execution-result.js";
import {
  assertExecutionReadBack,
  validateApprovalToken,
  validateControlledExecutionRequest,
  validateExecutionPreflight,
  verifyExecutionReadBack,
} from "./execution-validation.js";
import { HtmlVerificationNormalizer, type HtmlVerificationResult } from "./verification/index.js";

export interface ShopifySafeUpdateExecutor {
  readonly update: (command: SafeShopifyProductUpdateCommand) => Promise<SafeShopifyProductUpdateAudit>;
}

export interface ControlledExecutionDependencies {
  readonly shopifyReader: ShopifyDraftPreparationReadRepository;
  readonly shopifyProductUpdateService: ShopifySafeUpdateExecutor;
  readonly now?: () => Date;
  readonly createExecutionId?: () => string;
}

export class ControlledSafeUpdateExecutionController {
  private readonly htmlNormalizer = new HtmlVerificationNormalizer();

  public constructor(private readonly dependencies: ControlledExecutionDependencies) {}

  public async execute(
    request: ControlledSafeUpdateExecutionRequest,
  ): Promise<ControlledSafeUpdateExecutionResult> {
    const now = this.dependencies.now ?? (() => new Date());
    const executionTime = now();
    const executionId = (this.dependencies.createExecutionId ?? randomUUID)();
    let beforeSnapshot: ShopifyDraftPreparationProductSnapshot | null = null;
    let afterSnapshot: ShopifyDraftPreparationProductSnapshot | null = null;
    let audit: SafeShopifyProductUpdateAudit | null = null;
    let preservationVerification: ControlledExecutionPreservationVerification | null = null;
    let descriptionHtmlVerification: HtmlVerificationResult | null = null;
    let humanApprovalVerified = false;
    let updateInvoked = false;
    let proposalHash = request.approvalToken.proposalHash;

    try {
      validateControlledExecutionRequest(request);
      proposalHash = validateApprovalToken(request, executionTime);
      humanApprovalVerified = true;

      beforeSnapshot = await this.dependencies.shopifyReader.readProductById(
        request.storeDomain,
        request.productId,
      );
      if (beforeSnapshot === null) {
        throw new ControlledExecutionError("PRODUCT_NOT_FOUND", "Exact Shopify product ID was not found.");
      }

      const preflight = validateExecutionPreflight(request, beforeSnapshot, proposalHash);
      updateInvoked = true;
      audit = await this.dependencies.shopifyProductUpdateService.update(preflight.command);

      afterSnapshot = await this.dependencies.shopifyReader.readProductById(
        request.storeDomain,
        request.productId,
      );
      if (afterSnapshot === null) {
        throw new ControlledExecutionError("READBACK_MISMATCH", "Updated product was not found during read-back.");
      }

      preservationVerification = verifyExecutionReadBack(beforeSnapshot, afterSnapshot, audit);
      assertExecutionReadBack(preservationVerification);
      descriptionHtmlVerification = this.verifyDescriptionHtml(request, afterSnapshot);

      return {
        executionId,
        workflowId: request.approvedProposal.workflowId,
        proposalHash,
        approvedBy: request.approvalToken.approvedBy,
        executionTime: executionTime.toISOString(),
        beforeSnapshot,
        afterSnapshot,
        preservationVerification,
        descriptionHtmlVerification,
        changedFields: [...audit.changes],
        skippedFields: [...CONTROLLED_EXECUTION_SKIPPED_FIELDS],
        warnings: [],
        mutationCount: 2,
        rollback: createRollbackReport(true),
        safetyReport: createExecutionSafetyReport({
          humanApprovalVerified,
          shopifyMutationExecuted: true,
          autoDSLinkPreserved: true,
        }),
        publicationExecuted: false,
        inventoryMutation: false,
        status: "SUCCESS",
      };
    } catch (error) {
      if (updateInvoked && afterSnapshot === null) {
        afterSnapshot = await this.readBackSafely(request);
      }

      if (beforeSnapshot !== null && afterSnapshot !== null && audit !== null) {
        preservationVerification = verifyExecutionReadBack(beforeSnapshot, afterSnapshot, audit);
        descriptionHtmlVerification = this.htmlNormalizer.compare(
          request.approvedProposal.safeUpdateProposal?.descriptionHtml ?? "",
          afterSnapshot.descriptionHtml,
        );
      }

      const controlledError =
        error instanceof ControlledExecutionError
          ? error
          : new ControlledExecutionError(
              "SAFE_UPDATE_FAILED",
              error instanceof Error ? error.message : "Existing Shopify safe update service failed.",
            );
      const autoDSLinkPreserved =
        preservationVerification?.autoDSLinkPreserved ?? !updateInvoked;

      return {
        executionId,
        workflowId: request.approvedProposal.workflowId,
        proposalHash,
        approvedBy: request.approvalToken.approvedBy,
        executionTime: executionTime.toISOString(),
        beforeSnapshot,
        afterSnapshot,
        preservationVerification,
        descriptionHtmlVerification,
        changedFields: audit === null ? [] : [...audit.changes],
        skippedFields: [...CONTROLLED_EXECUTION_SKIPPED_FIELDS],
        warnings: [controlledError.message],
        mutationCount: updateInvoked ? (audit === null ? "unknown" : 2) : 0,
        rollback: createRollbackReport(false),
        safetyReport: createExecutionSafetyReport({
          humanApprovalVerified,
          shopifyMutationExecuted: updateInvoked ? (audit === null ? "unknown" : true) : false,
          autoDSLinkPreserved,
        }),
        publicationExecuted: false,
        inventoryMutation: false,
        status: "FAILED",
        failureCode: controlledError.code,
      };
    }
  }

  private async readBackSafely(
    request: ControlledSafeUpdateExecutionRequest,
  ): Promise<ShopifyDraftPreparationProductSnapshot | null> {
    try {
      return await this.dependencies.shopifyReader.readProductById(request.storeDomain, request.productId);
    } catch {
      return null;
    }
  }

  private verifyDescriptionHtml(
    request: ControlledSafeUpdateExecutionRequest,
    snapshot: ShopifyDraftPreparationProductSnapshot,
  ): HtmlVerificationResult {
    const expected = request.approvedProposal.safeUpdateProposal?.descriptionHtml;
    if (expected === undefined) {
      throw new ControlledExecutionError(
        "READBACK_MISMATCH",
        "Approved proposal has no description HTML for read-back verification.",
      );
    }
    const verification = this.htmlNormalizer.compare(expected, snapshot.descriptionHtml);
    if (!verification.equivalent) {
      throw new ControlledExecutionError(
        "READBACK_MISMATCH",
        verification.differenceReason ?? "Description HTML read-back verification failed.",
      );
    }
    return verification;
  }
}

export const createControlledSafeUpdateExecutionController = (
  shopifyReader: ShopifyDraftPreparationReadRepository,
): ControlledSafeUpdateExecutionController =>
  new ControlledSafeUpdateExecutionController({
    shopifyReader,
    shopifyProductUpdateService: new ShopifyProductUpdateService(undefined, {
      descriptionHtmlEquivalent: (expected, actual) =>
        new HtmlVerificationNormalizer().compare(expected, actual).equivalent,
    }),
  });
