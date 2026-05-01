-- Add default outlet mapping to devices
ALTER TABLE `devices`
  ADD COLUMN `default_outlet_id` VARCHAR(36) NULL;

CREATE INDEX `devices_default_outlet_id_idx`
  ON `devices`(`default_outlet_id`);

ALTER TABLE `devices`
  ADD CONSTRAINT `devices_default_outlet_id_fkey`
  FOREIGN KEY (`default_outlet_id`) REFERENCES `outlets`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
