-- Published entry count per all-time board, written with each generation.
-- NULL for generations published before this release; readers count those.
ALTER TABLE `leaderboard_generations` ADD `entries` integer;
