/*
  Warnings:

  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `repair_advances` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_sale_id_fkey`;

-- DropForeignKey
ALTER TABLE `repair_advances` DROP FOREIGN KEY `repair_advances_repair_id_fkey`;

-- DropTable
DROP TABLE `payments`;

-- DropTable
DROP TABLE `repair_advances`;

-- CreateTable
CREATE TABLE `payment_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `tx_no` VARCHAR(30) NOT NULL,
    `entity_type` ENUM('SALE', 'REPAIR') NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `total_change` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `note` VARCHAR(255) NULL,
    `sale_id` VARCHAR(36) NULL,
    `repair_job_id` VARCHAR(36) NULL,
    `created_by_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_transactions_tx_no_key`(`tx_no`),
    INDEX `payment_transactions_entity_type_idx`(`entity_type`),
    INDEX `payment_transactions_sale_id_idx`(`sale_id`),
    INDEX `payment_transactions_repair_job_id_idx`(`repair_job_id`),
    INDEX `payment_transactions_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_legs` (
    `id` VARCHAR(36) NOT NULL,
    `method` ENUM('CASH', 'CARD') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `change` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `reference` VARCHAR(100) NULL,
    `transaction_id` VARCHAR(36) NOT NULL,

    INDEX `payment_legs_transaction_id_idx`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_repair_job_id_fkey` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_legs` ADD CONSTRAINT `payment_legs_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
