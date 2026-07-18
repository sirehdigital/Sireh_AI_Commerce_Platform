import { Router } from "express";

import type { ApprovalController } from "../controllers/index.js";

export const createApprovalRouter = (controller: ApprovalController): Router => {
  const router = Router();

  router.get("/", controller.listApprovals);
  router.post("/:approvalId/approve", controller.approveApproval);
  router.post("/:approvalId/reject", controller.rejectApproval);
  router.get("/:approvalId", controller.getApproval);

  return router;
};
