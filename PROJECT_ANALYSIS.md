# POS_V4 Project — Comprehensive Architecture & Analysis

**Project Type:** Full-Stack POS (Point of Sale) System  
**Purpose:** Mobile Phone Accessories & Repair Shop Management System  
**Date:** April 24, 2026  
**Stack:** Express.js (Backend), Next.js (Frontend), Prisma ORM, MariaDB

---

## EXECUTIVE SUMMARY

POS_V4 is a comprehensive business management system for mobile phone accessory retailers and repair shops. It features:
- **Multi-outlet/warehouse** inventory management
- **POS checkout** with payment processing (cash + card)
- **Device repair** job management with real-time status tracking
- **RBAC** (Role-Based Access Control) with granular permissions
- **Stock transfers** between locations
- **Sales returns** and returns management
- **Cash register** reconciliation with audit trails
- **Comprehensive reporting** across all business areas
- **Real-time updates** using Socket.io for repair job status

---

## BACKEND ARCHITECTURE

### Technology Stack
- **Framework:** Express.js 5.2.1
- **ORM:** Prisma 7.6.0 (with MariaDB adapter)
- **Database:** MySQL 5.7+ / MariaDB 3.5.2
- **Real-time:** Socket.io 4.8.1
- **Authentication:** JWT (access + refresh tokens)
- **Security:** Helmet, CORS, bcryptjs (password hashing)
- **Validation:** Zod schemas
- **Logging:** Morgan
- **Serialport:** Serial port support for hardware integrations (barcode scanners, etc.)

### Server Architecture
**File:** [backend/src/server.ts](backend/src/server.ts)

The Express server is configured with:
- **Security middleware:** Helmet, CORS with origin validation, compression
- **Request parsing:** JSON + URL-encoded (10MB limit)
- **Health endpoint:** `/health` — tests DB connectivity
- **API v1 routes:** Mounted on `/api/v1/*` with proper authentication & authorization

### Core Modules

#### 1. **AUTH Module** — `backend/src/modules/auth/`
**Files:**
- [auth.routes.ts](backend/src/modules/auth/auth.routes.ts)
- [auth.controller.ts](backend/src/modules/auth/auth.controller.ts)
- [auth.service.ts](backend/src/modules/auth/auth.service.ts)
- [auth.repository.ts](backend/src/modules/auth/auth.repository.ts)
- [auth.schema.ts](backend/src/modules/auth/auth.schema.ts)

**Endpoints:**
- `POST /api/v1/auth/login` — User login (returns access + refresh tokens)
- `POST /api/v1/auth/refresh` — Refresh access token
- `POST /api/v1/auth/logout` — Logout
- `GET /api/v1/auth/me` — Get current user profile
- `GET /api/v1/auth/users` — List users (paginated, searchable)
- `POST /api/v1/auth/users` — Create user with role
- `PATCH /api/v1/auth/users/:id` — Update user
- `POST /api/v1/auth/users/:id/change-password` — Change password
- `GET /api/v1/auth/roles` — List roles
- `POST /api/v1/auth/roles` — Create role
- `PATCH /api/v1/auth/roles/:id/permissions` — Assign permissions to role

**Key Features:**
- JWT-based authentication with short-lived access tokens (15 min) and long-lived refresh tokens (30 days)
- Refresh token storage in DB for explicit revocation
- Role-based access control (RBAC) with granular permissions
- Password hashing with bcryptjs (12 rounds)

---

#### 2. **INVENTORY Module** — `backend/src/modules/inventory/`
**Files:** inventory.routes.ts, controller, service, repository, schema

**Endpoints:**
- Items management (CRUD, deactivate, batch search)
- Categories (with hierarchical support for subcategories)
- Brands (CRUD)
- Warehouses (CRUD, stock levels, stock movements)
- Outlets (CRUD, stock levels, stock movements)
- Stock operations:
  - `POST /items/:id/purchase` — Purchase stock (warehouse receipt)
  - `POST /transfer` — Transfer stock between locations
  - `POST /adjust` — Manual stock adjustment
  - `POST /items/:id/min-stock` — Set minimum stock level

**Key Entities:**
- **Item:** SKU, name, cost/selling price, discount price, item type (ACCESSORY/SPARE_PART/TOOL), unit type
- **Warehouse:** Central storage (single per system or multiple)
- **Outlet:** Point-of-sale location with its own stock
- **Category:** Hierarchical (parent-child relationships)
- **Brand:** Product brands

**Stock Tracking:**
- **WarehouseStock & OutletStock:** Track quantities per location with min/max levels
- **StockMovement:** Immutable audit trail of all stock changes
  - Movement types: PURCHASE, TRANSFER, SALE, RETURN, ADJUSTMENT
  - Tracks from/to location (polymorphic WAREHOUSE/OUTLET)
  - Records created by user

---

#### 3. **SALES Module (POS)** — `backend/src/modules/sales/`
**Files:** sales.routes.ts, controller, service, repository, schema

**Endpoints:**
- `POST /api/v1/sales/checkout` — POS checkout (create sale + process payment)
- `GET /api/v1/sales` — List sales (paginated, filterable)
- `GET /api/v1/sales/:id` — Get sale detail with items & payments
- `GET /api/v1/sales/receipt/:receiptNo` — Look up by receipt number
- `POST /api/v1/sales/:id/void` — Void a completed sale
- Customer management:
  - `GET /api/v1/sales/customers` — List customers
  - `POST /api/v1/sales/customers` — Create new customer

