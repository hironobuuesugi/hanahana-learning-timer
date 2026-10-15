-- 0010適用済み構造への独立した追加。0009/0010を再適用しない。
-- 本番未適用。共通設定は初期状態で非表示、個別日付は一切変更しない。
CREATE TABLE shared_test_date (
  id INTEGER PRIMARY KEY CHECK(id=1),
  test_date TEXT,
  is_visible INTEGER NOT NULL DEFAULT 0 CHECK(is_visible IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  CHECK(is_visible=0 OR test_date IS NOT NULL)
);
INSERT INTO shared_test_date(id) VALUES(1);

ALTER TABLE study_sessions ADD COLUMN saved_at TEXT;
ALTER TABLE study_sessions ADD COLUMN history_tracked INTEGER NOT NULL DEFAULT 0;

-- 計算用pauseログが凍結再開でリセットされても、実際の休憩履歴を保持。
CREATE TABLE study_pause_history (
  original_pause_id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  pause_at TEXT NOT NULL,
  resume_at TEXT
);
CREATE INDEX idx_study_pause_history_session ON study_pause_history(session_id);
INSERT INTO study_pause_history SELECT id,session_id,pause_at,resume_at FROM session_pauses;
CREATE TRIGGER preserve_study_pause_insert AFTER INSERT ON session_pauses BEGIN
  INSERT INTO study_pause_history(original_pause_id,session_id,pause_at,resume_at)
  VALUES(NEW.id,NEW.session_id,NEW.pause_at,NEW.resume_at);
END;
CREATE TRIGGER preserve_study_pause_update AFTER UPDATE OF resume_at ON session_pauses BEGIN
  UPDATE study_pause_history SET resume_at=NEW.resume_at WHERE original_pause_id=NEW.id;
END;

-- 従来の先生全体の既読基点は保持し、それ以降の生徒別既読位置を記録。
CREATE TABLE teacher_student_event_reads (
  teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_event_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(teacher_user_id,student_user_id)
);
