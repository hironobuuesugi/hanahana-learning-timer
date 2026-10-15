// =============================================
// 花はな Learning Timer - 型定義
// =============================================

// Cloudflare バインディング型
export type Bindings = {
  DB: D1Database;
  REGISTRATION_PASSWORD?: string; // サーバー側の保護された登録用設定
  TEACHER_USER_ID?: string;       // 既存先生アカウントを判定する保護された設定
  // 今後追加予定:
  // KV: KVNamespace;  // キャッシュ用
  // R2: R2Bucket;     // ファイルストレージ用
}

// アプリケーション変数型（リクエスト間で共有する値）
export type Variables = {
  userId: number;
  userInfo: UserRecord;
}

// データベースのユーザーレコード型
export type UserRecord = {
  id: number;
  user_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  is_active: number;
  archived_at: string | null;
  // 今後追加予定:
  // goal_minutes: number;
  // streak_days: number;
  // total_minutes: number;
  // last_study_date: string | null;
}

// セッションレコード型
export type SessionRecord = {
  id: number;
  session_token: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

// APIレスポンス型
export type ApiResponse<T = null> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ログイン後のユーザー情報レスポンス型
export type UserResponse = {
  id: number;
  user_id: string;
  display_name: string;
  created_at: string;
  is_teacher: boolean; // サーバーによる判定。画面の表示制御だけに使用する
  // 今後追加予定:
  // goal_minutes: number;
  // streak_days: number;
  // total_minutes: number;
}

// 認証レスポンス型
export type AuthResponse = {
  session_token: string;
  user: UserResponse;
}

// =============================================
// タイマー関連型
// =============================================

// セッション状態
export type StudySessionStatus = 'running' | 'paused' | 'frozen' | 'finished';

// 勉強セッションのDBレコード型
export type StudySessionRecord = {
  id: number;
  user_id: number;
  status: StudySessionStatus;
  started_at: string;        // 経過時間計算用の基準（凍結再開で調整）
  original_started_at: string | null; // 最初の開始日時。移行済み・新規記録ではUTCのISO8601
  frozen_at: string | null;
  finished_at: string | null;
  total_seconds: number;
  auto_stopped: number;      // 90分自動停止フラグ（1=自動停止）
  created_at: string;
  updated_at: string;
  time_limit_seconds: number;
  auto_stop_seconds: number | null;
  study_date: string | null;
  record_source: string;
  revision: number;
  operation_token: string | null;
  saved_at: string | null;
  history_tracked: number;
  subject: string | null;
  memo: string | null;
}

// 一時停止ログのDBレコード型
export type SessionPauseRecord = {
  id: number;
  session_id: number;
  pause_at: string;          // ISO8601
  resume_at: string | null;  // 一時停止中はNULL
}

// フロントエンドに返すタイマー状態型
// フロントはこのデータを元に経過時間を表示する
export type TimerStateResponse = {
  session_id: number;
  status: StudySessionStatus;
  started_at: string; // 経過時間計算用
  original_started_at: string; // 所属日・表示用（UTC保存、JSTで判定）
  frozen_at: string | null;
  finished_at: string | null;
  total_seconds: number;     // フィニッシュ時に確定した秒数
  auto_stopped: number;      // 90分自動停止フラグ（1=自動停止）
  time_limit_seconds: number;
  auto_stop_seconds: number | null;
  revision: number;
  // 一時停止ログ（フロントでの経過時間計算に使用）
  pauses: Array<{
    pause_at: string;
    resume_at: string | null;
  }>;
}
