// Permission keys assignable to sub users. The entity main account and the
// super admin implicitly have all permissions.
export const PERMISSIONS = {
  // Shops
  SHOP_VIEW: 'shop.view',
  SHOP_MANAGE: 'shop.manage',
  // Sub users
  USER_VIEW: 'user.view',
  USER_MANAGE: 'user.manage',
  // Products & categories
  PRODUCT_VIEW: 'product.view',
  PRODUCT_MANAGE: 'product.manage',
  CATEGORY_VIEW: 'category.view',
  CATEGORY_MANAGE: 'category.manage',
  // Stock
  STOCK_VIEW: 'stock.view',
  STOCK_MANAGE: 'stock.manage',
  STOCK_TRANSFER: 'stock.transfer',
  // Customers / suppliers
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_MANAGE: 'customer.manage',
  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_MANAGE: 'supplier.manage',
  // Sales / purchases
  SALE_VIEW: 'sale.view',
  SALE_MANAGE: 'sale.manage',
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_MANAGE: 'purchase.manage',
  // Reports
  REPORT_VIEW: 'report.view',
  // Settings (unit / bank)
  SETTING_VIEW: 'setting.view',
  SETTING_MANAGE: 'setting.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);
