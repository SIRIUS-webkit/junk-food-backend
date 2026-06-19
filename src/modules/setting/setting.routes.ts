import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/authorize";
import { PERMISSIONS } from "../../constants/permissions";
import * as unit from "./unit.controller";
import * as bank from "./bank.controller";

const router = Router();
router.use(authenticate);

const idParam = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
});

// ── Units ──
const unitBody = z.object({
  name: z.string().min(1),
  shortName: z.string().nullish(),
});
router.get(
  "/units",
  requirePermission(PERMISSIONS.SETTING_VIEW),
  asyncHandler(unit.list),
);
router.post(
  "/units",
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate(z.object({ body: unitBody })),
  asyncHandler(unit.create),
);
router.put(
  "/units/:id",
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: unitBody.partial().extend({ isActive: z.boolean().optional() }),
    }),
  ),
  asyncHandler(unit.update),
);
router.delete(
  "/units/:id",
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate(idParam),
  asyncHandler(unit.remove),
);

// ── Banks ──
const bankBody = z.object({
  name: z.string().min(1),
  accountName: z.string().nullish(),
  accountNumber: z.string().nullish(),
  branch: z.string().nullish(),
});
router.get(
  "/banks",
  requirePermission(PERMISSIONS.SETTING_VIEW),
  asyncHandler(bank.list),
);
router.post(
  "/banks",
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate(z.object({ body: bankBody })),
  asyncHandler(bank.create),
);
router.put(
  "/banks/:id",
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: bankBody.partial().extend({ isActive: z.boolean().optional() }),
    }),
  ),
  asyncHandler(bank.update),
);
router.delete(
  "/banks/:id",
  requirePermission(PERMISSIONS.SETTING_MANAGE),
  validate(idParam),
  asyncHandler(bank.remove),
);

export default router;
