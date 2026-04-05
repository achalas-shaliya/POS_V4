import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

type PermissionSeed = {
  name: string;
  module: string;
  action: string;
  description: string;
};

type RoleSeed = {
  name: string;
  description: string;
  permissionNames: string[];
};

type UserSeed = {
  email: string;
  fullName: string;
  phone: string;
  roleName: string;
  password: string;
};

const permissionSeeds: PermissionSeed[] = [
  { name: 'users:create', module: 'users', action: 'create', description: 'Create users' },
  { name: 'users:read', module: 'users', action: 'read', description: 'Read users' },
  { name: 'users:update', module: 'users', action: 'update', description: 'Update users' },

  { name: 'roles:create', module: 'roles', action: 'create', description: 'Create roles' },
  { name: 'roles:read', module: 'roles', action: 'read', description: 'Read roles' },
  { name: 'roles:update', module: 'roles', action: 'update', description: 'Update roles' },

  { name: 'inventory:create', module: 'inventory', action: 'create', description: 'Create inventory entities' },
  { name: 'inventory:read', module: 'inventory', action: 'read', description: 'Read inventory data' },
  { name: 'inventory:update', module: 'inventory', action: 'update', description: 'Update inventory entities' },
  { name: 'inventory:delete', module: 'inventory', action: 'delete', description: 'Deactivate inventory entities' },
  { name: 'inventory:manage', module: 'inventory', action: 'manage', description: 'Execute stock operations' },

  { name: 'sales:create', module: 'sales', action: 'create', description: 'Create sales and customers' },
  { name: 'sales:read', module: 'sales', action: 'read', description: 'Read sales data' },
  { name: 'sales:manage', module: 'sales', action: 'manage', description: 'Void and manage sales lifecycle' },

  { name: 'repairs:create', module: 'repairs', action: 'create', description: 'Create repair jobs' },
  { name: 'repairs:read', module: 'repairs', action: 'read', description: 'Read repair jobs' },
  { name: 'repairs:update', module: 'repairs', action: 'update', description: 'Update repair jobs and parts' },

  { name: 'payments:create', module: 'payments', action: 'create', description: 'Create payment transactions' },
  { name: 'payments:read', module: 'payments', action: 'read', description: 'Read payment transactions' },

  { name: 'cash:create', module: 'cash', action: 'create', description: 'Open cash registers' },
  { name: 'cash:read', module: 'cash', action: 'read', description: 'Read cash register data' },
  { name: 'cash:update', module: 'cash', action: 'update', description: 'Close register and add movements' },

  { name: 'transfers:create', module: 'transfers', action: 'create', description: 'Create transfer requests' },
  { name: 'transfers:read', module: 'transfers', action: 'read', description: 'Read transfer data' },
  { name: 'transfers:update', module: 'transfers', action: 'update', description: 'Dispatch, receive, cancel transfers' },

  { name: 'returns:create', module: 'returns', action: 'create', description: 'Create returns' },
  { name: 'returns:read', module: 'returns', action: 'read', description: 'Read returns' },
  { name: 'returns:update', module: 'returns', action: 'update', description: 'Approve/reject returns' },

  { name: 'reports:read', module: 'reports', action: 'read', description: 'Read reports' },
];

const allPermissionNames = permissionSeeds.map((p) => p.name);

const roleSeeds: RoleSeed[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full access to all modules',
    permissionNames: allPermissionNames,
  },
  {
    name: 'MANAGER',
    description: 'Operations manager with broad access',
    permissionNames: [
      'users:read',
      'roles:read',
      'inventory:read',
      'inventory:manage',
      'sales:read',
      'sales:manage',
      'repairs:read',
      'repairs:update',
      'payments:read',
      'cash:read',
      'cash:update',
      'transfers:read',
      'transfers:update',
      'returns:read',
      'returns:update',
      'reports:read',
    ],
  },
  {
    name: 'CASHIER',
    description: 'Front counter staff for POS and cash register',
    permissionNames: [
      'sales:create',
      'sales:read',
      'payments:create',
      'payments:read',
      'cash:create',
      'cash:read',
      'cash:update',
      'inventory:read',
      'repairs:read',
    ],
  },
  {
    name: 'TECHNICIAN',
    description: 'Repair technician for service workflow',
    permissionNames: ['repairs:read', 'repairs:update', 'inventory:read'],
  },
  {
    name: 'INVENTORY_STAFF',
    description: 'Inventory and transfer operator',
    permissionNames: [
      'inventory:read',
      'inventory:manage',
      'transfers:create',
      'transfers:read',
      'transfers:update',
      'reports:read',
    ],
  },
];

