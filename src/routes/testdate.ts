// =============================================
// 花はな Learning Timer - テスト日APIルート
//
// GET  /api/testdate  - ログインユーザーのテスト日を返す
// POST /api/testdate  - ログインユーザーのテスト日を保存（UPSERT）
//
// テスト日は1ユーザーにつき1件のみ保持する。
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const testdate = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
testdate.use('*', authMiddleware)

// =============================================
// GET /api/testdate - テスト日取得
// =============================================
testdate.get('/', async (c) => {
  const userId = c.get('userId')
  const db     = c.env.DB

  const row = await db.prepare(`
    SELECT test_date FROM user_test_dates WHERE user_id = ?
  `).bind(userId).first<{ test_date: string }>()

  return c.json({
    success:   true,
    test_date: row?.test_date ?? null,
  })
})

// =============================================
// POST /api/testdate - テスト日保存（UPSERT）
// =============================================
testdate.post('/', async (c) => {
  const userId = c.get('userId')
  const db     = c.env.DB

  const body = await c.req.json().catch(() => ({})) as { test_date?: string }
  const testDate = (body.test_date ?? '').trim()

  // バリデーション: 日付未入力はエラー
  if (!testDate) {
    return c.json({ success: false, error: 'テスト日を入力してください' }, 400)
  }

  // UPSERT: 既存レコードがあれば更新、なければ挿入
  await db.prepare(`
    INSERT INTO user_test_dates (user_id, test_date, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      test_date  = excluded.test_date,
      updated_at = datetime('now')
  `).bind(userId, testDate).run()

  return c.json({
    success:   true,
    test_date: testDate,
    message:   'テスト日を保存しました',
  })
})

export default testdate