**Key Features:**
- **Atomic checkout transaction:** All stock checks, deductions, sale creation, payment recording in single DB transaction
- **Receipt numbering:** `RCP-YYYYMMDD-XXXXXX` (auto-generated, unique)
- **Line-item pricing:** Per-item cost locked at sale time (protects audit trail if catalog prices change)
- **Multi-payment support:** Single sale can accept multiple payment methods (cash + card split)
- **Void tracking:** Voided sales preserve audit trail with void timestamp, reason, and operator
- **Outlet enforcement:** Cashier's register must match sale outlet
- **Customer linking:** Optional customer record for loyalty/history

**Sale Status:** COMPLETED | VOIDED

---

#### 4. **REPAIR Module** — `backend/src/modules/repair/`
**Files:** repair.routes.ts, controller, service, repository, schema

**Endpoints:**
- `POST /api/v1/repairs` — Create repair job
- `GET /api/v1/repairs` — List repair jobs (paginated, filterable by status/technician)
- `GET /api/v1/repairs/:id` — Get repair detail
- `PATCH /api/v1/repairs/:id` — Update repair metadata
- `POST /api/v1/repairs/:id/status` — Change job status (with audit trail)
- Parts management:
  - `POST /api/v1/repairs/:id/parts` — Add part to repair
  - `DELETE /api/v1/repairs/:id/parts/:partId` — Remove part
  - `PATCH /api/v1/repairs/:id/parts/:partId/discount` — Apply part discount
  - `PATCH /api/v1/repairs/:id/parts/:partId/quantity` — Update quantity
  - `PATCH /api/v1/repairs/:id/parts/:partId/used` — Mark part as used/unused
- `POST /api/v1/repairs/:id/advances` — Record advance payment
- `GET /api/v1/repairs/:id/balance` — Get balance summary

**Key Features:**
- **Job lifecycle:** PENDING → IN_PROGRESS → DONE → DELIVERED (or CANCELLED)
- **Technician assignment:** Can be assigned later (initially null)
- **Device tracking:** Brand, model, serial number, color, physical condition
- **Problem/diagnosis:** Problem description, diagnosis notes, internal technician notes
- **Parts management:** 
  - Add spare parts consumed during repair
  - Parts deducted from outlet stock automatically
  - Support for marking parts as unused (e.g., if decision changes)
  - Per-part discount capability
- **Financial tracking:**
  - Labor cost (fixed)
  - Advance payments (tracked separately, deducted from final bill)
  - Parts cost (sum of part costs)
  - Total cost (computed as labor + parts - discounts)
- **Status audit trail:** RepairStatusLog records every status change with timestamp & operator
- **Real-time updates:** Socket.io notifications on job creation and changes
- **Repair job numbering:** `REP-YYYYMMDD-XXXXXX`

**Repair Status:** PENDING | IN_PROGRESS | DONE | DELIVERED | CANCELLED

---

#### 5. **PAYMENT Module** — `backend/src/modules/payment/`
**Endpoints:**
- Payment processing for sales and repairs
- Unified payment ledger with support for mixed payment methods

**Key Features:**
- **PaymentTransaction:** Header record for a payment event (checkout, advance, settlement)
  - Tracks total amount and change
  - Links to either a Sale OR RepairJob
- **PaymentLeg:** Individual payment method within a transaction
  - Enables Cash + Card splits (e.g., $50 cash + $30 card for a $80 purchase)
  - Tracks change (for cash only)
  - Tracks card terminal reference
- **Payment Methods:** CASH | CARD
- **Entity Types:** SALE | REPAIR
- **Transaction numbering:** `PAY-YYYYMMDD-XXXXXX`

---

#### 6. **CASH Module** — `backend/src/modules/cash/`
**Endpoints:**
- `POST /api/v1/cash` — Open cash register
- `GET /api/v1/cash/me` — Get my open register
- `GET /api/v1/cash` — List all registers (paginated)
- `GET /api/v1/cash/:id` — Get register detail
- `GET /api/v1/cash/:id/balance` — Get running cash balance
- `GET /api/v1/cash/:id/movements` — List movements (paginated)
- `POST /api/v1/cash/:id/cash-in` — Manual cash addition
- `POST /api/v1/cash/:id/cash-out` — Manual cash removal
- `POST /api/v1/cash/:id/close` — Close register with reconciliation

**Key Features:**
- **Register sessions:** One OPEN session per user at a time
- **Opening balance:** Initial float recorded at opening
- **Cash movements:** Immutable audit trail
  - Types: SALE_CASH, REPAIR_CASH, CASH_IN, CASH_OUT, OPENING_FLOAT
  - Each linked to operator & timestamp
- **Closing reconciliation:**
  - Expected cash (computed from opening + movements)
  - Actual cash (physically counted by cashier)
  - Difference calculated (highlights shortages/overages)
  - Closing note for discrepancies
- **Register status:** OPEN | CLOSED

---

#### 7. **TRANSFER Module** — `backend/src/modules/transfer/`
**Endpoints:**
- `POST /api/v1/transfers` — Request stock transfer
- `GET /api/v1/transfers` — List transfers (paginated)
- `GET /api/v1/transfers/:id` — Get transfer detail
- `POST /api/v1/transfers/:id/dispatch` — Confirm dispatch (deduct from source)
- `POST /api/v1/transfers/:id/receive` — Confirm receipt (add to destination)
- `POST /api/v1/transfers/:id/cancel` — Cancel transfer (before dispatch)