const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'Passw0rd!';

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const brandSeeds = [
  { name: 'Apple', description: 'Apple Inc. devices and accessories' },
  { name: 'Samsung', description: 'Samsung Electronics products' },
  { name: 'Xiaomi', description: 'Xiaomi smartphones and accessories' },
  { name: 'Huawei', description: 'Huawei devices and accessories' },
  { name: 'OPPO', description: 'OPPO mobile devices' },
  { name: 'Vivo', description: 'Vivo smartphones' },
  { name: 'OnePlus', description: 'OnePlus smartphones and accessories' },
  { name: 'Sony', description: 'Sony mobile and electronic devices' },
  { name: 'LG', description: 'LG Electronics products' },
  { name: 'Motorola', description: 'Motorola mobile devices' },
  { name: 'Nokia', description: 'Nokia smartphones and accessories' },
  { name: 'Generic', description: 'Unbranded / third-party parts and accessories' },
];

// ---------------------------------------------------------------------------
// Categories  (parentName → children)
// ---------------------------------------------------------------------------

type CategorySeed = {
  name: string;
  description?: string;
  parentName?: string;
};

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

type ItemSeed = {
  sku: string;
  name: string;
  description?: string;
  type: 'ACCESSORY' | 'SPARE_PART' | 'TOOL';
  unit: 'PIECE' | 'BOX' | 'SET' | 'PAIR';
  costPrice: number;
  sellingPrice: number;
  categoryName: string;
  brandName?: string;
};

