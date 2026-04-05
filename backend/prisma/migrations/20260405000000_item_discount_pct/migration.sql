ALTER TABLE `items` ADD COLUMN `discount_pct` DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER `selling_price`;
