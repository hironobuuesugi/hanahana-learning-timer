-- 第2段階の独立追加。既存記録はallocation_version=0（従来の均等配分）のまま保全する。
-- 本番未適用。0009〜0012を再適用しない。
ALTER TABLE study_sessions ADD COLUMN allocation_version INTEGER NOT NULL DEFAULT 0 CHECK(allocation_version IN (0,1));
ALTER TABLE study_sessions ADD COLUMN subject_allocations TEXT CHECK(subject_allocations IS NULL OR json_valid(subject_allocations));