const itemSeeds: ItemSeed[] = [
  // ── Accessories > Cases & Covers ──────────────────────────────────────────
  { sku: 'ACC-CASE-APL-001', name: 'iPhone 15 Pro Silicone Case', type: 'ACCESSORY', unit: 'PIECE', costPrice: 5.00, sellingPrice: 14.99, categoryName: 'Cases & Covers', brandName: 'Apple' },
  { sku: 'ACC-CASE-SAM-001', name: 'Galaxy S24 Ultra Clear Case', type: 'ACCESSORY', unit: 'PIECE', costPrice: 3.00, sellingPrice: 9.99, categoryName: 'Cases & Covers', brandName: 'Samsung' },
  { sku: 'ACC-CASE-GEN-001', name: 'Universal Shockproof Case', type: 'ACCESSORY', unit: 'PIECE', costPrice: 2.00, sellingPrice: 7.99, categoryName: 'Cases & Covers', brandName: 'Generic' },

  // ── Accessories > Screen Protectors ───────────────────────────────────────
  { sku: 'ACC-SP-APL-001', name: 'iPhone 15 Tempered Glass 9H', type: 'ACCESSORY', unit: 'PIECE', costPrice: 1.50, sellingPrice: 7.99, categoryName: 'Screen Protectors', brandName: 'Generic' },
  { sku: 'ACC-SP-SAM-001', name: 'Galaxy S24 Tempered Glass 9H', type: 'ACCESSORY', unit: 'PIECE', costPrice: 1.50, sellingPrice: 7.99, categoryName: 'Screen Protectors', brandName: 'Generic' },
  { sku: 'ACC-SP-GEN-001', name: 'Universal Anti-Glare Film', type: 'ACCESSORY', unit: 'PIECE', costPrice: 0.80, sellingPrice: 4.99, categoryName: 'Screen Protectors', brandName: 'Generic' },

  // ── Accessories > Chargers & Cables ───────────────────────────────────────
  { sku: 'ACC-CBL-GEN-001', name: 'USB-C to USB-C Cable 1m', type: 'ACCESSORY', unit: 'PIECE', costPrice: 1.50, sellingPrice: 9.99, categoryName: 'Chargers & Cables', brandName: 'Generic' },
  { sku: 'ACC-CBL-APL-001', name: 'Lightning to USB-A Cable 1m', type: 'ACCESSORY', unit: 'PIECE', costPrice: 3.00, sellingPrice: 14.99, categoryName: 'Chargers & Cables', brandName: 'Apple' },
  { sku: 'ACC-CHG-GEN-001', name: '20W USB-C Fast Charger', type: 'ACCESSORY', unit: 'PIECE', costPrice: 4.00, sellingPrice: 17.99, categoryName: 'Chargers & Cables', brandName: 'Generic' },
  { sku: 'ACC-CHG-XMI-001', name: 'Xiaomi 65W GaN Charger', type: 'ACCESSORY', unit: 'PIECE', costPrice: 8.00, sellingPrice: 24.99, categoryName: 'Chargers & Cables', brandName: 'Xiaomi' },

  // ── Accessories > Power Banks ──────────────────────────────────────────────
  { sku: 'ACC-PB-XMI-001', name: 'Xiaomi 10000mAh Power Bank', type: 'ACCESSORY', unit: 'PIECE', costPrice: 12.00, sellingPrice: 34.99, categoryName: 'Power Banks', brandName: 'Xiaomi' },
  { sku: 'ACC-PB-GEN-001', name: '20000mAh Slim Power Bank', type: 'ACCESSORY', unit: 'PIECE', costPrice: 18.00, sellingPrice: 49.99, categoryName: 'Power Banks', brandName: 'Generic' },

  // ── Accessories > Headphones & Earphones ──────────────────────────────────
  { sku: 'ACC-HP-APL-001', name: 'EarPods with USB-C', type: 'ACCESSORY', unit: 'PIECE', costPrice: 8.00, sellingPrice: 24.99, categoryName: 'Headphones & Earphones', brandName: 'Apple' },
  { sku: 'ACC-HP-XMI-001', name: 'Xiaomi Wireless Earbuds', type: 'ACCESSORY', unit: 'PIECE', costPrice: 14.00, sellingPrice: 44.99, categoryName: 'Headphones & Earphones', brandName: 'Xiaomi' },

  // ── Spare Parts > Screens & Displays ──────────────────────────────────────
  { sku: 'SP-SCR-APL-014', name: 'iPhone 14 OLED Screen Assembly', type: 'SPARE_PART', unit: 'PIECE', costPrice: 45.00, sellingPrice: 89.99, categoryName: 'Screens & Displays', brandName: 'Apple' },
  { sku: 'SP-SCR-APL-015', name: 'iPhone 15 OLED Screen Assembly', type: 'SPARE_PART', unit: 'PIECE', costPrice: 65.00, sellingPrice: 119.99, categoryName: 'Screens & Displays', brandName: 'Apple' },
  { sku: 'SP-SCR-SAM-S23', name: 'Galaxy S23 AMOLED Display', type: 'SPARE_PART', unit: 'PIECE', costPrice: 55.00, sellingPrice: 109.99, categoryName: 'Screens & Displays', brandName: 'Samsung' },
  { sku: 'SP-SCR-XMI-RN12', name: 'Redmi Note 12 LCD Assembly', type: 'SPARE_PART', unit: 'PIECE', costPrice: 22.00, sellingPrice: 49.99, categoryName: 'Screens & Displays', brandName: 'Xiaomi' },

  // ── Spare Parts > Batteries ────────────────────────────────────────────────
  { sku: 'SP-BAT-APL-014', name: 'iPhone 14 Battery 3279mAh', type: 'SPARE_PART', unit: 'PIECE', costPrice: 9.00, sellingPrice: 24.99, categoryName: 'Batteries', brandName: 'Generic' },
  { sku: 'SP-BAT-APL-015', name: 'iPhone 15 Battery 3877mAh', type: 'SPARE_PART', unit: 'PIECE', costPrice: 11.00, sellingPrice: 29.99, categoryName: 'Batteries', brandName: 'Generic' },
  { sku: 'SP-BAT-SAM-S23', name: 'Galaxy S23 Battery 3900mAh', type: 'SPARE_PART', unit: 'PIECE', costPrice: 9.00, sellingPrice: 24.99, categoryName: 'Batteries', brandName: 'Generic' },
  { sku: 'SP-BAT-XMI-RN12', name: 'Redmi Note 12 Battery 5000mAh', type: 'SPARE_PART', unit: 'PIECE', costPrice: 7.00, sellingPrice: 19.99, categoryName: 'Batteries', brandName: 'Generic' },

  // ── Spare Parts > Charging Ports ──────────────────────────────────────────
  { sku: 'SP-PORT-APL-001', name: 'iPhone Lightning Port Flex', type: 'SPARE_PART', unit: 'PIECE', costPrice: 5.00, sellingPrice: 14.99, categoryName: 'Charging Ports', brandName: 'Generic' },
  { sku: 'SP-PORT-GEN-001', name: 'USB-C Charging Port Board', type: 'SPARE_PART', unit: 'PIECE', costPrice: 5.50, sellingPrice: 16.99, categoryName: 'Charging Ports', brandName: 'Generic' },

  // ── Spare Parts > Back Covers ──────────────────────────────────────────────
  { sku: 'SP-BACK-APL-014', name: 'iPhone 14 Back Glass Housing', type: 'SPARE_PART', unit: 'PIECE', costPrice: 14.00, sellingPrice: 34.99, categoryName: 'Back Covers', brandName: 'Generic' },
  { sku: 'SP-BACK-SAM-S23', name: 'Galaxy S23 Back Cover Panel', type: 'SPARE_PART', unit: 'PIECE', costPrice: 11.00, sellingPrice: 29.99, categoryName: 'Back Covers', brandName: 'Generic' },

  // ── Spare Parts > Cameras ──────────────────────────────────────────────────
  { sku: 'SP-CAM-APL-014F', name: 'iPhone 14 Front Camera 12MP', type: 'SPARE_PART', unit: 'PIECE', costPrice: 14.00, sellingPrice: 39.99, categoryName: 'Cameras', brandName: 'Generic' },
  { sku: 'SP-CAM-SAM-S23R', name: 'Galaxy S23 Rear Camera Array', type: 'SPARE_PART', unit: 'PIECE', costPrice: 28.00, sellingPrice: 69.99, categoryName: 'Cameras', brandName: 'Generic' },

  // ── Tools > Screwdrivers ───────────────────────────────────────────────────
  { sku: 'TL-SCRW-GEN-001', name: 'Pentalobe & Phillips Screwdriver Set', type: 'TOOL', unit: 'SET', costPrice: 5.00, sellingPrice: 17.99, categoryName: 'Screwdrivers', brandName: 'Generic' },

  // ── Tools > Opening Tools ──────────────────────────────────────────────────
  { sku: 'TL-OPN-GEN-001', name: 'Plastic Spudger & Pry Lever Set', type: 'TOOL', unit: 'SET', costPrice: 3.00, sellingPrice: 11.99, categoryName: 'Opening Tools', brandName: 'Generic' },
  { sku: 'TL-OPN-GEN-002', name: 'Metal Opening Lever 3-Piece Set', type: 'TOOL', unit: 'SET', costPrice: 4.00, sellingPrice: 14.99, categoryName: 'Opening Tools', brandName: 'Generic' },

  // ── Tools > Soldering Equipment ────────────────────────────────────────────
  { sku: 'TL-SOL-GEN-001', name: 'Adjustable Soldering Iron 60W', type: 'TOOL', unit: 'PIECE', costPrice: 14.00, sellingPrice: 44.99, categoryName: 'Soldering Equipment', brandName: 'Generic' },
  { sku: 'TL-SOL-GEN-002', name: 'Rosin Solder Wire 0.8mm 50g', type: 'TOOL', unit: 'PIECE', costPrice: 2.50, sellingPrice: 9.99, categoryName: 'Soldering Equipment', brandName: 'Generic' },

  // ── Tools > Testing Equipment ──────────────────────────────────────────────
  { sku: 'TL-TEST-GEN-001', name: 'Digital Multimeter Auto-Range', type: 'TOOL', unit: 'PIECE', costPrice: 12.00, sellingPrice: 34.99, categoryName: 'Testing Equipment', brandName: 'Generic' },
];

