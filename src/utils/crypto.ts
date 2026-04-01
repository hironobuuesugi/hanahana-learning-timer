// =============================================
// 花はな Learning Timer - 暗号化ユーティリティ
// Cloudflare Workers対応（Web Crypto API使用）
// =============================================

/**
 * パスワードをSHA-256でハッシュ化する
 * Cloudflare WorkersではNode.js cryptoモジュールが使えないため
 * Web Crypto APIを使用
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * パスワードを検証する
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

/**
 * セッショントークンを生成する（ランダムな32バイト = 64文字の16進数）
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * セッション有効期限を計算する（デフォルト: 7日後）
 */
export function getSessionExpiry(days: number = 7): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry.toISOString();
}

/**
 * セッションが有効期限内かチェック
 */
export function isSessionValid(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date();
}
