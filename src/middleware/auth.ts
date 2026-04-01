// =============================================
// 花はな Learning Timer - 認証ミドルウェア
// =============================================

import { createMiddleware } from 'hono/factory'
import { isSessionValid } from '../utils/crypto'
import type { Bindings, Variables, UserRecord, SessionRecord } from '../types'

/**
 * セッション認証ミドルウェア
 * Cookieからセッショントークンを取得してユーザー情報を検証する
 */
export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const sessionToken = getCookieValue(c.req.raw.headers.get('cookie') || '', 'session_token');

  if (!sessionToken) {
    return c.json({ success: false, error: 'ログインが必要です' }, 401);
  }

  const db = c.env.DB;

  try {
    // セッション情報をDBから取得
    const session = await db.prepare(
      'SELECT * FROM sessions WHERE session_token = ?'
    ).bind(sessionToken).first<SessionRecord>();

    if (!session) {
      return c.json({ success: false, error: 'セッションが無効です。再度ログインしてください' }, 401);
    }

    // 有効期限チェック
    if (!isSessionValid(session.expires_at)) {
      // 期限切れセッションを削除
      await db.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();
      return c.json({ success: false, error: 'セッションが期限切れです。再度ログインしてください' }, 401);
    }

    // ユーザー情報を取得
    const user = await db.prepare(
      'SELECT id, user_id, display_name, created_at, updated_at, is_active FROM users WHERE id = ?'
    ).bind(session.user_id).first<UserRecord>();

    if (!user || !user.is_active) {
      return c.json({ success: false, error: 'ユーザーが見つかりません' }, 401);
    }

    // リクエストコンテキストにユーザー情報をセット
    c.set('userId', user.id);
    c.set('userInfo', user);

    await next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return c.json({ success: false, error: 'サーバーエラーが発生しました' }, 500);
  }
});

/**
 * Cookieヘッダーから特定の値を取得するヘルパー
 */
function getCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=');
    if (key.trim() === name) {
      return valueParts.join('=');
    }
  }
  return null;
}
