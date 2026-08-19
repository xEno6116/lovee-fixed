CREATE TABLE IF NOT EXISTS `anniversary_sites` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ownerId` int NOT NULL,
  `slug` varchar(120) NOT NULL,
  `title` varchar(160) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `anniversary_sites_id` PRIMARY KEY(`id`),
  CONSTRAINT `anniversary_sites_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `site_settings` ADD `siteId` int NULL;
--> statement-breakpoint
ALTER TABLE `media_assets` ADD `siteId` int NULL;
--> statement-breakpoint
INSERT INTO `anniversary_sites` (`ownerId`, `slug`, `title`)
VALUES (1, 'main-memory', 'เว็บไซต์ความทรงจำหลัก')
ON DUPLICATE KEY UPDATE `ownerId` = VALUES(`ownerId`), `title` = VALUES(`title`);
--> statement-breakpoint
UPDATE `site_settings`
SET `siteId` = (SELECT `id` FROM `anniversary_sites` WHERE `slug` = 'main-memory' LIMIT 1)
WHERE `siteId` IS NULL;
--> statement-breakpoint
UPDATE `media_assets`
SET `siteId` = (SELECT `id` FROM `anniversary_sites` WHERE `slug` = 'main-memory' LIMIT 1)
WHERE `siteId` IS NULL;
--> statement-breakpoint
ALTER TABLE `site_settings` MODIFY `siteId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_assets` MODIFY `siteId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `site_settings` ADD CONSTRAINT `site_settings_siteId_unique` UNIQUE(`siteId`);
--> statement-breakpoint
ALTER TABLE `site_settings` DROP COLUMN `birthdayGreeting`;
--> statement-breakpoint
ALTER TABLE `site_settings` DROP COLUMN `birthdayWishes`;
