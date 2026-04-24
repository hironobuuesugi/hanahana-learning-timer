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

  // 連続記録・自己ベスト（stats.ts の /streak と完全同一ロジック）
  const streakRows = await db.prepare(`
    SELECT DISTINCT date(started_at, '+9 hours') AS jst_date
    FROM study_sessions
    WHERE user_id = ? AND status = 'finished' AND subject IS NOT NULL
    ORDER BY jst_date DESC
  `).bind(student.id).all<{ jst_date: string }>()

  const dates = (streakRows.results ?? []).map(r => r.jst_date)

  // JST今日・昨日の日付文字列
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayStr = jstNow.toISOString().slice(0, 10)
  const yesterdayStr = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const dateSet = new Set(dates)

  // current_streak:
  //   今日に記録があれば今日を起点に遡る
  //   今日になくて昨日にあれば昨日を起点に遡る（今日まだ勉強していないが連続中）
  //   どちらもなければ 0
  let currentStreak = 0
  if (dateSet.has(todayStr)) {
    let checkDate = new Date(jstNow)
    while (true) {
      const d = checkDate.toISOString().slice(0, 10)
      if (!dateSet.has(d)) break
      currentStreak++
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
    }
  } else if (dateSet.has(yesterdayStr)) {
    let checkDate = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000)
    while (true) {
      const d = checkDate.toISOString().slice(0, 10)
      if (!dateSet.has(d)) break
      currentStreak++
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
    }
  }

  // best_streak: 全期間の最大連続日数
  const sortedDates = [...dates].sort()
  let bestStreak = dates.length > 0 ? 1 : 0
  let runStreak = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00Z')
    const curr = new Date(sortedDates[i]     + 'T00:00:00Z')
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays === 1) {
      runStreak++
      if (runStreak > bestStreak) bestStreak = runStreak
    } else {
      runStreak = 1
    }
  }
  if (currentStreak > bestStreak) bestStreak = currentStreak

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
      streak: { current: currentStreak, best: bestStreak },
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
// 複数教科選択時は total_seconds を教科数で均等按分（stats.ts と同仕様）
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
  const monthStr = nowJST.toISOString().slice(0, 7) // YYYY-MM

  // 今月の全セッションを取得（subject・total_seconds のみ）
  const rows = await db.prepare(`
    SELECT subject, total_seconds
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
      AND subject IS NOT NULL
      AND strftime('%Y-%m', started_at, '+9 hours') = ?
  `).bind(student.id, monthStr).all<{ subject: string; total_seconds: number }>()

  // stats.ts と同じ按分ロジック
  const KNOWN_SUBJECTS = ['english', 'math', 'japanese', 'science', 'social', 'other']
  const acc: Record<string, number> = {
    english: 0, math: 0, japanese: 0, science: 0, social: 0, other: 0,
  }

  for (const row of rows.results ?? []) {
    const codes = row.subject.split(',').map((s: string) => s.trim()).filter(Boolean)
    if (codes.length === 0) continue
    const share = row.total_seconds / codes.length
    for (const code of codes) {
      const key = KNOWN_SUBJECTS.includes(code) ? code : 'other'
      acc[key] += share
    }
  }

  // 0秒の教科は除外してリスト形式で返す（表示順固定）
  const ORDER = ['english', 'math', 'japanese', 'science', 'social', 'other']
  const result = ORDER
    .map(code => ({ subject: code, seconds: Math.floor(acc[code]) }))
    .filter(r => r.seconds > 0)

  return c.json({ success: true, data: result })
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
    SELECT id, subject, memo, started_at, finished_at, total_seconds, status, auto_stopped
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
      AND subject IS NOT NULL
    ORDER BY started_at DESC
    LIMIT ?
  `).bind(student.id, limit).all<{
    id: number
    subject: string | null
    memo: string | null
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
// 特定生徒のログイン履歴（直近30件）
// login_logs テーブルから取得
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
    SELECT logged_in_at
    FROM login_logs
    WHERE user_id = ?
    ORDER BY logged_in_at DESC
    LIMIT 30
  `).bind(student.id).all<{ logged_in_at: string }>()

  return c.json({ success: true, data: rows.results })
})

export default admin
