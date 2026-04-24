-- =============================================
-- 0008: ログイン履歴テーブルの追加
-- ログインのたびに記録し、先生が生徒のアクセス状況を確認できる
-- =============================================

CREATE TABLE IF NOT EXISTS login_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  logged_in_at DATETIME NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_logged_in_at ON login_logs(logged_in_at);
