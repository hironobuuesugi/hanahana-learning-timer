// =============================================
// 花はな Learning Timer - 勉強記録一覧APIルート
//
// GET /api/records
//   ログインユーザー本人の勉強記録を新しい順で返す。
//   対象: status = 'finished' かつ subject IS NOT NULL（記録入力済み）
//
// レスポンス:
//   {
//     success: true,
//     data: [
//       {
//         id:            number,   // セッションID
//         started_at:    string,   // 勉強開始日時 (ISO8601)
//         total_seconds: number,   // 勉強時間（秒）
//         subject:       string,   // 教科（カンマ区切り, 例: "english,math"）
//         memo:          string,   // 勉強内容
//         recorded_at:   string,   // 記録日時 (ISO8601)
//       },
//       ...
//     ]
//   }
//
// 設計方針:
//   - subject・memo が両方 NULL でないセッションのみ返す
//     （フィニッシュしたが記録未入力は一覧に出さない）
//   - 並び順は started_at DESC（新しい勉強が先頭）
//   - 他ユーザーのデータは絶対に返さない（WHERE user_id = ? で完全分離）
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const records = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
records.use('*', authMiddleware)

// =============================================
// GET /api/records - 勉強記録一覧取得
// =============================================
records.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.DB

  // ログインユーザー本人の記録のみ、新しい順で取得
  // subject が NULL でないもの＝記録入力済みセッションのみ
  const rows = await db.prepare(`
    SELECT
      id,
      started_at,
      total_seconds,
      subject,
      memo
    FROM study_sessions
    WHERE user_id    = ?
      AND status     = 'finished'
      AND subject    IS NOT NULL
    ORDER BY started_at DESC
  `).bind(userId).all<{
    id: number
    started_at: string
    total_seconds: number
    subject: string
    memo: string | null
  }>()

  return c.json({
    success: true,
    data: rows.results ?? [],
  })
})

// =============================================
// PATCH /api/records/:id - 勉強内容（memo）を更新
// 変更可能: memo のみ
// 変更禁止: subject, total_seconds, started_at, status
// =============================================
records.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const db = c.env.DB
  const sessionId = parseInt(c.req.param('id'), 10)

  if (isNaN(sessionId)) {
    return c.json({ success: false, error: '無効なIDです' }, 400)
  }

  // リクエストボディから memo のみ受け取る
  let body: { memo?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: 'リクエストが不正です' }, 400)
  }

  const memo = body.memo
  if (memo === undefined || memo === null) {
    return c.json({ success: false, error: '勉強内容が指定されていません' }, 400)
  }

  const memoStr = String(memo).trim()
  if (memoStr.length === 0) {
    return c.json({ success: false, error: '勉強内容を入力してください' }, 400)
  }
  if (memoStr.length > 500) {
    return c.json({ success: false, error: '勉強内容は500文字以内にしてください' }, 400)
  }

  // 本人のレコードかつ status='finished' かつ subject IS NOT NULL のみ更新可
  const existing = await db.prepare(`
    SELECT id FROM study_sessions
    WHERE id = ? AND user_id = ? AND status = 'finished' AND subject IS NOT NULL
  `).bind(sessionId, userId).first<{ id: number }>()

  if (!existing) {
    return c.json({ success: false, error: '記録が見つかりません' }, 404)
  }

  // memo のみ更新（他フィールドは一切触らない）
  const result = await db.prepare(`
    UPDATE study_sessions SET memo = ? WHERE id = ? AND user_id = ?
  `).bind(memoStr, sessionId, userId).run()

  if (!result.success) {
    return c.json({ success: false, error: '更新に失敗しました' }, 500)
  }

  return c.json({ success: true, message: '勉強内容を更新しました', data: { id: sessionId, memo: memoStr } })
})

export default records
