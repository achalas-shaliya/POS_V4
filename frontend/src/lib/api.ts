const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1";

const SESSION_KEY = "pos.session";

// Called when a 401 cannot be recovered (refresh token also expired/missing).
// Registered by AuthProvider so that the API layer can trigger a logout + redirect.
let _onSessionExpired: (() => void) | null = null;
export const setSessionExpiredCallback = (cb: () => void) => {
  _onSessionExpired = cb;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  permissions: string[];
  isActive?: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type Permission = {
  id: string;
  name: string;
  module: string;
  action: string;
  description?: string | null;
};

export type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Array<{
    permissionId?: string;
    permission: Permission;
  }>;
};

export type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  isActive?: boolean;
  role?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
};

export type OutletRecord = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export type WarehouseRecord = {
  id: string;
  name: string;
  address?: string | null;
};

export type CategoryRecord = {
  id: string;
  name: string;
  description?: string | null;
};

export type BrandRecord = {
  id: string;
  name: string;
  description?: string | null;
};

export type ItemRecord = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  type?: "ACCESSORY" | "SPARE_PART" | "TOOL";
  unit?: "PIECE" | "BOX" | "SET" | "PAIR";
  sellingPrice?: number | string;
  costPrice?: number | string;
  discountPrice?: number | string;
  isActive?: boolean;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
};

export type StockRow = {
  id: string;
  quantity: number;
  minQuantity: number;
  itemId?: string;
  item: ItemRecord;
  warehouse?: WarehouseRecord;
  outlet?: OutletRecord;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
};

export type SaleReceipt = {
  id: string;
  receiptNo: string;
  createdAt: string;
  status: string;
  note?: string | null;
  subtotal: number | string;
  discountAmt: number | string;
  total: number | string;
  outlet: { id: string; name: string };
  cashier: { id: string; fullName: string };
  customer?: { id: string; name: string; phone: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number | string;
    discount: number | string;
    subtotal: number | string;
    item: { id: string; sku: string; name: string };
  }>;
  payments: Array<{
    id: string;
    txNo: string;
    totalAmount: number | string;
    totalChange: number | string;
    legs: Array<{
      method: string;
      amount: number | string;
      change: number | string;
      reference?: string | null;
    }>;
  }>;
};

export type RepairJobSummary = {
  id: string;
  jobNo: string;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "DELIVERED" | "CANCELLED";
  laborCost: number | string;
  totalCost?: number | string;
  createdAt: string;
  outlet?: { id: string; name: string };
  customer?: { id: string; name: string; phone?: string | null };
  technician?: { id: string; fullName: string } | null;
  _count?: { parts: number; payments: number };
};

export type RepairJobDetail = RepairJobSummary & {
  deviceBrand: string;
  deviceModel: string;
  deviceColor?: string | null;
  serialNo?: string | null;
  condition?: string | null;
  problemDesc: string;
  diagnosis?: string | null;
  internalNote?: string | null;
  advancePaid?: number | string | null;
  parts: Array<{
    id: string;
    itemId: string;
    quantity: number;
    unitCost: number | string;
    subtotal: number | string;
    item: { id: string; sku: string; name: string };
  }>;
};

export type ReturnReason =
  | "DEFECTIVE"
  | "WRONG_ITEM"
  | "CUSTOMER_CHANGE_MIND"
  | "DAMAGED_IN_TRANSIT"
  | "OTHER";

export type ReturnStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReturnSummary = {
  id: string;
  returnNo: string;
  status: ReturnStatus;
  reason: ReturnReason;
  refundAmount: number | string;
  createdAt: string;
  processedAt: string | null;
  outlet: { id: string; name: string };
  sale: { id: string; receiptNo: string };
  createdBy: { id: string; fullName: string };
  processedBy: { id: string; fullName: string } | null;
  _count: { items: number };
};

