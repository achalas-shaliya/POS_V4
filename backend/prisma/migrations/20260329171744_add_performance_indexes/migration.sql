-- CreateIndex
CREATE INDEX `cash_movements_register_id_created_at_idx` ON `cash_movements`(`register_id`, `created_at`);

-- CreateIndex
CREATE INDEX `cash_movements_register_id_type_created_at_idx` ON `cash_movements`(`register_id`, `type`, `created_at`);

-- CreateIndex
CREATE INDEX `cash_registers_status_opened_by_id_idx` ON `cash_registers`(`status`, `opened_by_id`);

-- CreateIndex
CREATE INDEX `cash_registers_status_outlet_id_idx` ON `cash_registers`(`status`, `outlet_id`);

-- CreateIndex
CREATE INDEX `cash_registers_status_opened_at_idx` ON `cash_registers`(`status`, `opened_at`);

-- CreateIndex
CREATE INDEX `items_is_active_name_idx` ON `items`(`is_active`, `name`);

-- CreateIndex
CREATE INDEX `payment_transactions_entity_type_created_at_idx` ON `payment_transactions`(`entity_type`, `created_at`);

-- CreateIndex
CREATE INDEX `payment_transactions_sale_id_created_at_idx` ON `payment_transactions`(`sale_id`, `created_at`);

-- CreateIndex
CREATE INDEX `payment_transactions_repair_job_id_created_at_idx` ON `payment_transactions`(`repair_job_id`, `created_at`);

-- CreateIndex
CREATE INDEX `repair_jobs_status_outlet_id_created_at_idx` ON `repair_jobs`(`status`, `outlet_id`, `created_at`);

-- CreateIndex
CREATE INDEX `repair_jobs_technician_id_status_created_at_idx` ON `repair_jobs`(`technician_id`, `status`, `created_at`);

-- CreateIndex
CREATE INDEX `repair_jobs_customer_id_created_at_idx` ON `repair_jobs`(`customer_id`, `created_at`);

-- CreateIndex
CREATE INDEX `sale_returns_status_created_at_idx` ON `sale_returns`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `sale_returns_outlet_id_status_created_at_idx` ON `sale_returns`(`outlet_id`, `status`, `created_at`);

-- CreateIndex
CREATE INDEX `sale_returns_sale_id_status_idx` ON `sale_returns`(`sale_id`, `status`);

-- CreateIndex
CREATE INDEX `sales_status_outlet_id_created_at_idx` ON `sales`(`status`, `outlet_id`, `created_at`);

-- CreateIndex
CREATE INDEX `sales_outlet_id_created_at_idx` ON `sales`(`outlet_id`, `created_at`);

-- CreateIndex
CREATE INDEX `sales_cashier_id_created_at_idx` ON `sales`(`cashier_id`, `created_at`);

-- CreateIndex
CREATE INDEX `sales_customer_id_created_at_idx` ON `sales`(`customer_id`, `created_at`);

-- CreateIndex
CREATE INDEX `stock_movements_item_id_created_at_idx` ON `stock_movements`(`item_id`, `created_at`);

-- CreateIndex
CREATE INDEX `stock_movements_movement_type_created_at_idx` ON `stock_movements`(`movement_type`, `created_at`);

-- CreateIndex
CREATE INDEX `stock_transfers_status_created_at_idx` ON `stock_transfers`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `stock_transfers_from_id_created_at_idx` ON `stock_transfers`(`from_id`, `created_at`);

-- CreateIndex
CREATE INDEX `stock_transfers_to_id_created_at_idx` ON `stock_transfers`(`to_id`, `created_at`);
