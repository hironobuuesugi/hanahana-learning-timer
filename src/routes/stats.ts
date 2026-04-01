// =============================================
// 花はな Learning Timer - 集計APIルート
//
// GET /api/stats  - ログインユーザーの勉強時間集計を返す
//
// レスポンス:
//   {
//     success: true,
//     data: {
//       today_seconds:   number,  // 今日の勉強秒数
//       week_seconds:    number,  // 今週の勉強秒数（月曜始まり）
//       month_seconds:   number,  // 今月の勉強秒数
//       total_seconds:   number,  // 累計勉強秒数
//     }
//   }
//
// 集計方針:
//   - 対象: status = 'finished' かつ subject IS NOT NULL（記録入力済み）のセッション
//   - ただし「フィニッシュしたが記録未入力」は集計に含める（total_secondsが確定している）
//     → status = 'finished' を対象とする（subjectあり/なし問わず）
//   - 日付の判定は started_at（勉強を始めた日）を使用
//   - 日付判定はサーバー側で SQLite の date() 関数を使用
//   - 今週: SQLite では strftime('%W') は日曜始まり。
//     月曜始まりにするため「(weekday+6)%7」調整を行う。
//     実装上は「今日から遡って6日分（月曜〜日曜）」より
//     「ISO週: 月〜日」を SQLite の date() で計算する。
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const stats = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
stats.use('*', authMiddleware)

// =============================================
// GET /api/stats - 勉強時間集計
// =============================================
stats.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // サーバー側の現在時刻（ISO8601形式）
  const nowIso = new Date().toISOString();

  // SQLite の date() 関数に渡す「今日の日付文字列」（YYYY-MM-DD）
  // Cloudflare Workers の Date.now() は UTC なので UTC 基準で集計
  const todayStr   = nowIso.slice(0, 10);                         // YYYY-MM-DD
  const yearStr    = nowIso.slice(0, 4);                          // YYYY
  const monthStr   = nowIso.slice(0, 7);                          // YYYY-MM

  // 今週の月曜日を計算（ISO週: 月曜始まり）
  const now        = new Date(nowIso);
  const dayOfWeek  = now.getUTCDay();                             // 0=日, 1=月, ..., 6=土
  const diffToMon  = (dayOfWeek + 6) % 7;                        // 月曜まで遡る日数
  const mondayDate = new Date(now);
  mondayDate.setUTCDate(now.getUTCDate() - diffToMon);
  const mondayStr  = mondayDate.toISOString().slice(0, 10);       // YYYY-MM-DD（月曜）

  // --- 今日の合計秒数 ---
  const todayRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
      AND date(started_at) = ?
  `).bind(userId, todayStr).first<{ seconds: number }>();

  // --- 今週（月曜〜今日）の合計秒数 ---
  const weekRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
      AND date(started_at) >= ?
      AND date(started_at) <= ?
  `).bind(userId, mondayStr, todayStr).first<{ seconds: number }>();

  // --- 今月（1日〜月末）の合計秒数 ---
  const monthRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
      AND strftime('%Y-%m', started_at) = ?
  `).bind(userId, monthStr).first<{ seconds: number }>();

  // --- 累計の合計秒数 ---
  const totalRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id = ?
      AND status = 'finished'
  `).bind(userId).first<{ seconds: number }>();

  return c.json({
    success: true,
    data: {
      today_seconds: todayRow?.seconds  ?? 0,
      week_seconds:  weekRow?.seconds   ?? 0,
      month_seconds: monthRow?.seconds  ?? 0,
      total_seconds: totalRow?.seconds  ?? 0,
    },
  });
});

export default stats;