**Key Features:**
- **Polymorphic locations:** Support outlet-to-outlet, warehouse-to-outlet, warehouse-to-warehouse transfers
- **Three-step workflow:** PENDING → DISPATCHED → RECEIVED
- **Stock deduction:** Only happens on DISPATCH (prevents double-counting)
- **Quantity verification:** Can receive partial quantities (receivedQty vs. requested quantity)
- **User tracking:** requestedBy, dispatchedBy, receivedBy with timestamps
- **Transfer numbering:** `TRF-YYYYMMDD-XXXXXX`
- **Transfer status:** PENDING | DISPATCHED | RECEIVED | CANCELLED

---

#### 8. **RETURNS Module** — `backend/src/modules/returns/`
**Endpoints:**
- `POST /api/v1/returns` — Create return request
- `GET /api/v1/returns` — List returns (paginated)
- `GET /api/v1/returns/:id` — Get return detail
- `POST /api/v1/returns/:id/approve` — Approve return (restore stock, issue refund)
- `POST /api/v1/returns/:id/reject` — Reject return
- Return stock operations (supplier returns, restock tracking)

**Key Features:**
- **Return lifecycle:** PENDING → APPROVED or REJECTED
- **Return reasons:** DEFECTIVE, WRONG_ITEM, CUSTOMER_CHANGE_MIND, DAMAGED_IN_TRANSIT, OTHER
- **Per-item returns:** Only specific items from a sale can be returned
- **Stock restoration:** On approval, stock is restored to outlet
- **Refund amount:** Computed from returned item prices
- **User tracking:** createdBy, processedBy with timestamps
- **Return numbering:** `RET-YYYYMMDD-XXXXXX`
- **Return status:** PENDING | APPROVED | REJECTED

---

#### 9. **REPORTS Module** — `backend/src/modules/reports/`
**Endpoints:**
- **Sales reports:**
  - `GET /api/v1/reports/sales/summary` — Total revenue, avg order, discounts, by payment method
  - `GET /api/v1/reports/sales/by-period` — Revenue/orders grouped by day/week/month
  - `GET /api/v1/reports/sales/top-items` — Top-selling items by quantity and revenue
- **Repair reports:**
  - `GET /api/v1/reports/repairs/summary` — Jobs by status, total revenue, parts cost
  - `GET /api/v1/reports/repairs/turnaround` — Technician efficiency (avg hours per job)
- **Inventory reports:**
  - `GET /api/v1/reports/inventory/snapshot` — Current stock levels by location, low stock alerts
  - `GET /api/v1/reports/inventory/movements` — Stock movement history (paginated)
- **Cash reports:**
  - `GET /api/v1/reports/cash/summary` — Register count, total opening/expected/actual/difference
  - `GET /api/v1/reports/cash/variance` — Reconciliation detail per register

**Key Features:**
- **Date filtering:** From/to date ranges
- **Location filtering:** By outlet, warehouse, or technician
- **Period grouping:** Day, week, or month
- **Stock valuation:** Cost and selling price analysis
- **Low stock alerts:** Items below minimum quantity

---

#### 10. **CASH-DRAWER Module** — `backend/src/modules/cash-drawer/`
Likely for hardware integration with cash drawer peripherals (serial port controlled).

---

### Shared Infrastructure

#### Middleware
**Location:** [backend/src/shared/middleware/](backend/src/shared/middleware/)

1. **authenticate.ts** — Validates Bearer JWT, attaches decoded payload to `req.user`
2. **authorize.ts** — RBAC factory middleware; checks if user has required permission(s)
3. **errorHandler.ts** — Global error handler for:
   - Zod validation errors (422 UNPROCESSABLE_ENTITY)
   - AppError operational errors
   - Prisma errors (unique violations, foreign key errors, etc.)
4. **validateRequest.ts** — Request validation (body, params, query) using Zod schemas

#### Types
**Location:** [backend/src/shared/types/index.ts](backend/src/shared/types/)
- `AuthenticatedRequest` — Request with attached user
- `JwtPayload` — Decoded JWT structure

#### Utils
**Location:** [backend/src/shared/utils/](backend/src/shared/utils/)
- `pagination.ts` — Pagination helpers (offset, limit calculation)
- `response.ts` — Response formatting helpers (sendSuccess, sendCreated, sendPaginated)

#### Real-time
**Location:** [backend/src/shared/realtime/repairRealtime.ts](backend/src/shared/realtime/repairRealtime.ts)
- Socket.io server initialization
- Namespaced events for repair job notifications:
  - `repair:job-created` — New job created
  - `repair:job-changed` — Job updated (status, parts, payments)
- Scoped to specific outlets for real-time dashboards

#### Database Configuration
**Location:** [backend/src/config/](backend/src/config/)
- **database.ts** — Prisma client singleton
- **env.ts** — Environment variable validation & defaults

---

## DATABASE SCHEMA

