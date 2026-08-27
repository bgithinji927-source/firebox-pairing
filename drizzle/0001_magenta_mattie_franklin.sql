CREATE TABLE `pairing_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requesterOpenId` varchar(64) NOT NULL,
	`requesterName` text,
	`status` enum('pending','approved','revoked') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pairing_access_id` PRIMARY KEY(`id`),
	CONSTRAINT `pairing_access_requesterOpenId_unique` UNIQUE(`requesterOpenId`)
);
--> statement-breakpoint
CREATE TABLE `pairing_requests` (
	`id` varchar(32) NOT NULL,
	`requesterOpenId` varchar(64) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`status` enum('pending','linked','expired','failed') NOT NULL,
	`expiresAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`linkedAt` timestamp,
	CONSTRAINT `pairing_requests_id` PRIMARY KEY(`id`)
);
