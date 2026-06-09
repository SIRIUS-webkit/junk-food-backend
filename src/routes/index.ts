import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import entityRoutes from '../modules/entity/entity.routes';
import shopRoutes from '../modules/shop/shop.routes';
import userRoutes from '../modules/user/user.routes';
import categoryRoutes from '../modules/category/category.routes';
import productRoutes from '../modules/product/product.routes';
import customerRoutes from '../modules/customer/customer.routes';
import supplierRoutes from '../modules/supplier/supplier.routes';
import stockRoutes from '../modules/stock/stock.routes';
import saleRoutes from '../modules/sale/sale.routes';
import purchaseRoutes from '../modules/purchase/purchase.routes';
import reportRoutes from '../modules/report/report.routes';
import settingRoutes from '../modules/setting/setting.routes';

const router = Router();

router.get('/health', (_req, res) =>
  res.json({
    success: true,
    status: 'ok',
    env: process.env.APP_ENV ?? 'local',
    ts: new Date().toISOString(),
  }),
);

router.use('/auth', authRoutes);
router.use('/entities', entityRoutes); // super admin: CRUD entity + main user
router.use('/shops', shopRoutes);
router.use('/users', userRoutes); // sub users + permissions
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/stock', stockRoutes);
router.use('/sales', saleRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingRoutes); // units + banks

export default router;