**File:** [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

### Data Model Overview

#### 1. Auth & RBAC
```
User (id, email, fullName, phone, isActive, passwordHash, roleId)
  ↓
Role (id, name, description)
  ↓ (many-to-many)
Permission (id, name, module, action, description)
  ↓
RolePermission (roleId, permissionId)

RefreshToken (id, token, userId, expiresAt, revokedAt)
```

**Features:**
- Granular RBAC with permission format: `module:action` (e.g., "sales:create", "inventory:read")
- Explicit token revocation support
- User soft-deactivation (isActive flag)

---

#### 2. Locations
```
Outlet (id, name, address, phone, isActive)
  ↓
OutletStock (id, outletId, itemId, quantity, minQuantity)

Warehouse (id, name, address, isActive)
  ↓
WarehouseStock (id, warehouseId, itemId, quantity, minQuantity)
```

---

#### 3. Inventory
```
Category (id, name, parentId, description)  [hierarchical]
Brand (id, name, description)
Item (id, sku, name, description, type, unit, costPrice, sellingPrice, discountPrice, isActive, categoryId, brandId)

ItemType: ACCESSORY | SPARE_PART | TOOL
UnitType: PIECE | BOX | SET | PAIR

StockMovement (id, movementType, quantity, itemId, fromType, fromId, toType, toId, createdBy, createdAt)
  MovementType: PURCHASE | TRANSFER | SALE | RETURN | ADJUSTMENT
  LocationType: WAREHOUSE | OUTLET
```

**Features:**
- Unique SKU per item
- Multiple price tiers (cost, selling, discount)
- Audit trail of all stock changes
- Polymorphic location references (flexible from/to)

---

#### 4. Sales (POS)
```
Customer (id, name, phone, email)

Sale (id, receiptNo, status, subtotal, discountAmt, total, outletId, cashierId, customerId, voidedById, voidedAt, voidReason)
  SaleStatus: COMPLETED | VOIDED
  PaymentMethod: CASH | CARD

SaleItem (id, saleId, itemId, quantity, unitPrice, discount, subtotal)

PaymentTransaction (id, txNo, entityType, totalAmount, totalChange, saleId, repairJobId, createdBy, createdAt)
  PaymentLeg (id, transactionId, method, amount, change, reference)
    method: CASH | CARD
```

**Features:**
- Line-item pricing locked at sale time
- Per-item discount support
- Multiple payment methods per sale (mixed payments)
- Audit trail of all voided sales
- Optional customer linking

---

#### 5. Repairs
```
RepairJob (id, jobNo, status, deviceBrand, deviceModel, deviceColor, serialNo, 
           condition, problemDesc, diagnosis, internalNote,
           laborCost, advancePaid, totalCost, estimatedDone, completedAt, deliveredAt,
           outletId, customerId, technicianId, createdById)
  RepairStatus: PENDING | IN_PROGRESS | DONE | DELIVERED | CANCELLED

RepairPart (id, repairId, itemId, quantity, unitCost, subtotal, discount, used)

RepairStatusLog (id, repairId, fromStatus, toStatus, note, changedById, createdAt)
```

**Features:**
- Full device intake tracking
- Parts consumption with cost tracking
- Technician assignment (flexible timing)
- Advance payment support
- Status change audit trail
- Auto-computation of total cost

---

#### 6. Cash Management
```
CashRegister (id, status, openingBalance, expectedCash, actualCash, difference, 
              closingNote, openedAt, closedAt, outletId, openedById, closedById)
  RegisterStatus: OPEN | CLOSED

CashMovement (id, registerId, type, amount, note, referenceId, createdById, createdAt)
  CashMovementType: SALE_CASH | REPAIR_CASH | CASH_IN | CASH_OUT | OPENING_FLOAT
```

**Features:**
- Register reconciliation with expected vs. actual
- Manual float adjustments
- Audit trail of all movements

---

#### 7. Stock Transfers
```
StockTransfer (id, transferNo, status, fromType, fromId, toType, toId,
               dispatchedAt, receivedAt, requestedById, dispatchedById, receivedById)
  TransferStatus: PENDING | DISPATCHED | RECEIVED | CANCELLED
  LocationType: WAREHOUSE | OUTLET

StockTransferItem (id, transferId, itemId, quantity, receivedQty)
```

**Features:**
- Polymorphic location support
- Partial receipt capability (receivedQty vs. requested)
- Operator tracking per state

---

#### 8. Sales Returns
```
SaleReturn (id, returnNo, status, reason, note, refundAmount, 
            saleId, outletId, createdById, processedById, processedAt)
  ReturnStatus: PENDING | APPROVED | REJECTED
  ReturnReason: DEFECTIVE | WRONG_ITEM | CUSTOMER_CHANGE_MIND | DAMAGED_IN_TRANSIT | OTHER

SaleReturnItem (id, returnId, saleItemId, itemId, quantity, unitPrice, subtotal)
```

**Features:**
- Per-item return tracking
- Reason categorization
- Stock restoration on approval
- Refund computation

---

### Database Migrations

**Location:** [backend/prisma/migrations/](backend/prisma/migrations/)

Recent migrations (in chronological order):
1. `20260329120243_auth_users_rbac/` — Initial auth & RBAC setup
2. `20260329122505_inventory_items_stock/` — Inventory & stock models
3. `20260329123415_sales_pos/` — POS sales module
4. `20260329123934_repair_jobs/` — Repair job tracking
5. `20260329124952_payment_module/` — Unified payment ledger
6. `20260329125818_cash_registry/` — Cash register sessions
7. `20260329131047_transfers_returns/` — Stock transfers & returns
8. `20260329171744_add_performance_indexes/` — Optimized indexing
9. `20260405000000_item_discount_pct/` — Discount percentage field
10. `20260405010000_item_discount_price/` — Discount price field
11. `20260413205951_add/` — Additional fields/constraints
12. `20260413210746_add/` — More enhancements
13. `20260413211157_change/` — Schema adjustments
14. `20260424090000_customer_soft_delete/` — Customer soft-delete support (pending/not yet migrated)

---

## FRONTEND ARCHITECTURE

### Technology Stack
- **Framework:** Next.js 16.2.1 with App Router
- **UI:** React 19.2.4, Tailwind CSS 4
- **Styling:** PostCSS 4
- **Real-time:** Socket.io-client 4.8.1
- **Barcoding:** jsbarcode 3.12.3, qrcode.react 4.2.0
- **Type Safety:** TypeScript 5

### Project Structure

**Root:** [frontend/](frontend/)

#### App Directory
**Location:** [frontend/src/app/](frontend/src/app/)

```
app/
  layout.tsx           — Main layout with AuthProvider
  page.tsx             — Landing page
  globals.css          — Global styles
  (auth)/              — Auth pages (outside dashboard)
    login/page.tsx     — Login form
  (dashboard)/         — Protected routes
    layout.tsx         — Dashboard layout
    dashboard/
      page.tsx         — Dashboard home
      admin/           — Admin panel (users, roles, outlets, warehouses)
      cash/            — Cash register management
      customers/       — Customer management
      inventory/       — Inventory management
      repairs/         — Repair job management
      reports/         — Analytics & reporting
      returns/         — Sales returns management
      sales/           — Sales history
      sales-history/   — Detailed sales history
      transfers/       — Stock transfers
```

#### Components Directory
**Location:** [frontend/src/components/](frontend/src/components/)

**Structure:**
```
components/
  admin/               — Admin management screens
  cash/                — Cash register components
  customers/           — Customer screens
  inventory/           — Inventory management screens
  overview/            — Dashboard overview widgets
  pos/                 — POS checkout interface
    pos-screen.tsx
    payment-modal.tsx
    receipt-modal.tsx
    camera-barcode-scanner-modal.tsx
    sales-history-screen.tsx
  repair/              — Repair management screens
    repair-screen.tsx
    repair-receipt-modal.tsx
  reports/             — Reporting & analytics
  returns/             — Sales return management
  sales/               — Sales management
  transfer/            — Stock transfer management
```

#### Library Directory
**Location:** [frontend/src/lib/](frontend/src/lib/)

1. **api.ts** — API client & type definitions
   - RESTful fetch wrapper with JWT auth
   - Automatic token refresh on 401
   - Session management (localStorage)
   - Comprehensive TypeScript types for all endpoints
   - Paginated data fetching
   - Query string builder

2. **auth-context.tsx** — Authentication context provider
   - User state management
   - Login/logout functions
   - Permission checking helpers
   - Session persistence
   - Session expiration handling

3. **realtime.ts** — Socket.io client wrapper
   - Repair job real-time subscriptions
   - Repair status change notifications
   - Part additions/removals
   - Payment updates

4. **use-barcode-scanner.ts** — Barcode scanner hook
   - Keyboard input capture
   - Debounce & timing logic

---

### Key Frontend Features

#### 1. Authentication Flow
- Client-side login via `api.login()`
- JWT stored in localStorage
- AuthProvider wraps app for permission checks
- Automatic logout on session expiration
- `hasPermission()` and `hasAnyPermission()` helpers for RBAC

#### 2. POS Checkout Screen
**Component:** [frontend/src/components/pos/pos-screen.tsx](frontend/src/components/pos/pos-screen.tsx)

**Features:**
- Item search & barcode scanning
- Line-item quantity & discount entry
- Customer lookup or creation
- Multi-payment method support
- Receipt modal with barcode/QR code
- Print receipt capability

**Workflow:**
1. Search for items (by SKU, name, or barcode)
2. Add items to cart with quantities
3. Apply per-item or total discounts
4. Select/create customer (optional)
5. Payment modal (cash + card split support)
6. Receipt generation with barcodes

#### 3. Repair Management Screen
**Component:** [frontend/src/components/repair/repair-screen.tsx](frontend/src/components/repair/repair-screen.tsx)

**Features:**
- Create new repair job
- Real-time job status updates
- Parts management (add, remove, discount)
- Technician assignment
- Advance payment handling
- Status transitions
- Job receipt generation

**Real-time:**
- Subscribe to job changes via Socket.io
- Update UI on part additions/removals
- Status change notifications

#### 4. Inventory Management
**Component:** [frontend/src/components/inventory/inventory-screen.tsx](frontend/src/components/inventory/inventory-screen.tsx)

**Features:**
- Item CRUD
- Category hierarchy
- Brand management
- Stock levels by location
- Purchase orders
- Stock transfers
- Adjustments & corrections

#### 5. Cash Register
**Component:** [frontend/src/components/cash/...](frontend/src/components/cash/)

**Features:**
- Open register (with opening balance)
- Track cash movements (sales, manual in/out)
- Close register with reconciliation
- View movement history

#### 6. Sales Returns
**Component:** [frontend/src/components/returns/...](frontend/src/components/returns/)

**Features:**
- Create return from original sale
- Select items to return
- Reason categorization
- Manager approval workflow
- Refund computation

#### 7. Reports & Analytics
**Component:** [frontend/src/components/reports/...](frontend/src/components/reports/)

**Reports:**
- Sales summary (total revenue, avg order, discounts, by payment method)
- Sales by period (daily/weekly/monthly trends)
- Top-selling items
- Repair summary (by status, revenue, parts cost)
- Technician efficiency (turnaround time)
- Inventory snapshot (low stock alerts, valuation)
- Stock movements history
- Cash variance (register reconciliation detail)

---

### API Client Types

**File:** [frontend/src/lib/api.ts](frontend/src/lib/api.ts)

Key exported types:
- `AuthSession` — Access + refresh tokens + user
- `AuthUser` — User profile with permissions
- `UserRecord` — User data with role
- `OutletRecord` — Outlet location data
- `WarehouseRecord` — Warehouse data
- `ItemRecord` — Inventory item
- `CustomerRecord` — Customer data
- `SaleReceipt` — Sale detail with items, payments, customer
- `RepairJobSummary` & `RepairJobDetail` — Repair job data
- `ReturnSummary` & `ReturnDetail` — Sales return data
- `TransferRecord` — Stock transfer data
- Report types for all analytics endpoints

---

## DATABASE SCHEMA DETAILED RELATIONSHIPS

### Primary Entity Relationships

```
User (RBAC) ←→ Role ←→ Permission
  ↓
  ├→ Sales (as cashier)
  ├→ Repair Jobs (as technician / creator)
  ├→ Stock Movements (as creator)
  ├→ Cash Movements (as creator)
  ├→ Transfers (as requester/dispatcher/receiver)
  └→ Returns (as creator/processor)

Customer
  ├→ Sales (optional)
  └→ Repair Jobs

Outlet ←→ OutletStock ←→ Item
  ├→ Sales
  ├→ Repair Jobs
  ├→ Cash Registers
  ├→ Stock Transfers (source/destination)
  └→ Sale Returns

Warehouse ←→ WarehouseStock ←→ Item
  └→ Stock Transfers (source/destination)

Item ←→ Category / Brand
  ├→ Stock Movements
  ├→ Sale Items (within Sales)
  ├→ Repair Parts (consumed in Repairs)
  ├→ Stock Transfers (items transferred)
  └→ Sale Return Items

Sale
  ├→ Sale Items (line items)
  ├→ Payment Transactions
  └→ Sale Returns

Repair Job
  ├→ Repair Parts (consumed parts)
  ├→ Repair Status Logs (audit trail)
  ├→ Payment Transactions
  └→ Payment Legs

PaymentTransaction
  ├→ Payment Legs (payment methods)
  └→ Entity (either Sale OR Repair Job)

CashRegister
  ├→ Cash Movements
  └→ Outlet

Stock Transfer
  ├→ Stock Transfer Items
  └→ from/to Locations (polymorphic)
```

---

## RECENT CHANGES & NEW FEATURES

### April 24, 2026 (Latest)
**Migration:** `20260424090000_customer_soft_delete`
- Customer soft-delete support (likely adds `isActive` or `deletedAt` field)
- Allows marking customers inactive without losing history
- Pending migration status

### April 13, 2026
**Migrations:**
- `20260413205951_add/` — Additional fields/constraints
- `20260413210746_add/` — Further enhancements
- `20260413211157_change/` — Schema adjustments

### April 5, 2026
**Item Pricing Enhancements:**
- `20260405000000_item_discount_pct/` — Discount percentage field added
- `20260405010000_item_discount_price/` — Discount price field added
- Allows both percentage and fixed-price discounts on items

### March 29, 2026 (Initial Build)
Complete database schema initialization with all core modules.

---

## KEY WORKFLOWS

### 1. POS Checkout Workflow

```
START: Customer brings items to register
  ↓
Cashier scans/adds items (barcode or manual search)
  ↓
System checks stock availability at outlet
  ↓
Cashier enters item quantities & applies discounts (per-item or total)
  ↓
[Optional] Link existing customer or create new one
  ↓
Cashier clicks Checkout
  ↓
[System Validation]
  - Verify cashier has open register at this outlet
  - Verify outlet is active
  - Verify all items in stock
  ↓
[Atomic Transaction]
  - Calculate totals (subtotal - discount = total)
  - Create Sale record
  - Create SaleItem records (with locked prices)
  - Deduct stock from outlet
  - Create StockMovement records (type: SALE)
  ↓
Payment Modal
  - Enter payment methods (cash, card)
  - Calculate change (for cash)
  ↓
[Payment Processing]
  - Create PaymentTransaction
  - Create PaymentLeg(s) for each method
  - Record CashMovement in register (for cash portions)
  ↓
Generate Receipt
  - Print barcode/QR code
  - Show itemized list, totals, payment details
  ↓
Sale marked COMPLETED
END
```

**Key Constraints:**
- Cashier must have open register at checkout outlet
- Stock must be available
- All operations in single transaction for consistency

---

### 2. Repair Job Workflow

```
START: Customer brings device
  ↓
Staff creates repair job
  - Enter device details (brand, model, serial, condition)
  - Problem description
  - Optional: Record advance payment
  ↓
[Job Status: PENDING]
  - Technician may be assigned now or later
  - Repair awaiting technician pickup
  ↓
Technician takes job
  - Status changed to IN_PROGRESS
  - Technician officially assigned
  - Diagnosis entered
  ↓
Parts added as needed
  - Each part deducted from outlet stock
  - Part cost tracked (unit cost locked at time of use)
  - Parts can be marked unused later (e.g., decision changes)
  ↓
[Job Status: DONE]
  - Work completed
  - Final cost calculated (labor + parts - discounts)
  - Additional payment may be collected
  ↓
[Job Status: DELIVERED]
  - Customer picked up device
  - All payments settled
  ↓
[Optional] Job canceled at any point with reason
  - Advance payment can be refunded
  - Parts restored to stock
END
```

**Real-time Updates:**
- Frontend subscribed to job via Socket.io
- Technicians see new jobs, part updates, status changes in real-time

---

### 3. Customer Lifecycle

```
START: New customer at register
  ↓
Cashier creates customer record
  - Name (required)
  - Phone (required, unique)
  - Email (optional)
  ↓
Customer linked to Sale or Repair Job
  ↓
[History Tracking]
  - All sales associated with customer
  - All repair jobs associated with customer
  ↓
[Future Lookup]
  - Search customer by name or phone
  - View customer history
  ↓
[Soft Delete - Planned]
  - Mark customer inactive (isActive = false)
  - Preserves all history
  - Customer no longer shown in active lists
  - Historical data still queryable
END
```

---

### 4. Inventory Management Workflow

```
Stock Purchase (Supplier → Warehouse)
  → CREATE Purchase: Item, Qty, Cost → Warehouse Stock increased
  → StockMovement created (PURCHASE, from: null, to: WAREHOUSE)

Stock Transfer (Warehouse ↔ Outlet or Outlet ↔ Outlet)
  → CREATE Transfer: from Loc, to Loc, Items[]
  → Transfer Status: PENDING
  ↓
  → Dispatch: Deduct from source, Status: DISPATCHED
  → StockMovement created (TRANSFER, from: source, to: target)
  ↓
  → Receive: Add to destination, Status: RECEIVED (can receive partial qty)
  → StockMovement created for destination

Stock Adjustment (Manual)
  → Staff counts inventory
  → Identify variance
  → CREATE Adjustment: Item, Qty, Reason
  → Location stock updated
  → StockMovement created (ADJUSTMENT)

Stock Deduction (Sale / Repair)
  → Automatic during sale checkout or repair part addition
  → StockMovement created (SALE or implicitly tracked in part usage)
```

---

### 5. Sales Returns Workflow

```
START: Customer returns items from previous sale
  ↓
Staff creates return request
  - Link to original sale
  - Select specific items to return
  - Enter return reason (DEFECTIVE, WRONG_ITEM, etc.)
  ↓
[Return Status: PENDING]
  - Awaiting manager/supervisor approval
  ↓
Manager reviews return
  ↓
Option A: APPROVED
  - Stock restored to outlet
  - Refund amount calculated (from original sale prices)
  - PaymentTransaction created (if refund issued)
  - StockMovement created (RETURN type)
  ↓
Option B: REJECTED
  - Return denied
  - Stock not restored
  - Customer informed
  ↓
END
```

---

### 6. Cash Register Reconciliation Workflow

```
START of Shift: Cashier opens register
  → Record opening balance (initial float)
  → CashRegister status: OPEN
  → CashMovement: OPENING_FLOAT

During Shift: Transactions occur
  → Sale with cash payment: CashMovement SALE_CASH (auto-recorded)
  → Repair with cash payment: CashMovement REPAIR_CASH (auto-recorded)
  → Float top-up: CashMovement CASH_IN (manual)
  → Bank deposit: CashMovement CASH_OUT (manual)

END of Shift: Cashier closes register
  → Physically count cash in drawer
  → System calculates expected cash:
     = opening balance
       + all SALE_CASH movements
       + all REPAIR_CASH movements
       + all CASH_IN movements
       - all CASH_OUT movements
  ↓
  → Enter actual cash counted
  → System calculates difference: actual - expected
  ↓
  → CashRegister status: CLOSED
  → Reconciliation recorded with timestamp & notes
  ↓
  → Shortage/Overage tracked in reports
END
```

---

## ARCHITECTURAL PATTERNS & BEST PRACTICES

### 1. Module Structure (Backend)

Each business module follows the **clean architecture** pattern:

```
module/
  ├── module.routes.ts      — Express Router with endpoints & middleware
  ├── module.controller.ts   — HTTP layer (request parsing, response formatting)
  ├── module.service.ts      — Business logic layer (validation, workflows, transactions)
  ├── module.repository.ts   — Data access layer (Prisma queries)
  ├── module.schema.ts       — Zod validation schemas & TypeScript types
```

**Separation of concerns:**
- Controllers = HTTP I/O
- Services = Business rules & transactions
- Repositories = Database access (abstracts Prisma)
- Schemas = Validation & types

### 2. Error Handling

**Custom AppError class:**
```typescript
throw new AppError("User not found", StatusCodes.NOT_FOUND);
throw new AppError("Insufficient permissions", StatusCodes.FORBIDDEN);
```

**Global error middleware:**
- Catches all errors (Zod, AppError, Prisma, etc.)
- Converts to standardized JSON response
- Proper HTTP status codes

### 3. RBAC (Role-Based Access Control)

**Permission format:** `module:action`
- Examples: "sales:create", "inventory:read", "repairs:update"

**Middleware pattern:**
```typescript
router.post(
  '/checkout',
  authenticate,              // Verify JWT
  authorize('sales:create'), // Check permission
  validateRequest(...),      // Validate input
  ctrl.checkout              // Handler
);
```

### 4. Transactions for Data Consistency

Critical operations (checkout, repair status change, transfer dispatch) use Prisma `$transaction`:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // All queries run in single transaction
  // Automatic rollback on any error
  // Prevents partial updates
});
```

### 5. Prisma Best Practices

- **Indexed fields:** createdAt, status, foreign keys for fast queries
- **Unique constraints:** SKU, email, phone, receipt numbers
- **Cascade deletes:** FK constraints with onDelete: Cascade
- **Polymorphic references:** LocationType enum + manual resolution (flexible)
- **Enum usage:** Status, movement types, payment methods (type-safe)

### 6. Frontend Component Patterns

**Client-side routing:**
- Next.js App Router with (group) syntax for layouts
- Protected routes via AuthProvider wrapper
- Permission-based rendering: `hasPermission()` checks

**Real-time updates:**
- Socket.io subscriptions for repair jobs
- Automatic UI refresh on server notifications

**API integration:**
- Centralized `api` object with all endpoints
- TypeScript types for all responses
- Automatic JWT refresh on 401
- Error handling with user-friendly messages

---

## TECHNOLOGY DECISIONS

### Backend: Express.js + Prisma
**Rationale:**
- Lightweight, flexible routing
- Prisma provides type-safe ORM with auto-generated client
- MariaDB for reliability & ACID compliance in financial transactions

### Frontend: Next.js + React
**Rationale:**
- Server-side rendering for SEO
- File-based routing reduces boilerplate
- Built-in API optimization
- React ecosystem maturity

### Real-time: Socket.io
**Rationale:**
- Repair technicians need live job status updates
- Standardized protocol with fallbacks
- Scoped events for multi-outlet support

### Authentication: JWT
**Rationale:**
- Stateless (scales across instances)
- Self-contained (permissions in token)
- Refresh token strategy for security

---

## PERFORMANCE OPTIMIZATIONS

### Database
- **Indexed columns:** Foreign keys, status, createdAt, frequently filtered fields
- **Unique constraints:** Prevent duplicates, enable fast lookups
- **Pagination:** All list endpoints support pagination to limit response size

### Frontend
- **Lazy loading:** Components loaded as needed
- **Real-time subscriptions:** Only subscribe to relevant data (by outlet/technician)
- **Caching:** API responses cached in component state

### Server
- **Compression:** gzip enabled for responses
- **Request size limit:** 10MB cap prevents abuse
- **CORS whitelist:** Only trusted origins

---

## TODO & PLANNED FEATURES

**From TODO file:**
1. Customer soft-delete feature (in progress, migration ready)
2. Item price change tracking
3. Sales search improvements
4. Cloud architecture setup
5. Theme arrangement (table headers static, unified theme)

---

## SECURITY MEASURES

1. **Authentication:** JWT with expiration
2. **Authorization:** Permission-based access control
3. **Password security:** bcryptjs with 12-round hashing
4. **CORS:** Origin whitelist validation
5. **Helmet:** Security headers (CSP, HSTS, etc.)
6. **Input validation:** Zod schemas on all endpoints
7. **Transaction safety:** All financial operations in atomic transactions
8. **Audit trails:** All changes tracked with user & timestamp
9. **Token revocation:** Refresh tokens stored in DB, can be revoked

---

## DEPLOYMENT ARCHITECTURE

**File:** [docker-compose.yml](docker-compose.yml)

The project includes Docker support:
- Backend service
- Frontend service (Next.js)
- MariaDB database

All services can be containerized for cloud deployment.

---

## SUMMARY TABLE

| Aspect | Details |
|--------|---------|
| **Backend** | Express 5.2.1, Prisma 7.6.0, MariaDB |
| **Frontend** | Next.js 16.2.1, React 19.2.4, Tailwind CSS 4 |
| **Real-time** | Socket.io 4.8.1 |
| **Authentication** | JWT + Refresh Tokens |
| **RBAC** | Permission-based (module:action format) |
| **Modules** | Auth, Inventory, Sales, Repair, Payment, Cash, Transfer, Returns, Reports, Cash-Drawer |
| **Database Models** | 30+ models covering all business operations |
| **API Routes** | 100+ endpoints across all modules |
| **Frontend Screens** | 10+ major screens (POS, Repairs, Inventory, etc.) |
| **Audit Trail** | Complete operation history with user & timestamp |
| **Multi-location** | Support for multiple outlets and warehouses |
| **Reports** | Sales, repair, inventory, and cash analytics |

---

## KEY FILES REFERENCE

**Backend:**
- [backend/src/server.ts](backend/src/server.ts) — Server setup
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) — Database schema
- [backend/src/modules/sales/sales.service.ts](backend/src/modules/sales/sales.service.ts) — Checkout logic
- [backend/src/modules/repair/repair.service.ts](backend/src/modules/repair/repair.service.ts) — Repair job logic
- [backend/src/shared/middleware/](backend/src/shared/middleware/) — Auth, error handling, validation

**Frontend:**
- [frontend/src/lib/api.ts](frontend/src/lib/api.ts) — API client
- [frontend/src/lib/auth-context.tsx](frontend/src/lib/auth-context.tsx) — Authentication provider
- [frontend/src/components/pos/pos-screen.tsx](frontend/src/components/pos/pos-screen.tsx) — Checkout UI
- [frontend/src/components/repair/repair-screen.tsx](frontend/src/components/repair/repair-screen.tsx) — Repair UI

---

**This analysis was generated on April 24, 2026. Last migrations tracked up to customer soft-delete feature.**

