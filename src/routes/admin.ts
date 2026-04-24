// =============================================
// 花はな Learning Timer - 先生用管理画面 API
// /api/admin/* - hiro0808 専用（認証必須）
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const TEACHER_USER_ID = 'hiro0808'

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証 + 先生チェック
admin.use('*', authMiddleware)
admin.use('*', async (c, next) => {
  const userId = c.get('userId')
  // userIdはusers.id（数値）なので、user_idで比較するためDBから取得
  const db = c.env.DB
  const user = await db.prepare(
    'SELECT user_id FROM users WHERE id = ?'
  ).bind(userId).first<{ user_id: string }>()

  if (!user || user.user_id !== TEACHER_USER_ID) {
    return c.json({ success: false, error: '先生アカウントのみアクセスできます' }, 403)
  }
  await next()
})

// =============================================
// GET /api/admin/students
// 生徒一覧（hiro0808 以外の全ユーザー）
// =============================================
admin.get('/students', async (c) => {
  const db = c.env.DB

  const rows = await db.prepare(`
    SELECT
      u.id,
      u.user_id,
      u.display_name,
      u.created_at,
      (
        SELECT MAX(s.created_at)
        FROM sessions s
        WHERE s.user_id = u.id
      ) AS last_login_at,
      (
        SELECT COUNT(*)
        FROM study_sessions ss
        WHERE ss.user_id = u.id
          AND ss.status = 'finished'
      ) AS total_sessions,
      (
        SELECT COALESCE(SUM(ss2.total_seconds), 0)
        FROM study_sessions ss2
        WHERE ss2.user_id = u.id
          AND ss2.status = 'finished'
      ) AS total_seconds_all
    FROM users u
    WHERE u.user_id != ?
    ORDER BY u.display_name ASC
  `).bind(TEACHER_USER_ID).all<{
    id: number
    user_id: string
    display_name: string
    created_at: string
    last_login_at: string | null
    total_sessions: number
    total_seconds_all: number
  }>()

  return c.json({ success: true, data: rows.results })
})

