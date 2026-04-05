import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

const bearerSecurity = [{ bearerAuth: [] as string[] }];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'POS API',
    version: '1.0.0',
    description:
      'REST API for POS, repairs, inventory, payments, cash register, transfers, returns, and reporting.',
  },
  servers: [
    { url: 'http://localhost:5000/api/v1', description: 'Local development' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Inventory' },
    { name: 'Sales' },
    { name: 'Repairs' },
    { name: 'Payments' },
    { name: 'Cash' },
    { name: 'Transfers' },
    { name: 'Returns' },
    { name: 'Reports' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Logged in' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Token refreshed' },
          '401': { description: 'Refresh token invalid or expired' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        security: bearerSecurity,
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        security: bearerSecurity,
        responses: { '200': { description: 'Current user' } },
      },
    },
    '/auth/users': {
      get: {
        tags: ['Auth'],
        summary: 'List users',
        security: bearerSecurity,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Users list' } },
      },
      post: {
        tags: ['Auth'],
        summary: 'Create user',
        security: bearerSecurity,
        responses: { '201': { description: 'User created' } },
      },
    },
    '/auth/users/{id}': {
      put: {
        tags: ['Auth'],
        summary: 'Update user',
        security: bearerSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'User updated' } },
      },
    },
    '/auth/roles': {
      get: {
        tags: ['Auth'],
        summary: 'List roles',
        security: bearerSecurity,
        responses: { '200': { description: 'Roles list' } },
      },
      post: {
        tags: ['Auth'],
        summary: 'Create role',
        security: bearerSecurity,
        responses: { '201': { description: 'Role created' } },
      },
    },
    '/auth/roles/{id}/permissions': {
      put: {
        tags: ['Auth'],
        summary: 'Assign role permissions',
        security: bearerSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Role permissions updated' } },
      },
    },
    '/auth/permissions': {
      get: {
        tags: ['Auth'],
        summary: 'List permissions',
        security: bearerSecurity,
        responses: { '200': { description: 'Permissions list' } },
      },
    },

    '/inventory/items': {
      get: {
        tags: ['Inventory'],
        summary: 'List items',
        security: bearerSecurity,
        responses: { '200': { description: 'Items list' } },
      },
      post: {
        tags: ['Inventory'],
        summary: 'Create item',
        security: bearerSecurity,
        responses: { '201': { description: 'Item created' } },
      },
    },
    '/inventory/items/{id}': {
      get: {
        tags: ['Inventory'],
        summary: 'Get item',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Item detail' } },
      },
      patch: {
        tags: ['Inventory'],
        summary: 'Update item',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Item updated' } },
      },
      delete: {
        tags: ['Inventory'],
        summary: 'Deactivate item',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Item deactivated' } },
      },
    },
    '/inventory/categories': {
      get: { tags: ['Inventory'], summary: 'List categories', security: bearerSecurity, responses: { '200': { description: 'Categories list' } } },
      post: { tags: ['Inventory'], summary: 'Create category', security: bearerSecurity, responses: { '201': { description: 'Category created' } } },
    },
    '/inventory/brands': {
      get: { tags: ['Inventory'], summary: 'List brands', security: bearerSecurity, responses: { '200': { description: 'Brands list' } } },
      post: { tags: ['Inventory'], summary: 'Create brand', security: bearerSecurity, responses: { '201': { description: 'Brand created' } } },
    },
    '/inventory/warehouses': {
      get: { tags: ['Inventory'], summary: 'List warehouses', security: bearerSecurity, responses: { '200': { description: 'Warehouses list' } } },
      post: { tags: ['Inventory'], summary: 'Create warehouse', security: bearerSecurity, responses: { '201': { description: 'Warehouse created' } } },
    },
    '/inventory/warehouses/{id}/stock': {
      get: {
        tags: ['Inventory'],
        summary: 'Get warehouse stock',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Warehouse stock' } },
      },
    },
    '/inventory/outlets': {
      get: { tags: ['Inventory'], summary: 'List outlets', security: bearerSecurity, responses: { '200': { description: 'Outlets list' } } },
      post: { tags: ['Inventory'], summary: 'Create outlet', security: bearerSecurity, responses: { '201': { description: 'Outlet created' } } },
    },
    '/inventory/outlets/{id}/stock': {
      get: {
        tags: ['Inventory'],
        summary: 'Get outlet stock',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Outlet stock' } },
      },
    },
    '/inventory/purchases': { post: { tags: ['Inventory'], summary: 'Record purchase stock', security: bearerSecurity, responses: { '201': { description: 'Purchase recorded' } } } },
    '/inventory/transfers': { post: { tags: ['Inventory'], summary: 'Transfer stock between locations', security: bearerSecurity, responses: { '200': { description: 'Stock transferred' } } } },
    '/inventory/adjustments': { post: { tags: ['Inventory'], summary: 'Adjust stock', security: bearerSecurity, responses: { '200': { description: 'Stock adjusted' } } } },
    '/inventory/min-stock': { patch: { tags: ['Inventory'], summary: 'Set minimum stock', security: bearerSecurity, responses: { '200': { description: 'Min stock updated' } } } },
    '/inventory/movements': { get: { tags: ['Inventory'], summary: 'List stock movements', security: bearerSecurity, responses: { '200': { description: 'Movements list' } } } },

    '/sales/checkout': {
      post: { tags: ['Sales'], summary: 'Checkout sale', security: bearerSecurity, responses: { '201': { description: 'Sale completed' } } },
    },
    '/sales': {
      get: { tags: ['Sales'], summary: 'List sales', security: bearerSecurity, responses: { '200': { description: 'Sales list' } } },
    },
    '/sales/{id}': {
      get: {
        tags: ['Sales'],
        summary: 'Get sale by ID',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Sale detail' } },
      },
    },
    '/sales/receipt/{receiptNo}': {
      get: {
        tags: ['Sales'],
        summary: 'Get sale by receipt number',
        security: bearerSecurity,
        parameters: [{ name: 'receiptNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Sale detail' } },
      },
    },
    '/sales/{id}/void': {
      post: {
        tags: ['Sales'],
        summary: 'Void sale',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Sale voided' } },
      },
    },
    '/sales/customers': {
      get: { tags: ['Sales'], summary: 'List customers', security: bearerSecurity, responses: { '200': { description: 'Customers list' } } },
      post: { tags: ['Sales'], summary: 'Create customer', security: bearerSecurity, responses: { '201': { description: 'Customer created' } } },
    },

    '/repairs': {
      get: { tags: ['Repairs'], summary: 'List repair jobs', security: bearerSecurity, responses: { '200': { description: 'Repair jobs list' } } },
      post: { tags: ['Repairs'], summary: 'Create repair job', security: bearerSecurity, responses: { '201': { description: 'Repair job created' } } },
    },
    '/repairs/{id}': {
      get: {
        tags: ['Repairs'],
        summary: 'Get repair job',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Repair detail' } },
      },
      patch: {
        tags: ['Repairs'],
        summary: 'Update repair job',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Repair updated' } },
      },
    },
    '/repairs/job/{jobNo}': {
      get: {
        tags: ['Repairs'],
        summary: 'Get repair by job number',
        security: bearerSecurity,
        parameters: [{ name: 'jobNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Repair detail' } },
      },
    },
    '/repairs/{id}/status': {
      post: {
        tags: ['Repairs'],
        summary: 'Update repair status',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Status updated' } },
      },
    },
    '/repairs/{id}/parts': {
      post: {
        tags: ['Repairs'],
        summary: 'Add repair part',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '201': { description: 'Part added' } },
      },
    },
    '/repairs/{id}/parts/{partId}': {
      delete: {
        tags: ['Repairs'],
        summary: 'Remove repair part',
        security: bearerSecurity,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'partId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Part removed' } },
      },
    },
    '/repairs/{id}/advances': {
      post: {
        tags: ['Repairs'],
        summary: 'Add repair advance payment',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '201': { description: 'Advance payment added' } },
      },
    },
    '/repairs/{id}/balance': {
      get: {
        tags: ['Repairs'],
        summary: 'Get repair balance summary',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Repair balance' } },
      },
    },

    '/payments': {
      get: { tags: ['Payments'], summary: 'List payment transactions', security: bearerSecurity, responses: { '200': { description: 'Payments list' } } },
    },
    '/payments/{id}': {
      get: {
        tags: ['Payments'],
        summary: 'Get payment transaction by ID',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Payment detail' } },
      },
    },
    '/payments/sales': {
      post: { tags: ['Payments'], summary: 'Record sale payment', security: bearerSecurity, responses: { '201': { description: 'Sale payment recorded' } } },
    },
    '/payments/sales/{saleId}/summary': {
      get: {
        tags: ['Payments'],
        summary: 'Get sale payment summary',
        security: bearerSecurity,
        parameters: [{ name: 'saleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Sale payment summary' } },
      },
    },
    '/payments/repairs/{repairId}': {
      post: {
        tags: ['Payments'],
        summary: 'Record repair payment',
        security: bearerSecurity,
        parameters: [{ name: 'repairId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '201': { description: 'Repair payment recorded' } },
      },
    },
    '/payments/repairs/{repairId}/settle': {
      post: {
        tags: ['Payments'],
        summary: 'Settle repair and mark delivered',
        security: bearerSecurity,
        parameters: [{ name: 'repairId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '201': { description: 'Repair settled' } },
      },
    },
    '/payments/repairs/{repairId}/summary': {
      get: {
        tags: ['Payments'],
        summary: 'Get repair payment summary',
        security: bearerSecurity,
        parameters: [{ name: 'repairId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Repair payment summary' } },
      },
    },

    '/cash': {
      post: { tags: ['Cash'], summary: 'Open register', security: bearerSecurity, responses: { '201': { description: 'Register opened' } } },
      get: { tags: ['Cash'], summary: 'List registers', security: bearerSecurity, responses: { '200': { description: 'Registers list' } } },
    },
    '/cash/me': {
      get: { tags: ['Cash'], summary: 'Get my open register', security: bearerSecurity, responses: { '200': { description: 'Current open register' } } },
    },
    '/cash/{id}': {
      get: {
        tags: ['Cash'],
        summary: 'Get register by ID',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Register detail' } },
      },
    },
    '/cash/{id}/balance': {
      get: {
        tags: ['Cash'],
        summary: 'Get register balance',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Register balance' } },
      },
    },
    '/cash/{id}/movements': {
      get: {
        tags: ['Cash'],
        summary: 'List register movements',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Cash movements list' } },
      },
    },
    '/cash/{id}/cash-in': {
      post: {
        tags: ['Cash'],
        summary: 'Record cash in',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '201': { description: 'Cash in recorded' } },
      },
    },
    '/cash/{id}/cash-out': {
      post: {
        tags: ['Cash'],
        summary: 'Record cash out',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '201': { description: 'Cash out recorded' } },
      },
    },
    '/cash/{id}/close': {
      post: {
        tags: ['Cash'],
        summary: 'Close register',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Register closed' } },
      },
    },

    '/transfers': {
      get: { tags: ['Transfers'], summary: 'List stock transfers', security: bearerSecurity, responses: { '200': { description: 'Transfers list' } } },
      post: { tags: ['Transfers'], summary: 'Create stock transfer', security: bearerSecurity, responses: { '201': { description: 'Transfer created' } } },
    },
    '/transfers/no/{transferNo}': {
      get: {
        tags: ['Transfers'],
        summary: 'Get transfer by transfer number',
        security: bearerSecurity,
        parameters: [{ name: 'transferNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Transfer detail' } },
      },
    },
    '/transfers/{id}': {
      get: {
        tags: ['Transfers'],
        summary: 'Get transfer by ID',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Transfer detail' } },
      },
    },
    '/transfers/{id}/dispatch': {
      post: {
        tags: ['Transfers'],
        summary: 'Dispatch transfer',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Transfer dispatched' } },
      },
    },
    '/transfers/{id}/receive': {
      post: {
        tags: ['Transfers'],
        summary: 'Receive transfer',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Transfer received' } },
      },
    },
    '/transfers/{id}/cancel': {
      post: {
        tags: ['Transfers'],
        summary: 'Cancel transfer',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Transfer cancelled' } },
      },
    },

    '/returns': {
      get: { tags: ['Returns'], summary: 'List returns', security: bearerSecurity, responses: { '200': { description: 'Returns list' } } },
      post: { tags: ['Returns'], summary: 'Create return', security: bearerSecurity, responses: { '201': { description: 'Return created' } } },
    },
    '/returns/no/{returnNo}': {
      get: {
        tags: ['Returns'],
        summary: 'Get return by return number',
        security: bearerSecurity,
        parameters: [{ name: 'returnNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Return detail' } },
      },
    },
    '/returns/{id}': {
      get: {
        tags: ['Returns'],
        summary: 'Get return by ID',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Return detail' } },
      },
    },
    '/returns/{id}/approve': {
      post: {
        tags: ['Returns'],
        summary: 'Approve return',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Return approved' } },
      },
    },
    '/returns/{id}/reject': {
      post: {
        tags: ['Returns'],
        summary: 'Reject return',
        security: bearerSecurity,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Return rejected' } },
      },
    },

    '/reports/sales/summary': { get: { tags: ['Reports'], summary: 'Sales summary', security: bearerSecurity, responses: { '200': { description: 'Sales summary report' } } } },
    '/reports/sales/by-period': { get: { tags: ['Reports'], summary: 'Sales by period', security: bearerSecurity, responses: { '200': { description: 'Sales by period report' } } } },
    '/reports/sales/top-items': { get: { tags: ['Reports'], summary: 'Top selling items', security: bearerSecurity, responses: { '200': { description: 'Top items report' } } } },
    '/reports/repairs/summary': { get: { tags: ['Reports'], summary: 'Repair summary', security: bearerSecurity, responses: { '200': { description: 'Repair summary report' } } } },
    '/reports/repairs/turnaround': { get: { tags: ['Reports'], summary: 'Repair turnaround', security: bearerSecurity, responses: { '200': { description: 'Repair turnaround report' } } } },
    '/reports/inventory/snapshot': { get: { tags: ['Reports'], summary: 'Inventory snapshot', security: bearerSecurity, responses: { '200': { description: 'Inventory snapshot report' } } } },
    '/reports/inventory/movements': { get: { tags: ['Reports'], summary: 'Inventory movements', security: bearerSecurity, responses: { '200': { description: 'Inventory movement report' } } } },
    '/reports/cash/summary': { get: { tags: ['Reports'], summary: 'Cash summary', security: bearerSecurity, responses: { '200': { description: 'Cash summary report' } } } },
    '/reports/cash/variance': { get: { tags: ['Reports'], summary: 'Cash variance', security: bearerSecurity, responses: { '200': { description: 'Cash variance report' } } } },
  },
};

export const registerSwagger = (app: Express) => {
  app.get('/api/v1/docs.json', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  app.use(
    '/api/v1/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      explorer: true,
      customSiteTitle: 'POS API Docs',
    }),
  );
};