export type ReturnDetail = {
  id: string;
  returnNo: string;
  status: ReturnStatus;
  reason: ReturnReason;
  note: string | null;
  refundAmount: number | string;
  createdAt: string;
  processedAt: string | null;
  outlet: { id: string; name: string };
  sale: { id: string; receiptNo: string; total: number | string };
  createdBy: { id: string; fullName: string };
  processedBy: { id: string; fullName: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number | string;
    subtotal: number | string;
    itemId: string;
    saleItemId: string;
    item: { id: string; sku: string; name: string };
    saleItem: { id: string; quantity: number; unitPrice: number | string };
  }>;
};

export type TransferRecord = {
  id: string;
  transferNo: string;
  fromType: "OUTLET" | "WAREHOUSE";
  fromId: string;
  toType: "OUTLET" | "WAREHOUSE";
  toId: string;
  status: "PENDING" | "DISPATCHED" | "RECEIVED" | "CANCELLED";
  note?: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    itemId: string;
    quantity: number;
    receivedQty?: number | null;
    item?: { id: string; sku: string; name: string };
  }>;
};

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

export type SalesSummary = {
  totalSales: number;
  totalRevenue: number;
  totalDiscounts: number;
  avgOrderValue: number;
  voidedSales: number;
  byPaymentMethod: Array<{ method: string; total: number; txCount: number }>;
};

export type SalesPeriodRow = {
  period: string;
  revenue: number;
  orderCount: number;
  avgOrder: number;
  discount: number;
};

export type TopItemRow = {
  itemId: string;
  sku: string;
  name: string;
  totalQty: number;
  totalRevenue: number;
  orderCount: number;
};

export type RepairSummary = {
  byStatus: Array<{ status: string; count: number }>;
  totalRevenue: number;
  totalPartsCost: number;
};

export type RepairTurnaroundRow = {
  technicianId: string | null;
  technicianName: string | null;
  jobCount: number;
  avgHours: number | null;
};

export type InventorySnapshotItem = {
  location: { type: string; id: string; name: string };
  itemId: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  isLowStock: boolean;
  costPrice: number;
  sellingPrice: number;
  stockValue: number;
};

export type InventorySnapshotTotals = {
  outlets: { totalItems: number; totalStockValue: number; lowStockCount: number };
  warehouses: { totalItems: number; totalStockValue: number; lowStockCount: number };
};

export type InventoryMovementRow = {
  id: string;
  movementType: string;
  quantity: number;
  createdAt: string;
  item: { id: string; sku: string; name: string };
  createdByUser?: { id: string; fullName: string } | null;
};

export type CashSummary = {
  registerCount: number;
  totalOpening: number;
  totalExpected: number;
  totalActual: number;
  totalDifference: number;
  byMovementType: Array<{ type: string; total: number; count: number }>;
};

export type CashVarianceRow = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  closingNote: string | null;
  outlet: { id: string; name: string } | null;
  openedBy: { id: string; fullName: string } | null;
  closedBy: { id: string; fullName: string } | null;
};

export type CashMovement = {
  id: string;
  type: "OPENING_FLOAT" | "SALE_CASH" | "REPAIR_CASH" | "CASH_IN" | "CASH_OUT";
  amount: number | string;
  note?: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string } | null;
};

export type CashRegister = {
  id: string;
  status: "OPEN" | "CLOSED";
  openingBalance: number | string;
  expectedCash?: number | string | null;
  actualCash?: number | string | null;
  difference?: number | string | null;
  openedAt: string;
  closedAt?: string | null;
  closingNote?: string | null;
  outlet?: { id: string; name: string } | null;
  openedBy?: { id: string; fullName: string } | null;
  closedBy?: { id: string; fullName: string } | null;
  movements?: CashMovement[];
  _count?: { movements: number };
};

const isBrowser = () => typeof window !== "undefined";

export const getSession = (): AuthSession | null => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const setSession = (session: AuthSession) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
};

