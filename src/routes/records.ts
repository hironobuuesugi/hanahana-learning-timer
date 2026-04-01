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
      memo,
      recorded_at
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
    recorded_at: string | null
  }>()

  return c.json({
    success: true,
    data: rows.results ?? [],
  })
})

export default records
