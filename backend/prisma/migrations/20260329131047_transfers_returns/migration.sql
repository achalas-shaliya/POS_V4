-- CreateTable
CREATE TABLE `stock_transfers` (
    `id` VARCHAR(36) NOT NULL,
    `transfer_no` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'DISPATCHED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `note` VARCHAR(500) NULL,
    `from_type` ENUM('WAREHOUSE', 'OUTLET') NOT NULL,
    `from_id` VARCHAR(36) NOT NULL,
    `to_type` ENUM('WAREHOUSE', 'OUTLET') NOT NULL,
    `to_id` VARCHAR(36) NOT NULL,
    `dispatched_at` DATETIME(3) NULL,
    `received_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `requested_by_id` VARCHAR(36) NOT NULL,
    `dispatched_by_id` VARCHAR(36) NULL,
    `received_by_id` VARCHAR(36) NULL,

    UNIQUE INDEX `stock_transfers_transfer_no_key`(`transfer_no`),
    INDEX `stock_transfers_status_idx`(`status`),
    INDEX `stock_transfers_from_id_idx`(`from_id`),
    INDEX `stock_transfers_to_id_idx`(`to_id`),
    INDEX `stock_transfers_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transfer_items` (
    `id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `received_qty` INTEGER NOT NULL DEFAULT 0,
    `transfer_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,

    INDEX `stock_transfer_items_transfer_id_idx`(`transfer_id`),
    INDEX `stock_transfer_items_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_returns` (
    `id` VARCHAR(36) NOT NULL,
    `return_no` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reason` ENUM('DEFECTIVE', 'WRONG_ITEM', 'CUSTOMER_CHANGE_MIND', 'DAMAGED_IN_TRANSIT', 'OTHER') NOT NULL,
    `note` VARCHAR(500) NULL,
    `refund_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `sale_id` VARCHAR(36) NOT NULL,
    `outlet_id` VARCHAR(36) NOT NULL,
    `created_by_id` VARCHAR(36) NOT NULL,
    `processed_by_id` VARCHAR(36) NULL,

    UNIQUE INDEX `sale_returns_return_no_key`(`return_no`),
    INDEX `sale_returns_status_idx`(`status`),
    INDEX `sale_returns_sale_id_idx`(`sale_id`),
    INDEX `sale_returns_outlet_id_idx`(`outlet_id`),
    INDEX `sale_returns_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_return_items` (
    `id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `return_id` VARCHAR(36) NOT NULL,
    `sale_item_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,

    INDEX `sale_return_items_return_id_idx`(`return_id`),
    INDEX `sale_return_items_sale_item_id_idx`(`sale_item_id`),
    INDEX `sale_return_items_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_dispatched_by_id_fkey` FOREIGN KEY (`dispatched_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_received_by_id_fkey` FOREIGN KEY (`received_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_transfer_id_fkey` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transfer_items` ADD CONSTRAINT `stock_transfer_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_outlet_id_fkey` FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_processed_by_id_fkey` FOREIGN KEY (`processed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_return_id_fkey` FOREIGN KEY (`return_id`) REFERENCES `sale_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_sale_item_id_fkey` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
