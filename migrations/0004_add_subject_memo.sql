-- =============================================
-- 花はな Learning Timer - 教科・メモカラム追加
-- =============================================
--
-- 変更内容:
--   study_sessions に subject（教科）と memo（勉強内容）カラムを追加
--
-- subject:
--   フィニッシュ後の記録画面で選択する教科
--   値: 'english' | 'math' | 'japanese' | 'science' | 'social' | 'other'
--   フィニッシュするまで NULL
--
-- memo:
--   フィニッシュ後の記録画面で入力する自由テキスト（勉強内容）
--   フィニッシュするまで NULL

ALTER TABLE study_sessions ADD COLUMN subject TEXT;
ALTER TABLE study_sessions ADD COLUMN memo TEXT;
