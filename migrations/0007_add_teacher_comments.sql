-- =============================================
-- 先生コメントテーブル
-- 今月ランキング Top5 に対する先生コメントを保存する
--
-- 制約:
--   - 先生アカウント (hiro0808) のみ保存可
--   - 1生徒につき1日1コメントまで (student_user_id + comment_date の UNIQUE)
--   - コメント文字数は 50文字以内 (アプリ側バリデーション)
--   - 当日分のみ表示（API側で comment_date = 今日(JST) でフィルタ）
-- =============================================

CREATE TABLE IF NOT EXISTS teacher_comments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  student_user_id     TEXT    NOT NULL,              -- コメント対象の生徒の user_id
  comment_text        TEXT    NOT NULL,              -- コメント本文 (50文字以内)
  comment_date        TEXT    NOT NULL,              -- JST日付 YYYY-MM-DD
  created_by_user_id  TEXT    NOT NULL DEFAULT 'hiro0808',  -- 作成者 (常に hiro0808)
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),

  -- 1生徒につき1日1コメントまで
  UNIQUE (student_user_id, comment_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_comments_date
  ON teacher_comments (comment_date);

CREATE INDEX IF NOT EXISTS idx_teacher_comments_student
  ON teacher_comments (student_user_id, comment_date);
