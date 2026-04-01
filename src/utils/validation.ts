// =============================================
// 花はな Learning Timer - バリデーションユーティリティ
// =============================================

export type ValidationResult = {
  valid: boolean;
  error?: string;
}

/**
 * ユーザーIDのバリデーション
 * - 3〜20文字
 * - 英数字、アンダースコアのみ
 */
export function validateUserId(userId: string): ValidationResult {
  if (!userId || userId.trim().length === 0) {
    return { valid: false, error: 'ユーザーIDを入力してください' };
  }
  if (userId.length < 3) {
    return { valid: false, error: 'ユーザーIDは3文字以上で入力してください' };
  }
  if (userId.length > 20) {
    return { valid: false, error: 'ユーザーIDは20文字以内で入力してください' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(userId)) {
    return { valid: false, error: 'ユーザーIDは英数字とアンダースコアのみ使用できます' };
  }
  return { valid: true };
}

/**
 * パスワードのバリデーション
 * - 6〜50文字
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { valid: false, error: 'パスワードを入力してください' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'パスワードは6文字以上で入力してください' };
  }
  if (password.length > 50) {
    return { valid: false, error: 'パスワードは50文字以内で入力してください' };
  }
  return { valid: true };
}

/**
 * 表示名のバリデーション
 * - 1〜20文字
 */
export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName || displayName.trim().length === 0) {
    return { valid: false, error: '表示名を入力してください' };
  }
  if (displayName.trim().length > 20) {
    return { valid: false, error: '表示名は20文字以内で入力してください' };
  }
  return { valid: true };
}
