-- =============================================
-- 花はな Learning Timer - 初期スキーマ
-- =============================================

-- ユーザーテーブル
-- 今後の機能拡張を考慮した設計
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,           -- ログイン用ユーザーID
  password_hash TEXT NOT NULL,            -- パスワードハッシュ（SHA-256）
  display_name TEXT NOT NULL,             -- 表示名（ニックネーム）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- 今後追加予定のカラム用コメント
  -- goal_minutes INTEGER DEFAULT 60,     -- 1日の目標勉強時間（分）
  -- streak_days INTEGER DEFAULT 0,       -- 連続勉強日数
  -- total_minutes INTEGER DEFAULT 0,     -- 累計勉強時間（分）
  -- last_study_date DATE                 -- 最後に勉強した日付
  is_active INTEGER DEFAULT 1             -- アカウント有効フラグ（1=有効, 0=無効）
);

-- セッションテーブル
-- JWTなしでもシンプルにセッション管理できるよう準備
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,     -- セッショントークン
  user_id INTEGER NOT NULL,              -- users.id への外部キー
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,          -- セッション有効期限
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 将来の勉強記録テーブル（今回は未使用、設計のみ）
-- CREATE TABLE IF NOT EXISTS study_records (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   user_id INTEGER NOT NULL,
--   subject TEXT NOT NULL,               -- 勉強科目
--   duration_minutes INTEGER NOT NULL,   -- 勉強時間（分）
--   study_date DATE NOT NULL,            -- 勉強日
--   memo TEXT,                           -- メモ
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
