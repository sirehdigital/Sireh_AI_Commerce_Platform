import { Router } from "express";

import type { AuditController } from "../controllers/index.js";

export const createAuditRouter = (controller: AuditController): Router => {
  const router = Router();

  router.get("/", controller.listAudits);
  router.get("/:auditId", controller.getAudit);

  return router;
};