const categorySeeds: CategorySeed[] = [
  // Top-level
  { name: 'Smartphones', description: 'Mobile phones and smartphones' },
  { name: 'Accessories', description: 'Device accessories and add-ons' },
  { name: 'Spare Parts', description: 'Replacement parts for repairs' },
  { name: 'Tools', description: 'Repair tools and equipment' },
  { name: 'Tablets', description: 'Tablet computers and accessories' },
  { name: 'Wearables', description: 'Smartwatches, bands and earbuds' },

  // Accessories children
  { name: 'Cases & Covers', description: 'Protective cases and covers', parentName: 'Accessories' },
  { name: 'Screen Protectors', description: 'Tempered glass and film protectors', parentName: 'Accessories' },
  { name: 'Chargers & Cables', description: 'Charging adapters and cables', parentName: 'Accessories' },
  { name: 'Power Banks', description: 'Portable battery packs', parentName: 'Accessories' },
  { name: 'Headphones & Earphones', description: 'Wired and wireless audio accessories', parentName: 'Accessories' },
  { name: 'Mounts & Holders', description: 'Car mounts and phone holders', parentName: 'Accessories' },

  // Spare Parts children
  { name: 'Screens & Displays', description: 'LCD and OLED replacement screens', parentName: 'Spare Parts' },
  { name: 'Batteries', description: 'Replacement batteries', parentName: 'Spare Parts' },
  { name: 'Back Covers', description: 'Rear housing and back cover panels', parentName: 'Spare Parts' },
  { name: 'Charging Ports', description: 'USB-C, Lightning, Micro-USB ports', parentName: 'Spare Parts' },
  { name: 'Cameras', description: 'Front and rear camera modules', parentName: 'Spare Parts' },
  { name: 'Speakers & Microphones', description: 'Loudspeaker and mic modules', parentName: 'Spare Parts' },
  { name: 'Buttons & Flex Cables', description: 'Volume, power and home button flex assemblies', parentName: 'Spare Parts' },

  // Tools children
  { name: 'Screwdrivers', description: 'Precision screwdriver sets', parentName: 'Tools' },
  { name: 'Opening Tools', description: 'Spudgers, picks and opening levers', parentName: 'Tools' },
  { name: 'Soldering Equipment', description: 'Soldering irons, stations and flux', parentName: 'Tools' },
  { name: 'Testing Equipment', description: 'Multimeters and diagnostic tools', parentName: 'Tools' },
];


