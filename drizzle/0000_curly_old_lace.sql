CREATE TABLE IF NOT EXISTS `agencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `agencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `agencies_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `external_databases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(20) NOT NULL DEFAULT 'mysql',
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL DEFAULT 3306,
	`username` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`database` varchar(255) NOT NULL,
	`is_active` int DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_databases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(255) NOT NULL,
	`password_hash` varchar(255),
	`thai_id` varchar(13),
	`full_name` varchar(255),
	`email` varchar(255),
	`phone` varchar(20),
	`role_id` int NOT NULL,
	`agency_id` int,
	`is_active` int DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_thai_id_unique` UNIQUE(`thai_id`),
	CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action,
	CONSTRAINT `users_agency_id_agencies_id_fk` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action
);
