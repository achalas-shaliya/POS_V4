-- CreateTable
CREATE TABLE `repair_jobs` (
    `id` VARCHAR(36) NOT NULL,
    `job_no` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `device_brand` VARCHAR(80) NOT NULL,
    `device_model` VARCHAR(80) NOT NULL,
    `device_color` VARCHAR(40) NULL,
    `serial_no` VARCHAR(100) NULL,
    `condition` VARCHAR(255) NULL,
    `problem_desc` TEXT NOT NULL,
    `diagnosis` TEXT NULL,
    `internal_note` VARCHAR(500) NULL,
    `labor_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `advance_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `estimated_done` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `outlet_id` VARCHAR(36) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `technician_id` VARCHAR(36) NULL,
    `created_by_id` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `repair_jobs_job_no_key`(`job_no`),
    INDEX `repair_jobs_status_idx`(`status`),
    INDEX `repair_jobs_outlet_id_idx`(`outlet_id`),
    INDEX `repair_jobs_customer_id_idx`(`customer_id`),
    INDEX `repair_jobs_technician_id_idx`(`technician_id`),
    INDEX `repair_jobs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repair_parts` (
    `id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_cost` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `repair_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `added_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `repair_parts_repair_id_idx`(`repair_id`),
    INDEX `repair_parts_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repair_status_logs` (
    `id` VARCHAR(36) NOT NULL,
    `from_status` ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'DELIVERED', 'CANCELLED') NULL,
    `to_status` ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'DELIVERED', 'CANCELLED') NOT NULL,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `repair_id` VARCHAR(36) NOT NULL,
    `changed_by_id` VARCHAR(36) NOT NULL,

    INDEX `repair_status_logs_repair_id_idx`(`repair_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repair_advances` (
    `id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('CASH', 'CARD') NOT NULL,
    `reference` VARCHAR(100) NULL,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `repair_id` VARCHAR(36) NOT NULL,

    INDEX `repair_advances_repair_id_idx`(`repair_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_outlet_id_fkey` FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_technician_id_fkey` FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_jobs` ADD CONSTRAINT `repair_jobs_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_parts` ADD CONSTRAINT `repair_parts_repair_id_fkey` FOREIGN KEY (`repair_id`) REFERENCES `repair_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_parts` ADD CONSTRAINT `repair_parts_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_status_logs` ADD CONSTRAINT `repair_status_logs_repair_id_fkey` FOREIGN KEY (`repair_id`) REFERENCES `repair_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_status_logs` ADD CONSTRAINT `repair_status_logs_changed_by_id_fkey` FOREIGN KEY (`changed_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repair_advances` ADD CONSTRAINT `repair_advances_repair_id_fkey` FOREIGN KEY (`repair_id`) REFERENCES `repair_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