// ---------------------------------------------------------------------------
// Warehouses & Outlets
// ---------------------------------------------------------------------------

const warehouseSeeds = [
  { name: 'Main Warehouse', address: '12 Industrial Ave, Unit 3' },
  { name: 'Secondary Storage', address: '8 Commerce St, Block B' },
];

const outletSeeds = [
  { name: 'Main Store', address: '45 High Street, Ground Floor', phone: '+1555000100' },
  { name: 'Mall Kiosk', address: 'City Mall, Level 2, Shop 21', phone: '+1555000101' },
];

// ---------------------------------------------------------------------------
// Stock levels  (sku → { warehouseQty, outletQty, minQty })
// ---------------------------------------------------------------------------

type StockSeed = {
  sku: string;
  warehouseQty: number;   // Main Warehouse
  outletQty: number;      // Main Store
  minQuantity: number;    // same threshold for both locations
};

const stockSeeds: StockSeed[] = [
  // Accessories — higher turnover, larger stock
  { sku: 'ACC-CASE-APL-001', warehouseQty: 40, outletQty: 15, minQuantity: 5 },
  { sku: 'ACC-CASE-SAM-001', warehouseQty: 40, outletQty: 15, minQuantity: 5 },
  { sku: 'ACC-CASE-GEN-001', warehouseQty: 60, outletQty: 20, minQuantity: 8 },
  { sku: 'ACC-SP-APL-001',   warehouseQty: 50, outletQty: 20, minQuantity: 8 },
  { sku: 'ACC-SP-SAM-001',   warehouseQty: 50, outletQty: 20, minQuantity: 8 },
  { sku: 'ACC-SP-GEN-001',   warehouseQty: 80, outletQty: 25, minQuantity: 10 },
  { sku: 'ACC-CBL-GEN-001',  warehouseQty: 60, outletQty: 20, minQuantity: 8 },
  { sku: 'ACC-CBL-APL-001',  warehouseQty: 30, outletQty: 12, minQuantity: 5 },
  { sku: 'ACC-CHG-GEN-001',  warehouseQty: 30, outletQty: 10, minQuantity: 5 },
  { sku: 'ACC-CHG-XMI-001',  warehouseQty: 20, outletQty: 8,  minQuantity: 3 },
  { sku: 'ACC-PB-XMI-001',   warehouseQty: 20, outletQty: 6,  minQuantity: 3 },
  { sku: 'ACC-PB-GEN-001',   warehouseQty: 15, outletQty: 5,  minQuantity: 2 },
  { sku: 'ACC-HP-APL-001',   warehouseQty: 20, outletQty: 6,  minQuantity: 3 },
  { sku: 'ACC-HP-XMI-001',   warehouseQty: 20, outletQty: 6,  minQuantity: 3 },

  // Spare Parts — repair shop stock, moderate quantities
  { sku: 'SP-SCR-APL-014',   warehouseQty: 10, outletQty: 3,  minQuantity: 2 },
  { sku: 'SP-SCR-APL-015',   warehouseQty: 8,  outletQty: 2,  minQuantity: 2 },
  { sku: 'SP-SCR-SAM-S23',   warehouseQty: 8,  outletQty: 2,  minQuantity: 2 },
  { sku: 'SP-SCR-XMI-RN12',  warehouseQty: 12, outletQty: 4,  minQuantity: 2 },
  { sku: 'SP-BAT-APL-014',   warehouseQty: 15, outletQty: 5,  minQuantity: 3 },
  { sku: 'SP-BAT-APL-015',   warehouseQty: 12, outletQty: 4,  minQuantity: 3 },
  { sku: 'SP-BAT-SAM-S23',   warehouseQty: 12, outletQty: 4,  minQuantity: 3 },
  { sku: 'SP-BAT-XMI-RN12',  warehouseQty: 15, outletQty: 5,  minQuantity: 3 },
  { sku: 'SP-PORT-APL-001',  warehouseQty: 20, outletQty: 5,  minQuantity: 3 },
  { sku: 'SP-PORT-GEN-001',  warehouseQty: 20, outletQty: 5,  minQuantity: 3 },
  { sku: 'SP-BACK-APL-014',  warehouseQty: 10, outletQty: 2,  minQuantity: 2 },
  { sku: 'SP-BACK-SAM-S23',  warehouseQty: 10, outletQty: 2,  minQuantity: 2 },
  { sku: 'SP-CAM-APL-014F',  warehouseQty: 8,  outletQty: 2,  minQuantity: 2 },
  { sku: 'SP-CAM-SAM-S23R',  warehouseQty: 6,  outletQty: 1,  minQuantity: 1 },

  // Tools — low quantities, kept in warehouse only / small outlet display
  { sku: 'TL-SCRW-GEN-001',  warehouseQty: 10, outletQty: 3,  minQuantity: 2 },
  { sku: 'TL-OPN-GEN-001',   warehouseQty: 10, outletQty: 3,  minQuantity: 2 },
  { sku: 'TL-OPN-GEN-002',   warehouseQty: 8,  outletQty: 2,  minQuantity: 2 },
  { sku: 'TL-SOL-GEN-001',   warehouseQty: 5,  outletQty: 1,  minQuantity: 1 },
  { sku: 'TL-SOL-GEN-002',   warehouseQty: 15, outletQty: 3,  minQuantity: 3 },
  { sku: 'TL-TEST-GEN-001',  warehouseQty: 5,  outletQty: 1,  minQuantity: 1 },
];

