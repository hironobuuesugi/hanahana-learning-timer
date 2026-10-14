-- 第17段階の隔離DB専用。既存DB・本番では未適用。
-- 計測用started_atを残し、最初の開始日時をUTCで別に保存する。
-- 過去の真の開始日時は推測しない。移行時点の所属日をそのまま保全する。
-- 既存0001〜0008の後、一度だけ適用する。移行と旧新コードの切替は将来別承認。
ALTER TABLE study_sessions ADD COLUMN original_started_at TEXT;
UPDATE study_sessions SET original_started_at = started_at
WHERE original_started_at IS NULL;
