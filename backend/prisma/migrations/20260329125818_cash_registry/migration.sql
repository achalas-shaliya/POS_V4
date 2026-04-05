-- CreateTable
CREATE TABLE `cash_registers` (
    `id` VARCHAR(36) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `opening_balance` DECIMAL(12, 2) NOT NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_cash` DECIMAL(12, 2) NULL,
    `actual_cash` DECIMAL(12, 2) NULL,
    `difference` DECIMAL(12, 2) NULL,
    `closing_note` VARCHAR(500) NULL,
    `closed_at` DATETIME(3) NULL,
    `outlet_id` VARCHAR(36) NOT NULL,
    `opened_by_id` VARCHAR(36) NOT NULL,
    `closed_by_id` VARCHAR(36) NULL,

    INDEX `cash_registers_status_idx`(`status`),
    INDEX `cash_registers_outlet_id_idx`(`outlet_id`),
    INDEX `cash_registers_opened_by_id_idx`(`opened_by_id`),
    INDEX `cash_registers_opened_at_idx`(`opened_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_movements` (
    `id` VARCHAR(36) NOT NULL,
    `type` ENUM('SALE_CASH', 'REPAIR_CASH', 'CASH_IN', 'CASH_OUT', 'OPENING_FLOAT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `note` VARCHAR(255) NULL,
    `reference_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `register_id` VARCHAR(36) NOT NULL,
    `created_by_id` VARCHAR(36) NOT NULL,

    INDEX `cash_movements_register_id_idx`(`register_id`),
    INDEX `cash_movements_type_idx`(`type`),
    INDEX `cash_movements_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cash_registers` ADD CONSTRAINT `cash_registers_outlet_id_fkey` FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_registers` ADD CONSTRAINT `cash_registers_opened_by_id_fkey` FOREIGN KEY (`opened_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_registers` ADD CONSTRAINT `cash_registers_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_register_id_fkey` FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
