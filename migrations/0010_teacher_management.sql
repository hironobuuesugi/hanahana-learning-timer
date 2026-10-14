-- 開発用追加仕様。0009とは独立。本番では未適用。
-- 自動migrations applyは禁止。適用済み0009を再実行しない。
ALTER TABLE study_sessions ADD COLUMN time_limit_seconds INTEGER NOT NULL DEFAULT 5400;
ALTER TABLE study_sessions ADD COLUMN auto_stop_seconds INTEGER;
ALTER TABLE study_sessions ADD COLUMN study_date TEXT;
ALTER TABLE study_sessions ADD COLUMN record_source TEXT NOT NULL DEFAULT 'timer';
ALTER TABLE study_sessions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN operation_token TEXT;
ALTER TABLE users ADD COLUMN archived_at TEXT;
ALTER TABLE users ADD COLUMN management_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE management_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  target_user_id INTEGER,
  session_id INTEGER,
  action TEXT NOT NULL,
  request_key TEXT UNIQUE,
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_management_events_target ON management_events(target_user_id, id);
CREATE INDEX idx_management_events_session ON management_events(session_id, id);
CREATE INDEX idx_management_events_action ON management_events(action, id);

-- サーバー保存の既読位置。PC・Mac・スマホで同じ先生の確認状態を共有。
CREATE TABLE teacher_event_reads (
  teacher_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_event_id INTEGER NOT NULL DEFAULT 0,
  delete_target_id INTEGER,
  delete_target_revision INTEGER,
  delete_token_hash TEXT,
  delete_expires_at TEXT
);

-- 旧自動停止も閲覧可能にする。元の計測時間は推測しない。
INSERT INTO management_events(target_user_id,session_id,action,after_json,occurred_at)
SELECT user_id,id,'auto_stop',json_object('legacy',1,'total_seconds',total_seconds),COALESCE(finished_at,updated_at)
FROM study_sessions WHERE auto_stopped=1;
-- 過去の履歴を導入時の新着にしない。
INSERT INTO teacher_event_reads(teacher_user_id,last_event_id)
SELECT id,(SELECT COALESCE(MAX(id),0) FROM management_events) FROM users;