const userSeeds: UserSeed[] = [
  {
    email: 'admin@pos.local',
    fullName: 'System Administrator',
    phone: '+1000000001',
    roleName: 'SUPER_ADMIN',
    password: process.env.SEED_ADMIN_PASSWORD ?? defaultPassword,
  },
  {
    email: 'manager@pos.local',
    fullName: 'Store Manager',
    phone: '+1000000002',
    roleName: 'MANAGER',
    password: process.env.SEED_MANAGER_PASSWORD ?? defaultPassword,
  },
  {
    email: 'cashier@pos.local',
    fullName: 'Front Cashier',
    phone: '+1000000003',
    roleName: 'CASHIER',
    password: process.env.SEED_CASHIER_PASSWORD ?? defaultPassword,
  },
  {
    email: 'tech@pos.local',
    fullName: 'Repair Technician',
    phone: '+1000000004',
    roleName: 'TECHNICIAN',
    password: process.env.SEED_TECHNICIAN_PASSWORD ?? defaultPassword,
  },
  {
    email: 'inventory@pos.local',
    fullName: 'Inventory Officer',
    phone: '+1000000005',
    roleName: 'INVENTORY_STAFF',
    password: process.env.SEED_INVENTORY_PASSWORD ?? defaultPassword,
  },
];

