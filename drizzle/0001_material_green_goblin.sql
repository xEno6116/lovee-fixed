CREATE TABLE `media_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('image','video') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` text NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pinHash` varchar(64) NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`memoryMessage` text NOT NULL,
	`musicUrl` text NOT NULL,
	`birthdayGreeting` varchar(240) NOT NULL,
	`birthdayWishes` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user';