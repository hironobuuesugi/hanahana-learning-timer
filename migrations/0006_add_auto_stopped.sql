-- =============================================
-- マイグレーション 0006: auto_stopped カラム追加
-- 90分自動停止フラグ（1=自動停止、0=通常停止）
-- =============================================

ALTER TABLE study_sessions ADD COLUMN auto_stopped INTEGER NOT NULL DEFAULT 0;

-- インデックス: 今月の自動停止回数を高速集計するため
CREATE INDEX IF NOT EXISTS idx_study_sessions_auto_stopped
  ON study_sessions (user_id, auto_stopped, started_at);
