import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import * as ctrl from './report.controller';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.REPORT_VIEW));

// Query params: ?from=ISO&to=ISO&shopId=
router.get('/sales/by-product', asyncHandler(ctrl.salesByProduct));
router.get('/sales/by-category', asyncHandler(ctrl.salesByCategory));
router.get('/sales/by-customer', asyncHandler(ctrl.salesByCustomer));

router.get('/purchases/by-product', asyncHandler(ctrl.purchasesByProduct));
router.get('/purchases/by-category', asyncHandler(ctrl.purchasesByCategory));
router.get('/purchases/by-supplier', asyncHandler(ctrl.purchasesBySupplier));

export default router;
