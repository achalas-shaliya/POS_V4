-- CreateTable: item_price_tiers
CREATE TABLE `item_price_tiers` (
    `id` VARCHAR(36) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `cost_price` DECIMAL(12, 2) NOT NULL,
    `selling_price` DECIMAL(12, 2) NOT NULL,
    `discount_price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `quantity` INT NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(500) NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `created_by_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `item_price_tiers_item_id_idx`(`item_id`),
    INDEX `item_price_tiers_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: item_price_tiers → items
ALTER TABLE `item_price_tiers` ADD CONSTRAINT `item_price_tiers_item_id_fkey`
    FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: item_price_tiers → users
ALTER TABLE `item_price_tiers` ADD CONSTRAINT `item_price_tiers_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add tier_id to sale_items (nullable — existing rows have no tier)
ALTER TABLE `sale_items` ADD COLUMN `tier_id` VARCHAR(36) NULL;

CREATE INDEX `sale_items_tier_id_idx` ON `sale_items`(`tier_id`);

ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_tier_id_fkey`
    FOREIGN KEY (`tier_id`) REFERENCES `item_price_tiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
