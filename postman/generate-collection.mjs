import { writeFileSync } from 'fs';

const bearerAuth = {
  type: 'bearer',
  bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
};

const loginTestScript = {
  exec: [
    "const json = pm.response.json();",
    "if (pm.response.code === 200 && json.data) {",
    "  pm.collectionVariables.set('accessToken', json.data.accessToken);",
    "  pm.collectionVariables.set('refreshToken', json.data.refreshToken);",
    "  if (json.data.user?.entityId) {",
    "    pm.collectionVariables.set('entityId', String(json.data.user.entityId));",
    "  }",
    "  console.log('Tokens saved to collection variables');",
    "}",
  ],
  type: 'text/javascript',
};

function req(name, method, path, { body, query, description, auth, test } = {}) {
  const url = query ? `{{baseUrl}}${path}?${query}` : `{{baseUrl}}${path}`;
  const resolvedAuth = auth === null ? { type: 'noauth' } : auth === undefined ? bearerAuth : auth;
  const item = {
    name,
    request: {
      method,
      header: [{ key: 'Content-Type', value: 'application/json' }],
      url,
      description,
      auth: resolvedAuth,
    },
  };
  if (body !== undefined) {
    item.request.body = { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2) };
  }
  if (test) item.event = [{ listen: 'test', script: test }];
  return item;
}

function folder(name, items, { auth = bearerAuth, description } = {}) {
  return {
    name,
    description,
    auth,
    item: items,
  };
}

const entityScope = 'entityId={{entityId}}';
const pagination = 'page=1&pageSize=20';

