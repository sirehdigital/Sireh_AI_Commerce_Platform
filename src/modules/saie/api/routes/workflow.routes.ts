import { Router } from "express";

import type { WorkflowController } from "../controllers/index.js";

export const createWorkflowRouter = (controller: WorkflowController): Router => {
  const router = Router();

  router.get("/", controller.listWorkflows);
  router.get("/:workflowId", controller.getWorkflow);

  return router;
};
