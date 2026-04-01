// =============================================
// 花はな Learning Timer - 型定義
// =============================================

// Cloudflare バインディング型
export type Bindings = {
  DB: D1Database;
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
