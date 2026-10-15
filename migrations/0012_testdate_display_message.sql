-- ローカル開発用。0011に対する独立追加。本番未適用。
ALTER TABLE shared_test_date ADD COLUMN display_message TEXT NOT NULL DEFAULT '';
ALTER TABLE shared_test_date ADD COLUMN message_visible INTEGER NOT NULL DEFAULT 1 CHECK(message_visible IN (0,1));
