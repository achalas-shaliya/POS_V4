"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  api,
  type BrandRecord,
  type CategoryRecord,
  type ItemRecord,
  type OutletRecord,
  type StockRow,
  type WarehouseRecord,
} from "@/lib/api";
import { useBarcodeScanner } from "@/lib/use-barcode-scanner";
import { CameraBarcodeScannerModal } from "@/components/pos/camera-barcode-scanner-modal";

type ItemType = "ACCESSORY" | "SPARE_PART" | "TOOL";
type UnitType = "PIECE" | "BOX" | "SET" | "PAIR";

type CreateItemForm = {
  sku: string;
  name: string;
  description: string;
  type: ItemType;
  unit: UnitType;
  costPrice: string;
  sellingPrice: string;
  discountPrice: string;
  categoryId: string;
  brandId: string;
};

type CreateCategoryForm = {
  name: string;
  description: string;
};

type CreateBrandForm = {
  name: string;
  description: string;
};

const ITEM_TYPES: ItemType[] = ["ACCESSORY", "SPARE_PART", "TOOL"];
const UNIT_TYPES: UnitType[] = ["PIECE", "BOX", "SET", "PAIR"];

const EMPTY_CREATE_ITEM_FORM: CreateItemForm = {
  sku: "",
  name: "",
  description: "",
  type: "ACCESSORY",
  unit: "PIECE",
  costPrice: "",
  sellingPrice: "",
  discountPrice: "0",
  categoryId: "",
  brandId: "",
};

const EMPTY_CREATE_CATEGORY_FORM: CreateCategoryForm = {
  name: "",
  description: "",
};

const EMPTY_CREATE_BRAND_FORM: CreateBrandForm = {
  name: "",
  description: "",
};

type TableRow = {
  id: string;
  itemId: string;
  sku: string;
  name: string;
  category: string;
  locationType: "WAREHOUSE" | "OUTLET";
  locationId: string;
  locationName: string;
  quantity: number;
  minQuantity: number;
};

const toTableRow = (
  row: StockRow,
  locationType: "WAREHOUSE" | "OUTLET",
  locationId: string,
  locationName: string,
): TableRow => ({
  id: row.id,
  itemId: row.item.id,
  sku: row.item.sku,
  name: row.item.name,
  category: row.item.category?.name ?? "General",
  locationType,
  locationId,
  locationName,
  quantity: row.quantity,
  minQuantity: row.minQuantity,
});

const PAGE_SIZE = 15;

