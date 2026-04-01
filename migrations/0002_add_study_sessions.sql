-- =============================================
-- 花はな Learning Timer - 勉強セッションテーブル
-- =============================================
--
-- 設計方針:
--   時刻データをすべて保存し、サーバー側で正確な勉強時間を計算する。
--   「タイマーは画面で秒を数えるだけ」ではなく、
--   開始・一時停止・再開・終了の時刻をDBに記録することで
--   ブラウザを閉じても状態を復元できる構造にする。
--
-- 今後の拡張予定:
--   - subject カラム追加（教科選択）
--   - memo カラム追加（メモ）
--   - ブラウザ再起動後のセッション復元機能

-- 勉強セッションテーブル
-- 1行 = 1回の勉強セッション（スタート〜フィニッシュ）
CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,               -- users.id への外部キー

  -- セッション状態: 'running' | 'paused' | 'finished'
  status TEXT NOT NULL DEFAULT 'running',

  -- 開始・終了時刻（ISO8601形式で保存）
  started_at TEXT NOT NULL,               -- スタートした時刻
  finished_at TEXT,                       -- フィニッシュした時刻（未終了はNULL）

  -- 累計勉強秒数（フィニッシュ時に確定）
  -- 一時停止中の時間を除いた「実際に勉強した秒数」
  total_seconds INTEGER NOT NULL DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 一時停止・再開ログテーブル
-- 1行 = 1回の一時停止区間（pause_at〜resume_at）
-- 複数回の一時停止にも対応。再開前はresume_atがNULL。
CREATE TABLE IF NOT EXISTS session_pauses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,            -- study_sessions.id への外部キー
  pause_at TEXT NOT NULL,                 -- 一時停止した時刻
  resume_at TEXT,                         -- 再開した時刻（一時停止中はNULL）
  FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id   ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_status     ON study_sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_pauses_session_id ON session_pauses(session_id);
