/*
  Warnings:

  - You are about to alter the column `country` on the `Analytics` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.
  - You are about to alter the column `city` on the `Analytics` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `device` on the `Analytics` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `browser` on the `Analytics` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `ipAddress` on the `Analytics` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(45)`.

*/
-- AlterTable
ALTER TABLE `Analytics` ADD COLUMN `os` VARCHAR(50) NULL,
    ADD COLUMN `referer` VARCHAR(255) NULL,
    MODIFY `country` VARCHAR(10) NULL,
    MODIFY `city` VARCHAR(100) NULL,
    MODIFY `device` VARCHAR(50) NULL,
    MODIFY `browser` VARCHAR(50) NULL,
    MODIFY `ipAddress` VARCHAR(45) NULL;

-- CreateIndex
CREATE INDEX `idx_analytics_url_clicked_at` ON `Analytics`(`urlId`, `clickedAt`);

-- CreateIndex
CREATE INDEX `idx_analytics_url_country` ON `Analytics`(`urlId`, `country`);

-- CreateIndex
CREATE INDEX `idx_analytics_url_device` ON `Analytics`(`urlId`, `device`);

-- CreateIndex
CREATE INDEX `Url_shortCode_idx` ON `Url`(`shortCode`);

-- RenameIndex
ALTER TABLE `Analytics` RENAME INDEX `Analytics_clickedAt_idx` TO `idx_analytics_clicked_at`;
