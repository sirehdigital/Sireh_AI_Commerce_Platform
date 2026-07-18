import { Router } from "express";

import type { ExecutionController } from "../controllers/index.js";

export const createExecutionRouter = (controller: ExecutionController): Router => {
  const router = Router();

  router.get("/", controller.listExecutions);
  router.get("/:executionId", controller.getExecution);

  return router;
};
