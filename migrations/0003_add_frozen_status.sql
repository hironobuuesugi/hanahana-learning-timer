-- =============================================
-- 花はな Learning Timer - 凍結状態対応
-- =============================================
--
-- 変更内容:
--   study_sessions.status に 'frozen'（確認待ち）を追加
--   study_sessions.frozen_at カラムを追加
--
-- frozen 状態の意味:
--   ユーザーが「ホームへ戻る」「ブラウザを閉じる」など
--   タイマーを意図せず離れた場合の状態。
--   この状態になった時点で total_seconds を確定保存し、
--   以降はタイマーを進めない。
--
-- frozen_at:
--   凍結した時刻。再開ボタンを押した時に
--   「frozen_at から再開したことにする」ために使用。
--   （= 確認待ち中の時間を加算しないための基準点）

ALTER TABLE study_sessions ADD COLUMN frozen_at TEXT;