const collection = {
  info: {
    _postman_id: 'junkshop-api-v1',
    name: 'JunkShop API',
    description:
      'JunkShop Backend API collection.\n\n**Setup:**\n1. Import this collection + `JunkShop-Local.postman_environment.json`\n2. Run **Auth → Entity User Login** (demo: KBB / admin) or **Super Admin Login**\n3. Tokens are saved automatically to `accessToken`\n\n**Super admin:** entity-scoped routes need `?entityId=` (default `1` = demo Ko Bar Bu).\n\n**Demo credentials:**\n- Super admin: `admin@junkshop.local` / `Admin@12345`\n- Entity user: entity `KBB`, user `admin` / `Admin@12345`',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000/api/v1' },
    { key: 'accessToken', value: '' },
    { key: 'refreshToken', value: '' },
    { key: 'entityId', value: '1' },
  ],
  item: [
    folder('Health', [req('Health Check', 'GET', '/health', { auth: null })], { auth: null }),
    folder(
      'Auth',
      [
        req('Super Admin Login', 'POST', '/auth/admin/login', {
          auth: null,
          body: { email: 'admin@junkshop.local', password: 'Admin@12345' },
          description: 'Saves accessToken + refreshToken to collection variables.',
          test: loginTestScript,
        }),
        req('Entity User Login', 'POST', '/auth/login', {
          auth: null,
          body: { entityCode: 'KBB', username: 'admin', password: 'Admin@12345' },
          description: 'Demo entity Ko Bar Bu. Main user has all permissions.',
          test: loginTestScript,
        }),
        req('Refresh Token', 'POST', '/auth/refresh', {
          auth: null,
          body: { refreshToken: '{{refreshToken}}' },
          test: loginTestScript,
        }),
        req('Get Current User', 'GET', '/auth/me'),
      ],
      { auth: null },
    ),
    folder('Entities (Super Admin)', [
      req('List Entities', 'GET', '/entities', { query: `${pagination}&search=` }),
      req('Get Entity', 'GET', '/entities/1'),
      req('Create Entity', 'POST', '/entities', {
        body: {
          code: 'DEMO',
          name: 'Demo Company',
          description: 'Test entity',
          mainUsername: 'owner',
          mainPassword: 'Admin@12345',
        },
      }),
      req('Update Entity', 'PUT', '/entities/1', { body: { name: 'Ko Bar Bu Updated' } }),
      req('Delete Entity', 'DELETE', '/entities/99', { description: 'Change id before use.' }),
    ]),
    folder('Shops', [
      req('List Shops', 'GET', '/shops', { query: `${entityScope}&${pagination}&search=` }),
      req('Get Shop', 'GET', '/shops/1', { query: entityScope }),
      req('Create Shop', 'POST', '/shops', {
        query: entityScope,
        body: { code: 'KBB-S3', name: 'Shop 3', address: 'Yangon' },
      }),
      req('Update Shop', 'PUT', '/shops/1', { query: entityScope, body: { name: 'Shop 1 Updated' } }),
      req('Delete Shop', 'DELETE', '/shops/99', { query: entityScope }),
    ]),
    folder('Users', [
      req('List Permission Keys', 'GET', '/users/permissions', { query: entityScope }),
      req('List Users', 'GET', '/users', { query: `${entityScope}&${pagination}&search=` }),
      req('Get User', 'GET', '/users/1', { query: entityScope }),
      req('Create User', 'POST', '/users', {
        query: entityScope,
        body: {
          username: 'staff1',
          name: 'Staff One',
          password: 'Admin@12345',
          permissions: ['product.view', 'stock.view', 'sale.manage'],
        },
      }),
      req('Update User', 'PUT', '/users/2', { query: entityScope, body: { name: 'Staff Updated' } }),
      req('Reset Password', 'PUT', '/users/2/password', { query: entityScope, body: { password: 'Admin@12345' } }),
      req('Set Permissions', 'PUT', '/users/2/permissions', {
        query: entityScope,
        body: { permissions: ['product.view', 'product.manage', 'stock.view'] },
      }),
      req('Delete User', 'DELETE', '/users/99', { query: entityScope }),
    ]),
    folder('Categories', [
      req('List Categories', 'GET', '/categories', { query: `${entityScope}&${pagination}&search=` }),
      req('Get Category', 'GET', '/categories/1', { query: entityScope }),
      req('Create Category', 'POST', '/categories', { query: entityScope, body: { name: 'Scrap Metal', description: 'Metal items' } }),
      req('Update Category', 'PUT', '/categories/1', { query: entityScope, body: { name: 'Metal' } }),
      req('Delete Category', 'DELETE', '/categories/99', { query: entityScope }),
    ]),
    folder('Products', [
      req('List Products', 'GET', '/products', { query: `${entityScope}&${pagination}&search=&categoryId=` }),
      req('Get Product', 'GET', '/products/1', { query: entityScope }),
      req('Create Product', 'POST', '/products', {
        query: entityScope,
        body: { code: 'P001', name: 'Copper Wire', categoryId: 1, purchasePrice: 1000, salePrice: 1500 },
      }),
      req('Update Product', 'PUT', '/products/1', { query: entityScope, body: { salePrice: 1600 } }),
      req('Delete Product', 'DELETE', '/products/99', { query: entityScope }),
    ]),
    folder('Customers', [
      req('List Customers', 'GET', '/customers', { query: `${entityScope}&${pagination}&search=` }),
      req('Get Customer', 'GET', '/customers/1', { query: entityScope }),
      req('Create Customer', 'POST', '/customers', {
        query: entityScope,
        body: { name: 'U Aung', phone: '09123456789', address: 'Yangon' },
      }),
      req('Update Customer', 'PUT', '/customers/1', { query: entityScope, body: { phone: '09999999999' } }),
      req('Delete Customer', 'DELETE', '/customers/99', { query: entityScope }),
    ]),
    folder('Suppliers', [
      req('List Suppliers', 'GET', '/suppliers', { query: `${entityScope}&${pagination}&search=` }),
      req('Get Supplier', 'GET', '/suppliers/1', { query: entityScope }),
      req('Create Supplier', 'POST', '/suppliers', {
        query: entityScope,
        body: { name: 'Supplier Co', phone: '09111111111' },
      }),
      req('Update Supplier', 'PUT', '/suppliers/1', { query: entityScope, body: { name: 'Supplier Updated' } }),
      req('Delete Supplier', 'DELETE', '/suppliers/99', { query: entityScope }),
    ]),
    folder('Stock', [
      req('List Stock Balances', 'GET', '/stock', { query: `${entityScope}&shopId=&productId=` }),
      req('List Stock Transactions', 'GET', '/stock/transactions', { query: `${entityScope}&shopId=&productId=&type=` }),
      req('Record Damage', 'POST', '/stock/damage', {
        query: entityScope,
        body: { shopId: 1, productId: 1, quantity: 1, note: 'Damaged item' },
      }),
      req('Record Loss', 'POST', '/stock/loss', {
        query: entityScope,
        body: { shopId: 1, productId: 1, quantity: 1, note: 'Lost item' },
      }),
      req('Set Balance', 'POST', '/stock/balance', {
        query: entityScope,
        body: { shopId: 1, productId: 1, quantity: 100, note: 'Opening stock' },
      }),
      req('Transfer Stock', 'POST', '/stock/transfer', {
        query: entityScope,
        body: { fromShopId: 1, toShopId: 2, productId: 1, quantity: 5, note: 'Transfer' },
      }),
    ]),
    folder('Sales', [
      req('List Sales', 'GET', '/sales', { query: `${entityScope}&${pagination}&search=` }),
      req('Get Sale', 'GET', '/sales/1', { query: entityScope }),
      req('Create Sale', 'POST', '/sales', {
        query: entityScope,
        body: {
          shopId: 1,
          customerId: 1,
          invoiceNo: 'INV-001',
          note: 'Walk-in sale',
          deductStock: true,
          items: [{ productId: 1, quantity: 2, unitPrice: 1500 }],
        },
      }),
    ]),
    folder('Purchases', [
      req('List Purchases', 'GET', '/purchases', { query: `${entityScope}&${pagination}&search=` }),
      req('Get Purchase', 'GET', '/purchases/1', { query: entityScope }),
      req('Create Purchase', 'POST', '/purchases', {
        query: entityScope,
        body: {
          shopId: 1,
          supplierId: 1,
          refNo: 'PO-001',
          note: 'Stock in',
          addStock: true,
          items: [{ productId: 1, quantity: 10, unitPrice: 1000 }],
        },
      }),
    ]),
    folder('Reports', [
      req('Sales by Product', 'GET', '/reports/sales/by-product', {
        query: `${entityScope}&from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&shopId=`,
      }),
      req('Sales by Category', 'GET', '/reports/sales/by-category', {
        query: `${entityScope}&from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&shopId=`,
      }),
      req('Sales by Customer', 'GET', '/reports/sales/by-customer', {
        query: `${entityScope}&from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&shopId=`,
      }),
      req('Purchases by Product', 'GET', '/reports/purchases/by-product', {
        query: `${entityScope}&from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&shopId=`,
      }),
      req('Purchases by Category', 'GET', '/reports/purchases/by-category', {
        query: `${entityScope}&from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&shopId=`,
      }),
      req('Purchases by Supplier', 'GET', '/reports/purchases/by-supplier', {
        query: `${entityScope}&from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&shopId=`,
      }),
    ]),
    folder('Settings', [
      req('List Units', 'GET', '/settings/units', { query: `${entityScope}&${pagination}` }),
      req('Create Unit', 'POST', '/settings/units', { query: entityScope, body: { name: 'Kilogram', shortName: 'kg' } }),
      req('Update Unit', 'PUT', '/settings/units/1', { query: entityScope, body: { name: 'Kilogram' } }),
      req('Delete Unit', 'DELETE', '/settings/units/99', { query: entityScope }),
      req('List Banks', 'GET', '/settings/banks', { query: `${entityScope}&${pagination}` }),
      req('Create Bank', 'POST', '/settings/banks', {
        query: entityScope,
        body: { name: 'KBZ Bank', accountName: 'Ko Bar Bu', accountNumber: '123456789', branch: 'Yangon' },
      }),
      req('Update Bank', 'PUT', '/settings/banks/1', { query: entityScope, body: { branch: 'Mandalay' } }),
      req('Delete Bank', 'DELETE', '/settings/banks/99', { query: entityScope }),
    ]),
  ],
};

const environment = {
  id: 'junkshop-local-env',
  name: 'JunkShop Local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:4000/api/v1', type: 'default', enabled: true },
    { key: 'accessToken', value: '', type: 'secret', enabled: true },
    { key: 'refreshToken', value: '', type: 'secret', enabled: true },
    { key: 'entityId', value: '1', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

writeFileSync('postman/JunkShop-API.postman_collection.json', JSON.stringify(collection, null, 2));
writeFileSync('postman/JunkShop-Local.postman_environment.json', JSON.stringify(environment, null, 2));
console.log('Generated postman/JunkShop-API.postman_collection.json');
console.log('Generated postman/JunkShop-Local.postman_environment.json');
