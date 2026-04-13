// =============================================
// 花はな Learning Timer - 先生コメントAPIルート
//
// GET  /api/comments?student_user_id=xxx
//   → 指定生徒の今日(JST)のコメントを返す（全ログインユーザーが閲覧可）
//
// POST /api/comments
//   → コメントを保存（hiro0808 のみ可）
//   body: { student_user_id: string, comment_text: string }
//
// 制約:
//   - コメント保存は hiro0808 のみ
//   - 1生徒につき1日1コメント (UNIQUE制約 + UPSERT)
//   - コメント50文字以内
//   - 表示は当日(JST)分のみ
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
comments.use('*', authMiddleware)

// 先生アカウントID（固定）
const TEACHER_USER_ID = 'hiro0808'

// JST 今日の日付文字列 (YYYY-MM-DD) を返すヘルパー
function getJstToday(): string {
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jstNow.toISOString().slice(0, 10)
}

// =============================================
// GET /api/comments?student_user_id=xxx
// 指定生徒の当日コメントを返す（全ユーザー閲覧可）
// =============================================
comments.get('/', async (c) => {
  const db = c.env.DB
  const studentUserId = c.req.query('student_user_id')

  if (!studentUserId) {
    return c.json({ success: false, error: 'student_user_id が必要です' }, 400)
  }

  const todayStr = getJstToday()

  const row = await db.prepare(`
    SELECT id, student_user_id, comment_text, comment_date, created_at
    FROM teacher_comments
    WHERE student_user_id = ?
      AND comment_date    = ?
  `).bind(studentUserId, todayStr).first<{
    id: number
    student_user_id: string
    comment_text: string
    comment_date: string
    created_at: string
  }>()

  return c.json({
    success: true,
    data: {
      comment: row
        ? {
            id:               row.id,
            student_user_id:  row.student_user_id,
            comment_text:     row.comment_text,
            comment_date:     row.comment_date,
            created_at:       row.created_at,
          }
        : null,
      today: todayStr,
    },
  })
})

// =============================================
// POST /api/comments
// コメントを保存・更新（hiro0808 のみ）
// body: { student_user_id: string, comment_text: string }
// =============================================
comments.post('/', async (c) => {
  // ログインユーザーの user_id を取得
  const requestUserId = c.get('userId')   // users.id (数値) ← authMiddlewareの仕様
  const db = c.env.DB

  // ログインユーザーの user_id 文字列を取得
  const loginUser = await db.prepare(
    'SELECT user_id FROM users WHERE id = ?'
  ).bind(requestUserId).first<{ user_id: string }>()

  if (!loginUser) {
    return c.json({ success: false, error: 'ユーザーが見つかりません' }, 404)
  }

  // 先生アカウントのみ許可
  if (loginUser.user_id !== TEACHER_USER_ID) {
    return c.json({ success: false, error: 'コメントの保存は先生アカウントのみ可能です' }, 403)
  }

  const body = await c.req.json().catch(() => null)
  if (!body) {
    return c.json({ success: false, error: 'リクエストボディが不正です' }, 400)
  }

  const studentUserId: string = body.student_user_id ?? ''
  const commentText: string   = (body.comment_text ?? '').trim()

  // バリデーション
  if (!studentUserId) {
    return c.json({ success: false, error: 'student_user_id が必要です' }, 400)
  }
  if (!commentText) {
    return c.json({ success: false, error: 'コメントを入力してください' }, 400)
  }
  if (commentText.length > 50) {
    return c.json({ success: false, error: 'コメントは50文字以内にしてください' }, 422)
  }

  const todayStr = getJstToday()

  // 生徒の存在確認
  const studentExists = await db.prepare(
    'SELECT id FROM users WHERE user_id = ?'
  ).bind(studentUserId).first<{ id: number }>()

  if (!studentExists) {
    return c.json({ success: false, error: '対象の生徒が見つかりません' }, 404)
  }

  // INSERT OR REPLACE (1生徒1日1コメント = UPSERTで上書き)
  await db.prepare(`
    INSERT INTO teacher_comments
      (student_user_id, comment_text, comment_date, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT (student_user_id, comment_date)
    DO UPDATE SET
      comment_text        = excluded.comment_text,
      created_by_user_id  = excluded.created_by_user_id,
      created_at          = excluded.created_at
  `).bind(studentUserId, commentText, todayStr, TEACHER_USER_ID).run()

  return c.json({
    success: true,
    message: 'コメントを保存しました',
    data: {
      student_user_id: studentUserId,
      comment_text:    commentText,
      comment_date:    todayStr,
    },
  })
})

export default comments