export function InventoryScreen() {
  const session = api.getSession();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [rows, setRows] = useState<TableRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [createItemForm, setCreateItemForm] = useState<CreateItemForm>(EMPTY_CREATE_ITEM_FORM);
  const [creatingItem, setCreatingItem] = useState(false);
  // Edit item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<CreateItemForm>(EMPTY_CREATE_ITEM_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  // Min-stock editing (map of rowId → input value)
  const [minValues, setMinValues] = useState<Record<string, string>>({});
  // Min-stock for new item creation (map of locationId → value)
  const [createMinValues, setCreateMinValues] = useState<Record<string, string>>({}); 
  const [createCategoryForm, setCreateCategoryForm] = useState<CreateCategoryForm>(
    EMPTY_CREATE_CATEGORY_FORM,
  );
  const [createBrandForm, setCreateBrandForm] = useState<CreateBrandForm>(EMPTY_CREATE_BRAND_FORM);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [activeTab, setActiveTab] = useState<"stock" | "category" | "brand" | "restock">("stock");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const stockSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Restock — bulk batch
  type RestockMode = "purchase" | "adjust" | "transfer";
  type BulkLine = { id: string; itemId: string; qty: string; locationId: string; locationType: "WAREHOUSE" | "OUTLET"; note: string };
  const [restockMode, setRestockMode] = useState<RestockMode>("purchase");
  // Shared locations (purchase = warehouse dest; transfer = from location)
  const [sharedLocationId,   setSharedLocationId]   = useState("");
  const [sharedLocationType, setSharedLocationType] = useState<"WAREHOUSE" | "OUTLET">("WAREHOUSE");
  const [sharedToId,         setSharedToId]         = useState("");
  const [sharedToType,       setSharedToType]       = useState<"WAREHOUSE" | "OUTLET">("OUTLET");
  // Growing lines
  const [bulkLines, setBulkLines] = useState<BulkLine[]>([]);
  // "Add line" row inputs
  const [addItemId,     setAddItemId]     = useState("");
  const [addItemSearch, setAddItemSearch] = useState("");
  const [addItemOpen,   setAddItemOpen]   = useState(false);
  const [addQty,        setAddQty]        = useState("");
  const [addLocId,    setAddLocId]    = useState("");
  const [addLocType,  setAddLocType]  = useState<"WAREHOUSE" | "OUTLET">("WAREHOUSE");
  const [addNote,     setAddNote]     = useState("");
  const [restocking,  setRestocking]  = useState(false);
  let lineCounter = 0;

  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const sessionKey = session?.accessToken ?? "";

  const handleBarcodeScan = useCallback((code: string) => {
    setSearch(code);
  }, []);

  useBarcodeScanner({
    enabled: !!session,
    targetRef: stockSearchInputRef,
    onScan: handleBarcodeScan,
  });

  const loadStock = async (warehouseData: WarehouseRecord[], outletData: OutletRecord[]) => {
    const warehouseStockResponses = await Promise.all(
      warehouseData.map(async (warehouse) => ({
        warehouse,
        response: await api.getWarehouseStock(warehouse.id, { page: 1, limit: 100 }),
      })),
    );
    const outletStockResponses = await Promise.all(
      outletData.map(async (outlet) => ({
        outlet,
        response: await api.getOutletStock(outlet.id, { page: 1, limit: 100 }),
      })),
    );

    const nextRows = [
      ...warehouseStockResponses.flatMap(({ warehouse, response }) =>
        response.data.map((row) => toTableRow(row, "WAREHOUSE", warehouse.id, warehouse.name)),
      ),
      ...outletStockResponses.flatMap(({ outlet, response }) =>
        response.data.map((row) => toTableRow(row, "OUTLET", outlet.id, outlet.name)),
      ),
    ];
    setRows(nextRows);
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!sessionKey) {
        setLoading(false);
        return;
      }

      try {
        const [warehouseData, outletData, itemData, categoryData, brandData] = await Promise.all([
          api.listWarehouses(),
          api.listOutlets(),
          api.listItems({ page: 1, limit: 100, isActive: true }),
          api.listCategories(),
          api.listBrands(),
        ]);

        setWarehouses(warehouseData);
        setOutlets(outletData);
        setItems(itemData.data);
        setCategories(categoryData);
        setBrands(brandData);
        setCreateItemForm((current) => ({
          ...current,
          categoryId: current.categoryId || categoryData[0]?.id || "",
          brandId: current.brandId || brandData[0]?.id || "",
        }));

        await loadStock(warehouseData, outletData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load inventory data");
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [sessionKey]);

  const filteredRows = rows.filter((row) => {
    const matchesWarehouse = warehouseFilter === "ALL" || row.locationName === warehouseFilter;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      row.name.toLowerCase().includes(normalizedSearch) ||
      row.sku.toLowerCase().includes(normalizedSearch) ||
      row.category.toLowerCase().includes(normalizedSearch) ||
      row.locationName.toLowerCase().includes(normalizedSearch);
    const matchesLowStock = !lowStockOnly || row.quantity <= row.minQuantity;

    return matchesWarehouse && matchesSearch && matchesLowStock;
  });

  const lowStockCount = filteredRows.filter((row) => row.quantity <= row.minQuantity).length;
  const totalUnits = filteredRows.reduce((sum, row) => sum + row.quantity, 0);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE);

  // Reset to page 1 whenever filters change
  useEffect(() => { setTablePage(1); }, [normalizedSearch, warehouseFilter, lowStockOnly]);

  const createItem = async () => {
    if (
      !createItemForm.sku.trim() ||
      !createItemForm.name.trim() ||
      !createItemForm.categoryId ||
      Number(createItemForm.costPrice) < 0 ||
      Number(createItemForm.sellingPrice) < 0
    ) {
      setError("Please fill all required item fields correctly.");
      return;
    }

    setCreatingItem(true);
    try {
      setError(null);
      setMessage(null);
      const created = await api.createItem({
        sku: createItemForm.sku.trim(),
        name: createItemForm.name.trim(),
        description: createItemForm.description.trim() || undefined,
        type: createItemForm.type,
        unit: createItemForm.unit,
        costPrice: Number(createItemForm.costPrice),
        sellingPrice: Number(createItemForm.sellingPrice),
        discountPrice: Number(createItemForm.discountPrice) || 0,
        categoryId: createItemForm.categoryId,
        brandId: createItemForm.brandId || undefined,
      });

      const [itemRows, warehouseData, outletData] = await Promise.all([
        api.listItems({ page: 1, limit: 100, isActive: true }),
        api.listWarehouses(),
        api.listOutlets(),
      ]);

      setCreateItemForm((current) => ({
        ...EMPTY_CREATE_ITEM_FORM,
        type: current.type,
        unit: current.unit,
        categoryId: current.categoryId,
        brandId: current.brandId,
      }));

      // Set min stock per location where user entered a value
      const allLocs = [
        ...warehouseData.map((w) => ({ id: w.id, type: "WAREHOUSE" as const })),
        ...outletData.map((o) => ({ id: o.id, type: "OUTLET" as const })),
      ];
      await Promise.all(
        allLocs
          .filter((l) => createMinValues[l.id] && createMinValues[l.id] !== "")
          .map((l) => {
            const minQty = parseInt(createMinValues[l.id], 10);
            if (!isNaN(minQty) && minQty >= 0) {
              return api.setMinStock({ locationType: l.type, locationId: l.id, itemId: created.id, minQuantity: minQty });
            }
          })
      );
      setCreateMinValues({});

      setItems(itemRows.data);
      await loadStock(warehouseData, outletData);
      setMessage(`Item ${created.name} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setCreatingItem(false);
    }
  };

  const createCategory = async () => {
    if (!createCategoryForm.name.trim()) {
      setError("Category name is required.");
      return;
    }

    setCreatingCategory(true);
    try {
      setError(null);
      setMessage(null);
      const created = await api.createCategory({
        name: createCategoryForm.name.trim(),
        description: createCategoryForm.description.trim() || undefined,
      });

      const categoryData = await api.listCategories();
      setCategories(categoryData);
      setCreateItemForm((current) => ({ ...current, categoryId: created.id }));
      setCreateCategoryForm(EMPTY_CREATE_CATEGORY_FORM);
      setMessage(`Category ${created.name} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const createBrand = async () => {
    if (!createBrandForm.name.trim()) {
      setError("Brand name is required.");
      return;
    }

    setCreatingBrand(true);
    try {
      setError(null);
      setMessage(null);
      const created = await api.createBrand({
        name: createBrandForm.name.trim(),
        description: createBrandForm.description.trim() || undefined,
      });

      const brandData = await api.listBrands();
      setBrands(brandData);
      setCreateItemForm((current) => ({ ...current, brandId: created.id }));
      setCreateBrandForm(EMPTY_CREATE_BRAND_FORM);
      setMessage(`Brand ${created.name} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand");
    } finally {
      setCreatingBrand(false);
    }
  };

  const openEditItem = (item: ItemRecord) => {
    setEditingItemId(item.id);
    setEditItemForm({
      sku: item.sku,
      name: item.name,
      description: item.description ?? "",
      type: item.type ?? "ACCESSORY",
      unit: item.unit ?? "PIECE",
      costPrice: item.costPrice != null ? String(item.costPrice) : "",
      sellingPrice: item.sellingPrice != null ? String(item.sellingPrice) : "",
      discountPrice: item.discountPrice != null ? String(item.discountPrice) : "0",
      categoryId: item.category?.id ?? "",
      brandId: item.brand?.id ?? "",
    });
    const initMin: Record<string, string> = {};
    rows.filter((r) => r.itemId === item.id).forEach((r) => { initMin[r.id] = String(r.minQuantity); });
    setMinValues(initMin);
    setActiveTab("stock");
  };

  const handleItemUpdate = async () => {
    if (!editingItemId) return;
    if (!editItemForm.sku.trim() || !editItemForm.name.trim()) {
      setError("SKU and name are required.");
      return;
    }
    setSavingEdit(true);
    try {
      setError(null);
      setMessage(null);
      await api.updateItem(editingItemId, {
        sku: editItemForm.sku.trim(),
        name: editItemForm.name.trim(),
        description: editItemForm.description.trim() || undefined,
        type: editItemForm.type,
        unit: editItemForm.unit,
        costPrice: editItemForm.costPrice !== "" ? Number(editItemForm.costPrice) : undefined,
        sellingPrice: editItemForm.sellingPrice !== "" ? Number(editItemForm.sellingPrice) : undefined,
        discountPrice: editItemForm.discountPrice !== "" ? Number(editItemForm.discountPrice) : 0,
        categoryId: editItemForm.categoryId || undefined,
        brandId: editItemForm.brandId || undefined,
      });
      // Save any changed min-stock values
      const itemRows = rows.filter((r) => r.itemId === editingItemId);
      await Promise.all(
        itemRows
          .filter((r) => minValues[r.id] !== undefined && minValues[r.id] !== String(r.minQuantity))
          .map((r) => {
            const minQty = parseInt(minValues[r.id], 10);
            if (!isNaN(minQty) && minQty >= 0) {
              return api.setMinStock({ locationType: r.locationType, locationId: r.locationId, itemId: r.itemId, minQuantity: minQty });
            }
          })
      );
      const [itemData, warehouseData, outletData] = await Promise.all([
        api.listItems({ page: 1, limit: 100, isActive: true }),
        api.listWarehouses(),
        api.listOutlets(),
      ]);
      setItems(itemData.data);
      await loadStock(warehouseData, outletData);
      setMessage(`Item "${editItemForm.name}" updated.`);
      setEditingItemId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setSavingEdit(false);
    }
  };

  const allLocations = [
    ...warehouses.map((w) => ({ id: w.id, name: w.name, type: "WAREHOUSE" as const })),
    ...outlets.map((o) => ({ id: o.id, name: o.name, type: "OUTLET" as const })),
  ];

  const addBulkLine = () => {
    if (!addItemId) { setError("Select an item to add."); return; }
    const qty = parseInt(addQty, 10);
    if (!qty || qty <= 0) { setError("Enter a valid quantity."); return; }
    if (restockMode === "adjust" && !addLocId) { setError("Select a location for this item."); return; }
    setError(null);
    setBulkLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${lineCounter++}`,
        itemId: addItemId,
        qty: addQty,
        locationId: restockMode === "adjust" ? addLocId : sharedLocationId,
        locationType: restockMode === "adjust" ? addLocType : sharedLocationType,
        note: addNote,
      },
    ]);
    setAddItemId(""); setAddItemSearch(""); setAddQty(""); setAddNote("");
  };

  const removeLine = (id: string) => setBulkLines((prev) => prev.filter((l) => l.id !== id));

  const handleBulkSubmit = async () => {
    if (bulkLines.length === 0) { setError("Add at least one item to the batch."); return; }
    if ((restockMode === "purchase" || restockMode === "transfer") && !sharedLocationId) {
      setError("Select a location."); return;
    }
    if (restockMode === "transfer" && !sharedToId) { setError("Select a destination."); return; }

    setRestocking(true);
    setError(null); setMessage(null);
    let successCount = 0;
    const errors: string[] = [];
    try {
      for (const line of bulkLines) {
        const qty = parseInt(line.qty, 10);
        try {
          if (restockMode === "purchase") {
            await api.purchaseStock({ warehouseId: sharedLocationId, itemId: line.itemId, quantity: qty, note: line.note || undefined });
          } else if (restockMode === "adjust") {
            await api.adjustStock({ locationType: line.locationType, locationId: line.locationId, itemId: line.itemId, newQuantity: qty, note: line.note || undefined });
          } else {
            await api.transferStock({ fromType: sharedLocationType, fromId: sharedLocationId, toType: sharedToType, toId: sharedToId, itemId: line.itemId, quantity: qty, note: line.note || undefined });
          }
          successCount++;
        } catch (err) {
          const itemName = items.find((i) => i.id === line.itemId)?.name ?? line.itemId;
          errors.push(`${itemName}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
      if (successCount > 0) {
        setBulkLines([]);
        const [wh, ol] = await Promise.all([api.listWarehouses(), api.listOutlets()]);
        await loadStock(wh, ol);
        setMessage(`Batch complete: ${successCount} item${successCount !== 1 ? "s" : ""} processed.${errors.length ? ` ${errors.length} failed.` : ""}`);
      }
      if (errors.length > 0 && successCount === 0) setError(errors.join(" · "));
    } finally {
      setRestocking(false);
    }
  };

  const addLowStockToBatch = (r: TableRow) => {
    setActiveTab("restock");
    if (r.locationType === "WAREHOUSE") {
      setRestockMode("purchase");
      setSharedLocationId(r.locationId);
      setSharedLocationType("WAREHOUSE");
    } else {
      setRestockMode("transfer");
      setSharedLocationId(r.locationId);
      setSharedLocationType("OUTLET");
    }
    const _item = items.find((i) => i.id === r.itemId);
    setAddItemId(r.itemId);
    setAddItemSearch(_item ? `${_item.name} (${_item.sku})` : "");
    setAddQty("");
  };

  if (!session) {
    return (
      <div className="rounded-[28px] border border-line bg-white p-8">
        <h2 className="text-2xl font-bold">Inventory</h2>
        <p className="mt-3 text-sm text-muted">Sign in first to load stock, transfers, and warehouse data.</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 xl:h-[calc(100vh-6rem)] xl:flex xl:flex-col">
      {loading ? <p className="text-sm text-muted">Loading inventory workspace...</p> : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}

      {/* Stats + tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="rounded-[20px] border border-line bg-white px-4 py-3">
            <p className="text-xs text-muted">Total units</p>
            <p className="mt-0.5 text-2xl font-bold">{totalUnits}</p>
          </div>
          <button
            type="button"
            onClick={() => { setLowStockOnly((v) => !v); setActiveTab("stock"); }}
            className={`rounded-[20px] border px-4 py-3 text-left transition ${
              lowStockOnly
                ? "border-rose-200 bg-rose-50"
                : "border-line bg-white hover:border-rose-200 hover:bg-rose-50/40"
            }`}
          >
            <p className="text-xs text-muted">Critical lines</p>
            <p className={`mt-0.5 text-2xl font-bold ${lowStockCount > 0 ? "text-rose-600" : ""}`}>{lowStockCount}</p>
          </button>
        </div>

        <div className="flex rounded-2xl border border-line bg-surface p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "stock" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            Stock {rows.length > 0 && <span className="ml-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-xs text-brand">{rows.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("category")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "category" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            Category {categories.length > 0 && <span className="ml-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-xs text-brand">{categories.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("brand")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "brand" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            Brand {brands.length > 0 && <span className="ml-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-xs text-brand">{brands.length}</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("restock")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "restock" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            Restock
          </button>
        </div>
      </div>

      {/* Tab: Stock */}
      {activeTab === "stock" && (
        <div className="xl:flex-1 xl:flex xl:flex-col xl:min-h-0">
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:flex-1 xl:min-h-0 xl:items-stretch">
            <div className="rounded-[28px] border border-line bg-white p-5 xl:flex xl:flex-col xl:min-h-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between xl:shrink-0">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Stock table</p>
                  <h3 className="mt-1 text-xl font-bold">Live stock snapshot</h3>
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input ref={stockSearchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU, item, category, location, or scan barcode" className="w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm outline-none ring-brand/30 transition focus:ring md:w-72" />
                  <button
                    type="button"
                    onClick={() => setCameraScannerOpen(true)}
                    className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
                  >
                    Scan with camera
                  </button>
                  <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm outline-none">
                    <option value="ALL">All locations</option>
                    {[...warehouses, ...outlets].map((location) => <option key={location.id} value={location.name}>{location.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setLowStockOnly((v) => !v)}
                    className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                      lowStockOnly
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-line bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {lowStockOnly ? `Low stock (${lowStockCount})` : "Low stock"}
                  </button>
                </div>
              </div>

              <div className="mt-5 xl:flex-1 xl:min-h-0 overflow-hidden rounded-[24px] border border-line">
                <div className="overflow-x-auto xl:h-full xl:overflow-y-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="bg-surface text-left text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">SKU / Item</th>
                        <th className="px-4 py-3 font-medium">Location</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Qty</th>
                        <th className="px-4 py-3 font-medium">Min</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                      {pagedRows.map((row) => {
                        const lowStock = row.quantity <= row.minQuantity;
                        return (
                          <tr key={`${row.locationType}-${row.id}`}>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-ink">{row.name}</p>
                                <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">{row.sku} • {row.category}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted">{row.locationName}</td>
                            <td className="px-4 py-3 text-muted">{row.locationType}</td>
                            <td className="px-4 py-3 font-semibold text-ink">{row.quantity}</td>
                            <td className="px-4 py-3 text-muted">{row.minQuantity}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lowStock ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {lowStock ? "Low stock" : "Healthy"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const item = items.find((i) => i.id === row.itemId);
                                  if (item) openEditItem(item);
                                }}
                                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:border-brand hover:text-brand"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 xl:shrink-0 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full bg-surface px-3 py-2">Visible units: {totalUnits}</span>
                  <span className="rounded-full bg-surface px-3 py-2">Critical lines: {lowStockCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    disabled={tablePage === 1}
                    className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs">
                    Page {tablePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                    disabled={tablePage === totalPages}
                    className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-line bg-white p-5 xl:overflow-y-auto">
              {editingItemId ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Item catalog</p>
                      <h3 className="mt-1 text-xl font-bold">Edit item</h3>
                    </div>
                    <button type="button" onClick={() => setEditingItemId(null)}
                      className="text-xs text-muted hover:text-ink transition">
                      ✕ Cancel
                    </button>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">SKU</p>
                      <input value={editItemForm.sku}
                        onChange={(e) => setEditItemForm((f) => ({ ...f, sku: e.target.value }))}
                        placeholder="SKU"
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Item name</p>
                      <input value={editItemForm.name}
                        onChange={(e) => setEditItemForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Item name"
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <textarea value={editItemForm.description}
                      onChange={(e) => setEditItemForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Description (optional)"
                      className="min-h-20 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Type</span>
                        <select value={editItemForm.type}
                          onChange={(e) => setEditItemForm((f) => ({ ...f, type: e.target.value as ItemType }))}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                          {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Unit</span>
                        <select value={editItemForm.unit}
                          onChange={(e) => setEditItemForm((f) => ({ ...f, unit: e.target.value as UnitType }))}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                          {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Category</span>
                        <select value={editItemForm.categoryId}
                          onChange={(e) => setEditItemForm((f) => ({ ...f, categoryId: e.target.value }))}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                          <option value="">No category</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Brand</span>
                        <select value={editItemForm.brandId}
                          onChange={(e) => setEditItemForm((f) => ({ ...f, brandId: e.target.value }))}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                          <option value="">No brand</option>
                          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Cost price</p>
                        <input value={editItemForm.costPrice}
                          onChange={(e) => setEditItemForm((f) => ({ ...f, costPrice: e.target.value }))}
                          placeholder="0.00" inputMode="decimal"
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Selling price</p>
                        <input value={editItemForm.sellingPrice}
                          onChange={(e) => setEditItemForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                          placeholder="0.00" inputMode="decimal"
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Discount price</p>
                      <input value={editItemForm.discountPrice}
                        onChange={(e) => setEditItemForm((f) => ({ ...f, discountPrice: e.target.value }))}
                        placeholder="0.00" inputMode="decimal"
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                    </div>
                    {/* Min stock thresholds per location */}
                    {(() => {
                      const itemRows = rows.filter((r) => r.itemId === editingItemId);
                      if (itemRows.length === 0) return null;
                      return (
                        <div className="rounded-xl border border-line bg-surface p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Min stock by location</p>
                          <div className="space-y-2">
                            {itemRows.map((r) => (
                              <div key={r.id} className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-ink">{r.locationName}</p>
                                  <p className="text-xs text-muted">{r.locationType} · stock: {r.quantity}</p>
                                </div>
                                <input
                                  type="number" min="0"
                                  value={minValues[r.id] ?? r.minQuantity}
                                  onChange={(e) => setMinValues((v) => ({ ...v, [r.id]: e.target.value }))}
                                  className="w-16 shrink-0 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-brand"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <button type="button" onClick={handleItemUpdate} disabled={savingEdit}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-muted">
                      {savingEdit ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" onClick={() => setEditingItemId(null)}
                      className="btn-secondary w-full">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Item catalog</p>
                  <h3 className="mt-1 text-xl font-bold">Add item to system</h3>
                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">SKU</p>
                      <input
                        value={createItemForm.sku}
                        onChange={(event) =>
                          setCreateItemForm((current) => ({ ...current, sku: event.target.value }))
                        }
                        placeholder="SKU"
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Item name</p>
                      <input
                        value={createItemForm.name}
                        onChange={(event) =>
                          setCreateItemForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Item name"
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                      />
                    </div>
                    <textarea
                      value={createItemForm.description}
                      onChange={(event) =>
                        setCreateItemForm((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Description (optional)"
                      className="min-h-20 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Type</span>
                        <select
                          value={createItemForm.type}
                          onChange={(event) =>
                            setCreateItemForm((current) => ({
                              ...current,
                              type: event.target.value as ItemType,
                            }))
                          }
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                        >
                          {ITEM_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Unit</span>
                        <select
                          value={createItemForm.unit}
                          onChange={(event) =>
                            setCreateItemForm((current) => ({
                              ...current,
                              unit: event.target.value as UnitType,
                            }))
                          }
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                        >
                          {UNIT_TYPES.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Category</span>
                        <select
                          value={createItemForm.categoryId}
                          onChange={(event) =>
                            setCreateItemForm((current) => ({ ...current, categoryId: event.target.value }))
                          }
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Brand</span>
                        <select
                          value={createItemForm.brandId}
                          onChange={(event) =>
                            setCreateItemForm((current) => ({ ...current, brandId: event.target.value }))
                          }
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                        >
                          <option value="">No brand</option>
                          {brands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Cost price</p>
                        <input
                          value={createItemForm.costPrice}
                          onChange={(event) =>
                            setCreateItemForm((current) => ({ ...current, costPrice: event.target.value }))
                          }
                          placeholder="0.00"
                          inputMode="decimal"
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Selling price</p>
                        <input
                          value={createItemForm.sellingPrice}
                          onChange={(event) =>
                            setCreateItemForm((current) => ({ ...current, sellingPrice: event.target.value }))
                          }
                          placeholder="0.00"
                          inputMode="decimal"
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Discount price</p>
                      <input
                        value={createItemForm.discountPrice}
                        onChange={(event) =>
                          setCreateItemForm((current) => ({ ...current, discountPrice: event.target.value }))
                        }
                        placeholder="0.00"
                        inputMode="decimal"
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                      />
                    </div>
                    {/* Min stock by location */}
                    {allLocations.length > 0 && (
                      <div className="rounded-xl border border-line bg-surface p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Min stock by location <span className="normal-case font-normal">(optional)</span></p>
                        <div className="space-y-2">
                          {allLocations.map((l) => (
                            <div key={l.id} className="flex items-center gap-2">
                              <p className="flex-1 truncate text-xs font-medium text-ink">
                                {l.type === "WAREHOUSE" ? "🏭" : "🏪"} {l.name}
                              </p>
                              <input
                                type="number" min="0"
                                value={createMinValues[l.id] ?? ""}
                                onChange={(e) => setCreateMinValues((v) => ({ ...v, [l.id]: e.target.value }))}
                                placeholder="Min qty"
                                className="w-20 shrink-0 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-brand"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={createItem}
                      disabled={creatingItem}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      {creatingItem ? "Creating item..." : "Create item"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Category */}
      {activeTab === "category" && (
        <div className="xl:flex-1 xl:flex xl:flex-col xl:min-h-0">
          <div className="grid gap-5 xl:grid-cols-2 xl:flex-1 xl:min-h-0 xl:items-stretch">
            <div className="rounded-[28px] border border-line bg-white p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted xl:shrink-0">Catalog setup</p>
              <h3 className="mt-1 text-xl font-bold xl:shrink-0">New category</h3>
              <div className="mt-5 space-y-3">
                <input
                  value={createCategoryForm.name}
                  onChange={(event) =>
                    setCreateCategoryForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Category name"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                />
                <input
                  value={createCategoryForm.description}
                  onChange={(event) =>
                    setCreateCategoryForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Description (optional)"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={createCategory}
                  disabled={creatingCategory}
                  className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingCategory ? "Creating category..." : "Create category"}
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-line bg-white p-5 xl:flex xl:flex-col xl:min-h-0">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted xl:shrink-0">All categories</p>
              <h3 className="mt-1 text-xl font-bold xl:shrink-0">Category list</h3>
              <div className="mt-4 space-y-2 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                {categories.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">No categories yet.</p>
                ) : categories.map((cat) => (
                  <div key={cat.id} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
                    <p className="font-semibold text-ink">{cat.name}</p>
                    {cat.description && <p className="mt-0.5 text-xs text-muted">{cat.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Brand */}
      {activeTab === "brand" && (
        <div className="xl:flex-1 xl:flex xl:flex-col xl:min-h-0">
          <div className="grid gap-5 xl:grid-cols-2 xl:flex-1 xl:min-h-0 xl:items-stretch">
            <div className="rounded-[28px] border border-line bg-white p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted xl:shrink-0">Catalog setup</p>
              <h3 className="mt-1 text-xl font-bold xl:shrink-0">New brand</h3>
              <div className="mt-5 space-y-3">
                <input
                  value={createBrandForm.name}
                  onChange={(event) =>
                    setCreateBrandForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Brand name"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                />
                <input
                  value={createBrandForm.description}
                  onChange={(event) =>
                    setCreateBrandForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Description (optional)"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={createBrand}
                  disabled={creatingBrand}
                  className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingBrand ? "Creating brand..." : "Create brand"}
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-line bg-white p-5 xl:flex xl:flex-col xl:min-h-0">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted xl:shrink-0">All brands</p>
              <h3 className="mt-1 text-xl font-bold xl:shrink-0">Brand list</h3>
              <div className="mt-4 space-y-2 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                {brands.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">No brands yet.</p>
                ) : brands.map((brand) => (
                  <div key={brand.id} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
                    <p className="font-semibold text-ink">{brand.name}</p>
                    {brand.description && <p className="mt-0.5 text-xs text-muted">{brand.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Tab: Restock */}
      {activeTab === "restock" && (
        <div className="xl:flex-1 xl:flex xl:flex-col xl:min-h-0">
          <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr] xl:flex-1 xl:min-h-0 xl:items-stretch">

            {/* Left: settings + add-line form */}
            <div className="rounded-[28px] border border-line bg-white p-5 xl:flex xl:flex-col xl:min-h-0 xl:overflow-y-auto">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Bulk stock operation</p>
              <h3 className="mt-1 text-xl font-bold">Restock batch</h3>

              {/* Mode selector */}
              <div className="mt-4 flex rounded-xl border border-line bg-surface p-0.5 gap-0.5">
                {(["purchase", "adjust", "transfer"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => { setRestockMode(m); setBulkLines([]); }}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition ${restockMode === m ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}>
                    {m === "purchase" ? "Purchase" : m === "adjust" ? "Adjust" : "Transfer"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                {restockMode === "purchase" && "Receive new stock from a supplier into a warehouse. All lines go to the same warehouse."}
                {restockMode === "adjust" && "Set exact quantities per location. Each line can have its own location."}
                {restockMode === "transfer" && "Move stock between locations. All lines share the same from → to route."}
              </p>

              {/* Shared location(s) */}
              <div className="mt-4 space-y-2">
                {restockMode === "purchase" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Destination warehouse</label>
                    <select value={sharedLocationId}
                      onChange={(e) => { setSharedLocationId(e.target.value); setSharedLocationType("WAREHOUSE"); }}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                      <option value="">Select warehouse…</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>🏭 {w.name}</option>)}
                    </select>
                  </div>
                )}
                {restockMode === "transfer" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">From location</label>
                      <select value={sharedLocationId}
                        onChange={(e) => { const l = allLocations.find((x) => x.id === e.target.value); setSharedLocationId(e.target.value); if (l) setSharedLocationType(l.type); }}
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                        <option value="">Select source…</option>
                        {allLocations.map((l) => <option key={l.id} value={l.id}>{l.type === "WAREHOUSE" ? "🏭" : "🏪"} {l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">To location</label>
                      <select value={sharedToId}
                        onChange={(e) => { const l = allLocations.find((x) => x.id === e.target.value); setSharedToId(e.target.value); if (l) setSharedToType(l.type); }}
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                        <option value="">Select destination…</option>
                        {allLocations.filter((l) => l.id !== sharedLocationId).map((l) => <option key={l.id} value={l.id}>{l.type === "WAREHOUSE" ? "🏭" : "🏪"} {l.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-line" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Add item to batch</p>

              <div className="mt-2 space-y-2">
                {/* Searchable item combobox */}
                <div className="relative">
                  <input
                    type="text"
                    value={addItemSearch}
                    onChange={(e) => { setAddItemSearch(e.target.value); setAddItemId(""); setAddItemOpen(true); }}
                    onFocus={() => setAddItemOpen(true)}
                    onBlur={() => setTimeout(() => setAddItemOpen(false), 150)}
                    placeholder="Search items by name or SKU…"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  />
                  {addItemOpen && (() => {
                    const q = addItemSearch.trim().toLowerCase();
                    const filtered = q
                      ? items.filter((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q))
                      : items;
                    const totalQty = rows.reduce<Record<string, number>>((acc, r) => {
                      acc[r.itemId] = (acc[r.itemId] ?? 0) + r.quantity;
                      return acc;
                    }, {});
                    return filtered.length > 0 ? (
                      <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-white shadow-lg">
                        {filtered.map((it) => {
                          const qty = totalQty[it.id] ?? 0;
                          const isLow = rows.some((r) => r.itemId === it.id && r.quantity <= r.minQuantity);
                          return (
                            <li key={it.id}>
                              <button
                                type="button"
                                onMouseDown={() => { setAddItemId(it.id); setAddItemSearch(`${it.name} (${it.sku})`); setAddItemOpen(false); }}
                                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface ${
                                  addItemId === it.id ? "bg-brand/10 font-semibold text-brand" : "text-ink"
                                }`}
                              >
                                <div className="min-w-0">
                                  <span className="font-medium">{it.name}</span>
                                  <span className="ml-2 font-mono text-xs text-muted">{it.sku}</span>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  qty === 0 ? "bg-gray-100 text-gray-500" :
                                  isLow ? "bg-rose-100 text-rose-700" :
                                  "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {qty} in stock
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-muted shadow-lg">
                        No items match &ldquo;{addItemSearch}&rdquo;
                      </div>
                    );
                  })()}
                </div>

                {/* Per-line location for adjust mode */}
                {restockMode === "adjust" && (
                  <select value={addLocId}
                    onChange={(e) => { const l = allLocations.find((x) => x.id === e.target.value); setAddLocId(e.target.value); if (l) setAddLocType(l.type); }}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                    <option value="">Select location…</option>
                    {allLocations.map((l) => <option key={l.id} value={l.id}>{l.type === "WAREHOUSE" ? "🏭" : "🏪"} {l.name}</option>)}
                  </select>
                )}

                <div className="flex gap-2">
                  <input type="number" min="1" value={addQty} onChange={(e) => setAddQty(e.target.value)}
                    placeholder={restockMode === "adjust" ? "New qty" : "Qty to add"}
                    className="w-28 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                  <input type="text" value={addNote} onChange={(e) => setAddNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" />
                </div>

                <button type="button" onClick={addBulkLine}
                  className="btn-secondary w-full">
                  + Add to batch
                </button>
              </div>
            </div>

            {/* Right: batch queue + submit */}
            <div className="rounded-[28px] border border-line bg-white p-5 xl:flex xl:flex-col xl:min-h-0">
              <div className="flex items-center justify-between xl:shrink-0">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Batch queue</p>
                  <h3 className="mt-1 text-xl font-bold">
                    {bulkLines.length === 0 ? "No items yet" : `${bulkLines.length} item${bulkLines.length !== 1 ? "s" : ""} queued`}
                  </h3>
                </div>
                {bulkLines.length > 0 && (
                  <button type="button" onClick={() => setBulkLines([])}
                    className="text-xs text-muted hover:text-rose-600 transition">
                    Clear all
                  </button>
                )}
              </div>

              {/* Low-stock quick-add reference */}
              {bulkLines.length === 0 && rows.filter((r) => r.quantity <= r.minQuantity).length > 0 && (
                <div className="mt-4 xl:shrink-0">
                  <p className="text-xs font-medium text-muted mb-2">Quick-add low-stock items:</p>
                  <div className="flex flex-wrap gap-2">
                    {rows.filter((r) => r.quantity <= r.minQuantity).slice(0, 8).map((r) => (
                      <button key={`${r.locationType}-${r.id}`} type="button"
                        onClick={() => addLowStockToBatch(r)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100">
                        {r.name} <span className="opacity-60">({r.quantity}/{r.minQuantity})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Line items */}
              <div className="mt-4 xl:flex-1 xl:overflow-y-auto xl:pr-1 space-y-2">
                {bulkLines.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted text-center">
                    Add items using the form on the left. Low-stock items appear above as quick-add chips.
                  </p>
                ) : bulkLines.map((line, idx) => {
                  const item = items.find((i) => i.id === line.itemId);
                  const locName = allLocations.find((l) => l.id === line.locationId)?.name ?? "—";
                  return (
                    <div key={line.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                      <span className="w-6 shrink-0 text-center text-xs font-mono text-muted">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{item?.name ?? "Unknown"}</p>
                        <p className="truncate text-xs text-muted font-mono">
                          {item?.sku} · {restockMode === "adjust" ? locName : ""}
                          {line.note && ` · ${line.note}`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        restockMode === "adjust" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {restockMode === "adjust" ? `→ ${line.qty}` : `+${line.qty}`}
                      </span>
                      <button type="button" onClick={() => removeLine(line.id)}
                        className="shrink-0 text-muted hover:text-rose-600 transition text-sm">
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Submit */}
              <div className="mt-4 xl:shrink-0 space-y-2">
                {bulkLines.length > 0 && (
                  <div className="rounded-xl bg-surface px-4 py-3 text-xs text-muted">
                    <span className="font-semibold text-ink">{bulkLines.length} line{bulkLines.length !== 1 ? "s" : ""}</span>
                    {" · "}
                    {restockMode === "purchase" && `Purchase → ${warehouses.find((w) => w.id === sharedLocationId)?.name ?? "warehouse"}`}
                    {restockMode === "adjust" && "Manual adjustment per location"}
                    {restockMode === "transfer" && `Transfer: ${allLocations.find((l) => l.id === sharedLocationId)?.name ?? "?"} → ${allLocations.find((l) => l.id === sharedToId)?.name ?? "?"}`}
                  </div>
                )}
                <button type="button" onClick={handleBulkSubmit} disabled={restocking || bulkLines.length === 0}
                  className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
                  {restocking ? `Processing ${bulkLines.length} item${bulkLines.length !== 1 ? "s" : ""}…` : `Submit batch (${bulkLines.length})`}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <CameraBarcodeScannerModal
        open={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onDetected={(code) => {
          setSearch(code);
          stockSearchInputRef.current?.focus();
        }}
        title="Scan stock barcode"
      />
    </div>
  );
}