// =============================================
// GET /api/admin/student/:studentUserId/stats
// 特定生徒の勉強時間集計（今日・今週・今月・累計）
// =============================================
admin.get('/student/:studentUserId/stats', async (c) => {
  const db = c.env.DB
  const studentUserId = c.req.param('studentUserId')

  const student = await db.prepare(
    'SELECT id, user_id, display_name, created_at FROM users WHERE user_id = ?'
  ).bind(studentUserId).first<{ id: number; user_id: string; display_name: string; created_at: string }>()

  if (!student) {
    return c.json({ success: false, error: '生徒が見つかりません' }, 404)
  }

  // JST基準の日付計算（UTC+9）
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayJST = nowJST.toISOString().slice(0, 10) // YYYY-MM-DD

  // 今週の月曜日（JST）
  const dayOfWeek = nowJST.getUTCDay() // 0=Sun,1=Mon,...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const mondayJST = new Date(nowJST)
  mondayJST.setUTCDate(nowJST.getUTCDate() - daysFromMonday)
  const weekStartJST = mondayJST.toISOString().slice(0, 10)

  // 今月1日（JST）
  const monthStartJST = todayJST.slice(0, 7) + '-01'

  const stats = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN date(started_at, '+9 hours') = ? THEN total_seconds ELSE 0 END), 0) AS today_seconds,
      COALESCE(SUM(CASE WHEN date(started_at, '+9 hours') >= ? THEN total_seconds ELSE 0 END), 0) AS week_seconds,
      COALESCE(SUM(CASE WHEN date(started_at, '+9 hours') >= ? THEN total_seconds ELSE 0 END), 0) AS month_seconds,
      COALESCE(SUM(total_seconds), 0) AS total_seconds
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
  `).bind(todayJST, weekStartJST, monthStartJST, student.id)
    .first<{ today_seconds: number; week_seconds: number; month_seconds: number; total_seconds: number }>()

  // 連続記録・自己ベスト
  const streakRows = await db.prepare(`
    SELECT DISTINCT date(started_at, '+9 hours') AS study_date
    FROM study_sessions
    WHERE user_id = ? AND status = 'finished'
    ORDER BY study_date DESC
  `).bind(student.id).all<{ study_date: string }>()

  const dates = streakRows.results.map(r => r.study_date)
  let streak = 0
  let bestStreak = 0
  let cur = 0

  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      const diffToday = Math.floor(
        (new Date(todayJST).getTime() - new Date(dates[0]).getTime()) / 86400000
      )
      if (diffToday <= 1) { cur = 1; streak = 1 }
      else { cur = 1 }
    } else {
      const prev = new Date(dates[i - 1])
      const curr = new Date(dates[i])
      const diff = Math.floor((prev.getTime() - curr.getTime()) / 86400000)
      if (diff === 1) {
        cur++
        if (i === 1 || streak > 0) streak = cur
      } else {
        if (cur > bestStreak) bestStreak = cur
        cur = 1
        if (streak > 0 && i > 1) streak = 0
      }
    }
    if (cur > bestStreak) bestStreak = cur
  }
  if (streak === 0 && dates.length > 0) streak = 0

  return c.json({
    success: true,
    data: {
      student,
      stats: {
        today_seconds: stats?.today_seconds ?? 0,
        week_seconds: stats?.week_seconds ?? 0,
        month_seconds: stats?.month_seconds ?? 0,
        total_seconds: stats?.total_seconds ?? 0,
      },
      streak: { current: streak, best: bestStreak },
    }
  })
})

// =============================================
// GET /api/admin/student/:studentUserId/calendar
// 特定生徒の今月カレンダー（勉強した日の一覧）
// =============================================
admin.get('/student/:studentUserId/calendar', async (c) => {
  const db = c.env.DB
  const studentUserId = c.req.param('studentUserId')

  const student = await db.prepare(
    'SELECT id FROM users WHERE user_id = ?'
  ).bind(studentUserId).first<{ id: number }>()

  if (!student) {
    return c.json({ success: false, error: '生徒が見つかりません' }, 404)
  }

  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const monthStartJST = nowJST.toISOString().slice(0, 7) + '-01'

  const rows = await db.prepare(`
    SELECT DISTINCT date(started_at, '+9 hours') AS study_date
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
      AND date(started_at, '+9 hours') >= ?
    ORDER BY study_date ASC
  `).bind(student.id, monthStartJST).all<{ study_date: string }>()

  return c.json({ success: true, data: rows.results.map(r => r.study_date) })
})

// =============================================
// GET /api/admin/student/:studentUserId/subjects
// 特定生徒の今月・教科別勉強時間
// =============================================
admin.get('/student/:studentUserId/subjects', async (c) => {
  const db = c.env.DB
  const studentUserId = c.req.param('studentUserId')

  const student = await db.prepare(
    'SELECT id FROM users WHERE user_id = ?'
  ).bind(studentUserId).first<{ id: number }>()

  if (!student) {
    return c.json({ success: false, error: '生徒が見つかりません' }, 404)
  }

  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const monthStartJST = nowJST.toISOString().slice(0, 7) + '-01'

  const rows = await db.prepare(`
    SELECT
      COALESCE(subject, 'other') AS subject,
      SUM(total_seconds) AS seconds
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
      AND date(started_at, '+9 hours') >= ?
    GROUP BY subject
    ORDER BY seconds DESC
  `).bind(student.id, monthStartJST).all<{ subject: string; seconds: number }>()

  return c.json({ success: true, data: rows.results })
})

// =============================================
// GET /api/admin/student/:studentUserId/sessions
// 特定生徒の直近セッション一覧（デフォルト30件）
// =============================================
admin.get('/student/:studentUserId/sessions', async (c) => {
  const db = c.env.DB
  const studentUserId = c.req.param('studentUserId')
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 100)

  const student = await db.prepare(
    'SELECT id FROM users WHERE user_id = ?'
  ).bind(studentUserId).first<{ id: number }>()

  if (!student) {
    return c.json({ success: false, error: '生徒が見つかりません' }, 404)
  }

  const rows = await db.prepare(`
    SELECT id, subject, started_at, finished_at, total_seconds, status, auto_stopped
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
    ORDER BY started_at DESC
    LIMIT ?
  `).bind(student.id, limit).all<{
    id: number
    subject: string | null
    started_at: string
    finished_at: string
    total_seconds: number
    status: string
    auto_stopped: number
  }>()

  return c.json({ success: true, data: rows.results })
})

// =============================================
// GET /api/admin/student/:studentUserId/logins
// 特定生徒のログイン履歴（直近20件）
// =============================================
admin.get('/student/:studentUserId/logins', async (c) => {
  const db = c.env.DB
  const studentUserId = c.req.param('studentUserId')

  const student = await db.prepare(
    'SELECT id FROM users WHERE user_id = ?'
  ).bind(studentUserId).first<{ id: number }>()

  if (!student) {
    return c.json({ success: false, error: '生徒が見つかりません' }, 404)
  }

  const rows = await db.prepare(`
    SELECT created_at, expires_at
    FROM sessions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(student.id).all<{ created_at: string; expires_at: string }>()

  return c.json({ success: true, data: rows.results })
})

export default admin