function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: u.username,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    database: u.pathname.replace(/^\//, ''),
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run seed.');
  }

  const adapter = new PrismaMariaDb({
    ...parseDbUrl(databaseUrl),
    connectionLimit: 5,
    connectTimeout: 10_000,
    allowPublicKeyRetrieval: true,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Seeding permissions...');
    for (const permission of permissionSeeds) {
      await prisma.permission.upsert({
        where: { name: permission.name },
        update: {
          module: permission.module,
          action: permission.action,
          description: permission.description,
        },
        create: permission,
      });
    }

    console.log('Seeding roles...');
    const roleMap = new Map<string, { id: string }>();
    for (const role of roleSeeds) {
      const upserted = await prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description },
        create: { name: role.name, description: role.description },
        select: { id: true, name: true },
      });
      roleMap.set(role.name, { id: upserted.id });
    }

    console.log('Assigning role permissions...');
    for (const role of roleSeeds) {
      const roleRef = roleMap.get(role.name);
      if (!roleRef) continue;

      const permissions = await prisma.permission.findMany({
        where: { name: { in: role.permissionNames } },
        select: { id: true },
      });

      await prisma.rolePermission.deleteMany({ where: { roleId: roleRef.id } });

      if (permissions.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: roleRef.id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    }

    console.log('Seeding users...');
    for (const user of userSeeds) {
      const roleRef = roleMap.get(user.roleName);
      if (!roleRef) {
        throw new Error(`Role not found for seed user: ${user.roleName}`);
      }

      const passwordHash = await bcrypt.hash(user.password, 10);

      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          fullName: user.fullName,
          phone: user.phone,
          roleId: roleRef.id,
          isActive: true,
          passwordHash,
        },
        create: {
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          roleId: roleRef.id,
          isActive: true,
          passwordHash,
        },
      });
    }

    console.log('Seed complete.');
    console.log('Seeded users:');
    for (const user of userSeeds) {
      console.log(`- ${user.email} (${user.roleName})`);
    }

    console.log('Seeding brands...');
    const brandIdMap = new Map<string, string>();
    for (const brand of brandSeeds) {
      const upserted = await prisma.brand.upsert({
        where: { name: brand.name },
        update: { description: brand.description },
        create: brand,
        select: { id: true, name: true },
      });
      brandIdMap.set(brand.name, upserted.id);
    }

    console.log('Seeding categories...');
    // Two-pass: parents first, then children
    const topLevel = categorySeeds.filter((c) => !c.parentName);
    const childCats = categorySeeds.filter((c) => c.parentName);

    const categoryIdMap = new Map<string, string>();

    for (const cat of topLevel) {
      const upserted = await prisma.category.upsert({
        where: { name: cat.name },
        update: { description: cat.description },
        create: { name: cat.name, description: cat.description },
        select: { id: true, name: true },
      });
      categoryIdMap.set(cat.name, upserted.id);
    }

    for (const cat of childCats) {
      const parentId = categoryIdMap.get(cat.parentName!);
      if (!parentId) {
        console.warn(`  ⚠ Parent category not found for "${cat.name}", skipping.`);
        continue;
      }
      const upserted = await prisma.category.upsert({
        where: { name: cat.name },
        update: { description: cat.description, parentId },
        create: { name: cat.name, description: cat.description, parentId },
        select: { id: true, name: true },
      });
      categoryIdMap.set(cat.name, upserted.id);
    }

    console.log('Seeding items...');
    for (const item of itemSeeds) {
      const categoryId = categoryIdMap.get(item.categoryName);
      if (!categoryId) {
        console.warn(`  ⚠ Category "${item.categoryName}" not found for item "${item.sku}", skipping.`);
        continue;
      }
      const brandId = item.brandName ? brandIdMap.get(item.brandName) : undefined;

      await prisma.item.upsert({
        where: { sku: item.sku },
        update: {
          name: item.name,
          description: item.description,
          type: item.type,
          unit: item.unit,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          categoryId,
          brandId: brandId ?? null,
        },
        create: {
          sku: item.sku,
          name: item.name,
          description: item.description,
          type: item.type,
          unit: item.unit,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          categoryId,
          brandId: brandId ?? null,
        },
      });
    }

    // Build item id map by SKU for stock seeding
    const allItemRecords = await prisma.item.findMany({ select: { id: true, sku: true } });
    const itemIdBySku = new Map(allItemRecords.map((i) => [i.sku, i.id]));

    console.log('Seeding warehouses & outlets...');
    const warehouseIdMap = new Map<string, string>();
    for (const wh of warehouseSeeds) {
      const upserted = await prisma.warehouse.upsert({
        where: { name: wh.name },
        update: { address: wh.address },
        create: wh,
        select: { id: true, name: true },
      });
      warehouseIdMap.set(wh.name, upserted.id);
    }

    const outletIdMap = new Map<string, string>();
    for (const outlet of outletSeeds) {
      const upserted = await prisma.outlet.upsert({
        where: { name: outlet.name },
        update: { address: outlet.address, phone: outlet.phone },
        create: outlet,
        select: { id: true, name: true },
      });
      outletIdMap.set(outlet.name, upserted.id);
    }

    console.log('Seeding stock levels...');
    const mainWarehouseId = warehouseIdMap.get('Main Warehouse')!;
    const mainOutletId = outletIdMap.get('Main Store')!;

    for (const stock of stockSeeds) {
      const itemId = itemIdBySku.get(stock.sku);
      if (!itemId) {
        console.warn(`  ⚠ Item SKU "${stock.sku}" not found, skipping stock.`);
        continue;
      }

      await prisma.warehouseStock.upsert({
        where: { warehouseId_itemId: { warehouseId: mainWarehouseId, itemId } },
        update: { quantity: stock.warehouseQty, minQuantity: stock.minQuantity },
        create: { warehouseId: mainWarehouseId, itemId, quantity: stock.warehouseQty, minQuantity: stock.minQuantity },
      });

      await prisma.outletStock.upsert({
        where: { outletId_itemId: { outletId: mainOutletId, itemId } },
        update: { quantity: stock.outletQty, minQuantity: stock.minQuantity },
        create: { outletId: mainOutletId, itemId, quantity: stock.outletQty, minQuantity: stock.minQuantity },
      });
    }

    console.log('Seed complete.');
    console.log(`- ${brandSeeds.length} brands`);
    console.log(`- ${topLevel.length} top-level categories, ${childCats.length} sub-categories`);
    console.log(`- ${itemSeeds.length} items`);
    console.log(`- ${warehouseSeeds.length} warehouses, ${outletSeeds.length} outlets`);
    console.log(`- ${stockSeeds.length} items with warehouse + outlet stock`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
