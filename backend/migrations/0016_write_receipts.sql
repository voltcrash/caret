CREATE TABLE `write_receipts` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `write_receipts_created_idx` ON `write_receipts` (`created_at`);