const buildQuery = (params?: Record<string, string | number | boolean | undefined>) => {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const refreshAccessToken = async (): Promise<string | null> => {
  const session = getSession();
  if (!session?.refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const json = (await response.json()) as ApiEnvelope<{
    accessToken: string;
    refreshToken: string;
  }>;

  const nextSession: AuthSession = {
    ...session,
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
  };
  setSession(nextSession);
  return nextSession.accessToken;
};

const request = async <T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
  retry = true,
): Promise<T> => {
  const session = getSession();
  const headers = new Headers(init.headers ?? {});

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (init.auth !== false && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && init.auth !== false && retry) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      return request<T>(path, init, false);
    }
    // Refresh also failed — session is fully expired.
    _onSessionExpired?.();
    throw new Error("Session expired. Please sign in again.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as ApiEnvelope<T> & {
    errors?: Array<{ field: string; message: string }>;
  };
  if (!response.ok || !json.success) {
    const fieldErrors =
      Array.isArray(json.errors) && json.errors.length > 0
        ? " — " + json.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join("; ")
        : "";
    throw new Error((json.message || "Request failed") + fieldErrors);
  }

  return json.data;
};

const requestPaginated = async <T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<{ data: T[]; meta?: ApiEnvelope<T[]>["meta"] }> => {
  const query = buildQuery(params);
  const session = getSession();
  const headers = new Headers();

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}${query}`, { headers });
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      return requestPaginated<T>(path, params);
    }
    // Refresh also failed — session is fully expired.
    _onSessionExpired?.();
    throw new Error("Session expired. Please sign in again.");
  }

  const json = (await response.json()) as ApiEnvelope<T[]>;
  if (!response.ok || !json.success) {
    throw new Error(json.message || "Request failed");
  }

  return { data: json.data, meta: json.meta };
};

export const api = {
  baseUrl: API_BASE_URL,

  async login(email: string, password: string) {
    const data = await request<AuthSession>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    setSession(data);
    return data;
  },

  async logout() {
    try {
      await request<void>("/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  },

  getSession,
  clearSession,

  getMe: () => request<AuthUser>("/auth/me"),

  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    requestPaginated<UserRecord>("/auth/users", { page: 1, limit: 100, ...params }),

  createUser: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    roleId: string;
  }) => request<UserRecord>("/auth/users", { method: "POST", body: JSON.stringify(payload) }),

  updateUser: (
    id: string,
    payload: {
      email?: string;
      fullName?: string;
      phone?: string;
      roleId?: string;
      isActive?: boolean;
    },
  ) => request<UserRecord>(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  listRoles: () => request<Role[]>("/auth/roles"),
  listPermissions: () => request<Permission[]>("/auth/permissions"),
  createRole: (payload: { name: string; description?: string; permissionIds?: string[] }) =>
    request<Role>("/auth/roles", { method: "POST", body: JSON.stringify(payload) }),
  assignRolePermissions: (id: string, permissionIds: string[]) =>
    request<Role>(`/auth/roles/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissionIds }),
    }),

  listOutlets: () => request<OutletRecord[]>("/inventory/outlets"),
  createOutlet: (payload: { name: string; address?: string; phone?: string }) =>
    request<OutletRecord>("/inventory/outlets", { method: "POST", body: JSON.stringify(payload) }),

  listWarehouses: () => request<WarehouseRecord[]>("/inventory/warehouses"),
  listCategories: () => request<CategoryRecord[]>("/inventory/categories"),
  listBrands: () => request<BrandRecord[]>("/inventory/brands"),
  createCategory: (payload: { name: string; description?: string; parentId?: string }) =>
    request<CategoryRecord>("/inventory/categories", { method: "POST", body: JSON.stringify(payload) }),
  createBrand: (payload: { name: string; description?: string }) =>
    request<BrandRecord>("/inventory/brands", { method: "POST", body: JSON.stringify(payload) }),
  createItem: (payload: {
    sku: string;
    name: string;
    description?: string;
    type?: "ACCESSORY" | "SPARE_PART" | "TOOL";
    unit?: "PIECE" | "BOX" | "SET" | "PAIR";
    costPrice: number;
    sellingPrice: number;
    discountPrice?: number;
    categoryId: string;
    brandId?: string;
  }) => request<ItemRecord>("/inventory/items", { method: "POST", body: JSON.stringify(payload) }),
  updateItem: (id: string, payload: {
    sku?: string;
    name?: string;
    description?: string;
    type?: "ACCESSORY" | "SPARE_PART" | "TOOL";
    unit?: "PIECE" | "BOX" | "SET" | "PAIR";
    costPrice?: number;
    sellingPrice?: number;
    discountPrice?: number;
    categoryId?: string;
    brandId?: string;
  }) => request<ItemRecord>(`/inventory/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getWarehouseStock: (id: string, params?: { page?: number; limit?: number; search?: string; lowStockOnly?: boolean }) =>
    requestPaginated<StockRow>(`/inventory/warehouses/${id}/stock`, { page: 1, limit: 100, ...params }),
  getOutletStock: (id: string, params?: { page?: number; limit?: number; search?: string; lowStockOnly?: boolean }) =>
    requestPaginated<StockRow>(`/inventory/outlets/${id}/stock`, { page: 1, limit: 100, ...params }),

  purchaseStock: (payload: { warehouseId: string; itemId: string; quantity: number; note?: string }) =>
    request<void>("/inventory/purchases", { method: "POST", body: JSON.stringify(payload) }),
  adjustStock: (payload: { locationType: "WAREHOUSE" | "OUTLET"; locationId: string; itemId: string; newQuantity: number; note?: string }) =>
    request<void>("/inventory/adjustments", { method: "POST", body: JSON.stringify(payload) }),
  transferStock: (payload: { fromType: "WAREHOUSE" | "OUTLET"; fromId: string; toType: "WAREHOUSE" | "OUTLET"; toId: string; itemId: string; quantity: number; note?: string }) =>
    request<void>("/inventory/transfers", { method: "POST", body: JSON.stringify(payload) }),
  setMinStock: (payload: { locationType: "WAREHOUSE" | "OUTLET"; locationId: string; itemId: string; minQuantity: number }) =>
    request<void>("/inventory/min-stock", { method: "PATCH", body: JSON.stringify(payload) }),
  listItems: (params?: { page?: number; limit?: number; search?: string; type?: string; isActive?: boolean }) =>
    requestPaginated<ItemRecord>("/inventory/items", { page: 1, limit: 100, ...params }),

  listCustomers: (params?: { page?: number; limit?: number; search?: string }) =>
    requestPaginated<CustomerRecord>("/sales/customers", { page: 1, limit: 100, ...params }),
  createCustomer: (payload: { name: string; phone: string; email?: string }) =>
    request<CustomerRecord>("/sales/customers", { method: "POST", body: JSON.stringify(payload) }),
  checkoutSale: (payload: {
    outletId: string;
    customerId?: string;
    note?: string;
    discountAmt?: number;
    items: { itemId: string; quantity: number; unitPrice?: number; discount?: number }[];
    payments: { method: "CASH" | "CARD"; amount: number; reference?: string }[];
  }) => request<SaleReceipt>("/sales/checkout", { method: "POST", body: JSON.stringify(payload) }),
  openCashDrawer: () => request<{ success: boolean; message: string }>("/cash-drawer/open", { method: "POST" }),

  // ---------------------------------------------------------------------------
  // Sales — receipt lookup (used by Returns)
  // ---------------------------------------------------------------------------
  getSaleByReceiptNo: (receiptNo: string) =>
    request<SaleReceipt>(`/sales/receipt/${encodeURIComponent(receiptNo)}`),
  listSales: (params?: { page?: number; limit?: number; outletId?: string; status?: "COMPLETED" | "VOIDED"; fromDate?: string; toDate?: string }) =>
    requestPaginated<SaleReceipt>("/sales", { page: 1, limit: 50, ...params }),
  getSaleById: (id: string) =>
    request<SaleReceipt>(`/sales/${id}`),
  voidSale: (id: string, payload: { reason: string }) =>
    request<SaleReceipt>(`/sales/${id}/void`, { method: "POST", body: JSON.stringify(payload) }),

  // ---------------------------------------------------------------------------
  // Returns / Refunds / Warranty Claims
  // ---------------------------------------------------------------------------
  listReturns: (params?: { page?: number; limit?: number; status?: ReturnStatus; outletId?: string; saleId?: string }) =>
    requestPaginated<ReturnSummary>("/returns", { page: 1, limit: 50, ...params }),
  getReturnById: (id: string) =>
    request<ReturnDetail>(`/returns/${id}`),
  createReturn: (payload: {
    saleId: string;
    outletId: string;
    reason: ReturnReason;
    note?: string;
    items: { saleItemId: string; quantity: number }[];
  }) => request<ReturnDetail>("/returns", { method: "POST", body: JSON.stringify(payload) }),
  approveReturn: (id: string, payload?: { note?: string }) =>
    request<ReturnDetail>(`/returns/${id}/approve`, { method: "POST", body: JSON.stringify(payload ?? {}) }),
  rejectReturn: (id: string, payload?: { note?: string }) =>
    request<ReturnDetail>(`/returns/${id}/reject`, { method: "POST", body: JSON.stringify(payload ?? {}) }),

  listRepairJobs: (params?: {
    page?: number;
    limit?: number;
    outletId?: string;
    customerId?: string;
    technicianId?: string;
    status?: string;
  }) => requestPaginated<RepairJobSummary>("/repairs", { page: 1, limit: 100, ...params }),
  getRepairJob: (id: string) => request<RepairJobDetail>(`/repairs/${id}`),
  createRepairJob: (payload: {
    outletId: string;
    customerId: string;
    technicianId?: string;
    deviceBrand: string;
    deviceModel: string;
    serialNo?: string;
    problemDesc: string;
    laborCost?: number;
    internalNote?: string;
  }) => request<RepairJobDetail>("/repairs", { method: "POST", body: JSON.stringify(payload) }),
  updateRepairStatus: (id: string, payload: { status: string; note?: string }) =>
    request<RepairJobDetail>(`/repairs/${id}/status`, { method: "POST", body: JSON.stringify(payload) }),
  addRepairPart: (id: string, payload: { itemId: string; quantity: number; unitCost?: number }) =>
    request(`/repairs/${id}/parts`, { method: "POST", body: JSON.stringify(payload) }),
  addRepairAdvance: (id: string, payload: { amount: number; method: "CASH" | "CARD"; reference?: string; note?: string }) =>
    request(`/repairs/${id}/advances`, { method: "POST", body: JSON.stringify(payload) }),

  listTransfers: (params?: { page?: number; limit?: number; status?: string; fromId?: string; toId?: string }) =>
    requestPaginated<TransferRecord>("/transfers", { page: 1, limit: 100, ...params }),
  createTransfer: (payload: {
    fromType: "OUTLET" | "WAREHOUSE";
    fromId: string;
    toType: "OUTLET" | "WAREHOUSE";
    toId: string;
    items: { itemId: string; quantity: number }[];
    note?: string;
  }) => request<TransferRecord>("/transfers", { method: "POST", body: JSON.stringify(payload) }),
  dispatchTransfer: (id: string, payload?: { note?: string }) =>
    request<TransferRecord>(`/transfers/${id}/dispatch`, { method: "POST", body: JSON.stringify(payload ?? {}) }),
  receiveTransfer: (id: string, payload: { items: { transferItemId: string; receivedQty: number }[]; note?: string }) =>
    request<TransferRecord>(`/transfers/${id}/receive`, { method: "POST", body: JSON.stringify(payload) }),
  cancelTransfer: (id: string, payload?: { note?: string }) =>
    request<TransferRecord>(`/transfers/${id}/cancel`, { method: "POST", body: JSON.stringify(payload ?? {}) }),
  getTransferById: (id: string) =>
    request<TransferRecord>(`/transfers/${id}`),

  // ---------------------------------------------------------------------------
  // Cash Registry
  // ---------------------------------------------------------------------------

  openRegister: (payload: { outletId: string; openingBalance: number; note?: string }) =>
    request<CashRegister>("/cash", { method: "POST", body: JSON.stringify(payload) }),
  getMyOpenRegister: () =>
    request<CashRegister>("/cash/me"),
  getRegisterById: (id: string) =>
    request<CashRegister>(`/cash/${id}`),
  getRegisterBalance: (id: string) =>
    request<{ registerId: string; status: string; openingBalance: number; expectedCash: number }>(`/cash/${id}/balance`),
  listRegisters: (params?: { page?: number; limit?: number; status?: "OPEN" | "CLOSED"; outletId?: string }) =>
    requestPaginated<CashRegister>("/cash", { page: 1, limit: 50, ...params }),
  listMovements: (registerId: string, params?: { page?: number; limit?: number }) =>
    requestPaginated<CashMovement>(`/cash/${registerId}/movements`, { page: 1, limit: 100, ...params }),
  cashIn: (registerId: string, payload: { amount: number; note?: string }) =>
    request<CashMovement>(`/cash/${registerId}/cash-in`, { method: "POST", body: JSON.stringify(payload) }),
  cashOut: (registerId: string, payload: { amount: number; note?: string }) =>
    request<CashMovement>(`/cash/${registerId}/cash-out`, { method: "POST", body: JSON.stringify(payload) }),
  closeRegister: (registerId: string, payload: { actualCash: number; closingNote?: string }) =>
    request<CashRegister>(`/cash/${registerId}/close`, { method: "POST", body: JSON.stringify(payload) }),

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------

  getSalesSummary: (params?: { fromDate?: string; toDate?: string; outletId?: string }) =>
    request<SalesSummary>(`/reports/sales/summary${buildQuery(params)}`),

  getSalesByPeriod: (params?: {
    fromDate?: string;
    toDate?: string;
    outletId?: string;
    groupBy?: "day" | "week" | "month";
  }) => request<SalesPeriodRow[]>(`/reports/sales/by-period${buildQuery(params)}`),

  getTopItems: (params?: { fromDate?: string; toDate?: string; outletId?: string; limit?: number }) =>
    request<TopItemRow[]>(`/reports/sales/top-items${buildQuery(params)}`),

  getRepairSummary: (params?: {
    fromDate?: string;
    toDate?: string;
    outletId?: string;
    technicianId?: string;
  }) => request<RepairSummary>(`/reports/repairs/summary${buildQuery(params)}`),

  getRepairTurnaround: (params?: {
    fromDate?: string;
    toDate?: string;
    outletId?: string;
    technicianId?: string;
  }) => request<RepairTurnaroundRow[]>(`/reports/repairs/turnaround${buildQuery(params)}`),

  getInventorySnapshot: (params?: {
    outletId?: string;
    warehouseId?: string;
    lowStockOnly?: boolean;
  }) =>
    request<InventorySnapshotItem[] | InventorySnapshotTotals>(
      `/reports/inventory/snapshot${buildQuery(params)}`,
    ),

  getInventoryMovements: (params?: {
    fromDate?: string;
    toDate?: string;
    movementType?: string;
    itemId?: string;
    page?: number;
    limit?: number;
  }) => requestPaginated<InventoryMovementRow>("/reports/inventory/movements", { page: 1, limit: 20, ...params }),

  getCashSummary: (params?: {
    fromDate?: string;
    toDate?: string;
    outletId?: string;
    userId?: string;
  }) => request<CashSummary>(`/reports/cash/summary${buildQuery(params)}`),

  getCashVariance: (params?: {
    fromDate?: string;
    toDate?: string;
    outletId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) => requestPaginated<CashVarianceRow>("/reports/cash/variance", { page: 1, limit: 20, ...params }),
};
