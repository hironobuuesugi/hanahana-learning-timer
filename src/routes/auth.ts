// =============================================
// 花はな Learning Timer - 認証APIルート
// POST /api/auth/register  - 新規登録
// POST /api/auth/login     - ログイン
// POST /api/auth/logout    - ログアウト
// =============================================

import { Hono } from 'hono'
import { hashPassword, verifyPassword, generateSessionToken, getSessionExpiry } from '../utils/crypto'
import { validateUserId, validatePassword, validateDisplayName } from '../utils/validation'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables, UserRecord } from '../types'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// =============================================
// POST /api/auth/register - 新規登録
// =============================================
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { user_id, password, display_name } = body;

    // バリデーション
    const userIdValidation = validateUserId(user_id);
    if (!userIdValidation.valid) {
      return c.json({ success: false, error: userIdValidation.error }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({ success: false, error: passwordValidation.error }, 400);
    }

    const displayNameValidation = validateDisplayName(display_name);
    if (!displayNameValidation.valid) {
      return c.json({ success: false, error: displayNameValidation.error }, 400);
    }

    const db = c.env.DB;

    // ユーザーID重複チェック
    const existingUser = await db.prepare(
      'SELECT id FROM users WHERE user_id = ?'
    ).bind(user_id.trim()).first();

    if (existingUser) {
      return c.json({ success: false, error: 'このユーザーIDはすでに使用されています' }, 409);
    }

    // パスワードハッシュ化
    const passwordHash = await hashPassword(password);

    // ユーザー登録
    const result = await db.prepare(
      'INSERT INTO users (user_id, password_hash, display_name) VALUES (?, ?, ?)'
    ).bind(user_id.trim(), passwordHash, display_name.trim()).run();

    if (!result.success) {
      throw new Error('ユーザー登録に失敗しました');
    }

    // 登録後に自動ログイン用のセッション作成
    const userId = result.meta.last_row_id;
    const sessionToken = generateSessionToken();
    const expiresAt = getSessionExpiry(7);

    await db.prepare(
      'INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionToken, userId, expiresAt).run();

    // レスポンスにセッションCookieをセット
    const response = c.json({
      success: true,
      message: 'アカウントを作成しました！',
      data: {
        session_token: sessionToken,
        user: {
          id: userId,
          user_id: user_id.trim(),
          display_name: display_name.trim(),
        }
      }
    }, 201);

    // HttpOnly Cookieにセッショントークンをセット
    c.header('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`);

    return response;

  } catch (err) {
    console.error('Register error:', err);
    return c.json({ success: false, error: '登録中にエラーが発生しました' }, 500);
  }
});

// =============================================
// POST /api/auth/login - ログイン
// =============================================
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { user_id, password } = body;

    // 簡単なバリデーション
    if (!user_id || !password) {
      return c.json({ success: false, error: 'ユーザーIDとパスワードを入力してください' }, 400);
    }

    const db = c.env.DB;

    // ユーザー検索
    const user = await db.prepare(
      'SELECT * FROM users WHERE user_id = ? AND is_active = 1'
    ).bind(user_id.trim()).first<UserRecord & { password_hash: string }>();

    if (!user) {
      // セキュリティのため「ユーザーIDまたはパスワードが間違っています」と表示
      return c.json({ success: false, error: 'ユーザーIDまたはパスワードが間違っています' }, 401);
    }

    // パスワード検証
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ success: false, error: 'ユーザーIDまたはパスワードが間違っています' }, 401);
    }

    // 古いセッションを削除（1ユーザー1セッション）
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();

    // 新しいセッション作成
    const sessionToken = generateSessionToken();
    const expiresAt = getSessionExpiry(7);

    await db.prepare(
      'INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionToken, user.id, expiresAt).run();

    // HttpOnly CookieにセットしてレスポンスReturn
    c.header('Set-Cookie', `session_token=${sessionToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`);

    return c.json({
      success: true,
      message: 'ログインしました！',
      data: {
        session_token: sessionToken,
        user: {
          id: user.id,
          user_id: user.user_id,
          display_name: user.display_name,
          created_at: user.created_at,
        }
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return c.json({ success: false, error: 'ログイン中にエラーが発生しました' }, 500);
  }
});

// =============================================
// POST /api/auth/logout - ログアウト（要認証）
// =============================================
auth.post('/logout', authMiddleware, async (c) => {
  try {
    const sessionToken = getCookieValue(c.req.raw.headers.get('cookie') || '', 'session_token');
    const db = c.env.DB;

    // セッション削除
    if (sessionToken) {
      await db.prepare('DELETE FROM sessions WHERE session_token = ?').bind(sessionToken).run();
    }

    // Cookieを無効化
    c.header('Set-Cookie', 'session_token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');

    return c.json({ success: true, message: 'ログアウトしました' });

  } catch (err) {
    console.error('Logout error:', err);
    return c.json({ success: false, error: 'ログアウト中にエラーが発生しました' }, 500);
  }
});

// =============================================
// GET /api/auth/me - ログイン中のユーザー情報取得
// =============================================
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('userInfo');
  return c.json({
    success: true,
    data: {
      id: user.id,
      user_id: user.user_id,
      display_name: user.display_name,
      created_at: user.created_at,
      // 今後追加予定のフィールド:
      // goal_minutes: user.goal_minutes,
      // streak_days: user.streak_days,
      // total_minutes: user.total_minutes,
    }
  });
});

// ヘルパー関数
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

export default auth;
