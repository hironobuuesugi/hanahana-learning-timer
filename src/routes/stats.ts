// =============================================
// 花はな Learning Timer - 集計APIルート
//
// GET /api/stats  - ログインユーザーの勉強時間集計を返す
//
// レスポンス:
//   {
//     success: true,
//     data: {
//       today_seconds:    number,        // 今日の勉強秒数
//       week_seconds:     number,        // 今週の勉強秒数（月曜始まり）
//       month_seconds:    number,        // 今月の勉強秒数
//       total_seconds:    number,        // 累計勉強秒数
//       best_day_seconds: number,        // 自己ベスト（1日合計の最大値）秒数
//       best_day_date:    string | null, // 自己ベストを出した日（JST YYYY-MM-DD）
//     }
//   }
//
// 集計方針:
//   - 対象: status = 'finished' かつ subject IS NOT NULL（教科・内容を記録入力済み）
//     ※60秒未満のセッションは subject が NULL のまま廃棄されるので自動除外される
//   - 日付の判定は started_at（勉強を始めた日）を使用
//     ※recorded_at は現状 NULL が入るため使用しない
//   - 日付計算は日本時間（JST = UTC+9）基準で行う
//     started_at は UTC の ISO 文字列で保存されているため、
//     SQLite 側で date(started_at, '+9 hours') を使って JST 日付に変換して比較する
//   - 今日   : JST で今日の YYYY-MM-DD と一致するもの
//   - 今週   : JST で今週の月曜日以降のもの
//   - 今月   : JST で今月の YYYY-MM と一致するもの
//   - 累計   : 対象ユーザーの全レコード
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const stats = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
stats.use('*', authMiddleware)

// ─────────────────────────────────────────────────
// JST (UTC+9) の現在日時情報を返すヘルパー
//   toISOString() は UTC なので、9時間オフセットを足してから
//   文字列として "YYYY-MM-DD" / "YYYY-MM" を取り出す
// ─────────────────────────────────────────────────
function getJstDateInfo() {
  const now = new Date();

  // UTC ミリ秒 + 9時間 → JST としての Date オブジェクト（値が JST になる）
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow    = new Date(now.getTime() + jstOffset);

  // JST での今日の日付文字列 YYYY-MM-DD
  const todayStr  = jstNow.toISOString().slice(0, 10);

  // JST での今月の年月文字列 YYYY-MM
  const monthStr  = jstNow.toISOString().slice(0, 7);

  // JST での曜日（0=日, 1=月, ..., 6=土）
  // getUTCDay() は JST にオフセット済みの jstNow から呼ぶと JST の曜日になる
  const dayOfWeek = jstNow.getUTCDay();

  // 今週の月曜日まで遡る日数（月曜=0, 火=1, ..., 日=6）
  const diffToMon = (dayOfWeek + 6) % 7;

  // JST の月曜日を算出
  const jstMonday = new Date(jstNow.getTime() - diffToMon * 24 * 60 * 60 * 1000);
  const mondayStr = jstMonday.toISOString().slice(0, 10);  // YYYY-MM-DD

  return { todayStr, monthStr, mondayStr };
}

// =============================================
// GET /api/stats - 勉強時間集計
// =============================================
stats.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // ─────────────────────────────────────────
  // JST 基準の各期間境界値を算出
  // ─────────────────────────────────────────
  const { todayStr, monthStr, mondayStr } = getJstDateInfo();

  // ─────────────────────────────────────────
  // 集計クエリ共通条件:
  //   - ログインユーザーのデータのみ (user_id = ?)
  //   - 記録入力済みセッションのみ (subject IS NOT NULL)
  //   - 終了済みセッションのみ (status = 'finished')
  //
  // 日付比較:
  //   started_at は UTC の ISO 文字列で保存されているため
  //   date(started_at, '+9 hours') で JST 日付に変換してから比較する
  //   例: "2026-04-01T18:30:00.000Z" → date 関数で "2026-04-01"(UTC) → '+9 hours' で "2026-04-02"(JST)
  // ─────────────────────────────────────────

  // --- 今日（JST 今日の 0:00〜現在）---
  const todayRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
      AND date(started_at, '+9 hours') = ?
  `).bind(userId, todayStr).first<{ seconds: number }>();

  // --- 今週（JST 今週の月曜 0:00〜現在）---
  const weekRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
      AND date(started_at, '+9 hours') >= ?
      AND date(started_at, '+9 hours') <= ?
  `).bind(userId, mondayStr, todayStr).first<{ seconds: number }>();

  // --- 今月（JST 今月の 1日 0:00〜現在）---
  const monthRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
      AND strftime('%Y-%m', started_at, '+9 hours') = ?
  `).bind(userId, monthStr).first<{ seconds: number }>();

  // --- 累計（全期間）---
  const totalRow = await db.prepare(`
    SELECT COALESCE(SUM(total_seconds), 0) AS seconds
    FROM study_sessions
    WHERE user_id       = ?
      AND status        = 'finished'
      AND subject       IS NOT NULL
  `).bind(userId).first<{ seconds: number }>();

  // --- 自己ベスト（1日合計が最大の日）---
  // JST 日付ごとに合計秒数を集計し、最大値の行を取得する
  // date(started_at, '+9 hours') で JST 日付キーを生成（既存の集計と同じ基準）
  const bestRow = await db.prepare(`
    SELECT
      date(started_at, '+9 hours')  AS jst_date,
      SUM(total_seconds)            AS day_seconds
    FROM study_sessions
    WHERE user_id  = ?
      AND status   = 'finished'
      AND subject  IS NOT NULL
    GROUP BY date(started_at, '+9 hours')
    ORDER BY day_seconds DESC
    LIMIT 1
  `).bind(userId).first<{ jst_date: string; day_seconds: number }>();

  return c.json({
    success: true,
    data: {
      today_seconds:    todayRow?.seconds        ?? 0,
      week_seconds:     weekRow?.seconds         ?? 0,
      month_seconds:    monthRow?.seconds        ?? 0,
      total_seconds:    totalRow?.seconds        ?? 0,
      best_day_seconds: bestRow?.day_seconds     ?? 0,
      best_day_date:    bestRow?.jst_date        ?? null,
    },
  });
});

export default stats;
