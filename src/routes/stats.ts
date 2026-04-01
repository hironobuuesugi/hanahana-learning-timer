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
//   - 対象: status = 'finished' かつ subject IS NOT NULL（教科・内容を記録入力済み）
//     ※60秒未満のセッションは subject が NULL のまま廃棄されるので自動除外される
//   - 日付の判定は started_at（勉強を始めた日）を使用
//     ※recorded_at は現状 NULL が入るため使用しない
//   - 日付計算はサーバー側 JavaScript で UTC 基準で行う
//   - 今日   : started_at が今日の YYYY-MM-DD と一致するもの
//   - 今週   : started_at が今週の月曜日(UTC)以降のもの
//   - 今月   : started_at が今月の YYYY-MM と一致するもの
//   - 累計   : 対象ユーザーの全レコード
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

  // ─────────────────────────────────────────
  // 現在時刻・各期間の境界値を UTC 基準で算出
  // ─────────────────────────────────────────
  const now = new Date();

  // 今日の日付文字列（YYYY-MM-DD）
  const todayStr  = now.toISOString().slice(0, 10);

  // 今月の年月文字列（YYYY-MM）
  const monthStr  = now.toISOString().slice(0, 7);

  // 今週の月曜日（UTC）を算出
  // getUTCDay(): 0=日, 1=月, 2=火, ..., 6=土
  // 月曜に揃えるために (dayOfWeek + 6) % 7 日分遡る
  const dayOfWeek  = now.getUTCDay();
  const diffToMon  = (dayOfWeek + 6) % 7;   // 月曜まで遡る日数（月曜=0, 火曜=1, ..., 日曜=6）
  const monday     = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diffToMon);
  const mondayStr  = monday.toISOString().slice(0, 10);  // YYYY-MM-DD

  // ─────────────────────────────────────────
  // 集計クエリ共通条件:
  //   - ログインユーザーのデータのみ (user_id = ?)
  //   - 記録入力済みセッションのみ (subject IS NOT NULL)
  //   - 終了済みセッションのみ (status = 'finished')
  // ─────────────────────────────────────────

  // --- 今日（今日の0:00〜現在）---
  // date(started_at) は "YYYY-MM-DD" を返すので todayStr と比較
  const todayRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
      AND date(started_at) = ?
  `).bind(userId, todayStr).first<{ seconds: number }>();

  // --- 今週（今週の月曜0:00〜現在）---
  // date(started_at) >= mondayStr かつ <= todayStr
  const weekRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
      AND date(started_at) >= ?
      AND date(started_at) <= ?
  `).bind(userId, mondayStr, todayStr).first<{ seconds: number }>();

  // --- 今月（今月1日0:00〜現在）---
  // strftime('%Y-%m', started_at) = 'YYYY-MM'
  const monthRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
      AND strftime('%Y-%m', started_at) = ?
  `).bind(userId, monthStr).first<{ seconds: number }>();

  // --- 累計（全期間）---
  const totalRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
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
