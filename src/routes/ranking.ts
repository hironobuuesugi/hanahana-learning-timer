// =============================================
// 花はな Learning Timer - ランキングAPIルート
//
// GET /api/ranking  - 今週・今月のランキングと自分の順位を返す
//
// レスポンス:
//   {
//     success: true,
//     data: {
//       week: {
//         period_label: string,            // 例: "4/1（月）〜4/7（日）"
//         ranking: [                        // 上位5名（同率含む）
//           { rank: number, user_id: string, seconds: number },
//           ...
//         ],
//         my_rank: number | null,          // 自分の順位（圏外でも表示）
//         my_seconds: number,              // 自分の今週秒数
//       },
//       month: {
//         period_label: string,            // 例: "2026年4月"
//         ranking: [                        // 上位5名（同率含む）
//           { rank: number, user_id: string, seconds: number },
//           ...
//         ],
//         my_rank: number | null,
//         my_seconds: number,
//       },
//     }
//   }
//
// 集計方針:
//   - 全ユーザーの study_sessions (status='finished', subject IS NOT NULL) を対象
//   - JST (UTC+9) 基準で週・月の範囲を判定
//   - 同率同位（例: 2名が1位なら次は3位）
//   - 表示するユーザー名は display_name を使用（未設定時は user_id にフォールバック）
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const ranking = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
ranking.use('*', authMiddleware)

// ─────────────────────────────────────────────────
// JST (UTC+9) の現在日時情報を返すヘルパー
// ─────────────────────────────────────────────────
function getJstRankingPeriod() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);

  // 今日の YYYY-MM-DD (JST)
  const todayStr = jstNow.toISOString().slice(0, 10);

  // 今月の YYYY-MM (JST)
  const monthStr = jstNow.toISOString().slice(0, 7);

  // 今週の月曜日 (JST)
  const dayOfWeek = jstNow.getUTCDay(); // 0=日, 1=月, ..., 6=土
  const diffToMon = (dayOfWeek + 6) % 7; // 月曜起点にする日数差
  const jstMonday = new Date(jstNow.getTime() - diffToMon * 24 * 60 * 60 * 1000);
  const mondayStr = jstMonday.toISOString().slice(0, 10);

  // 今週の日曜日 (JST)
  const diffToSun = (7 - dayOfWeek) % 7;
  const jstSunday = new Date(jstNow.getTime() + diffToSun * 24 * 60 * 60 * 1000);
  const sundayStr = jstSunday.toISOString().slice(0, 10);

  // 期間ラベル（週）
  const weekLabel = formatWeekLabel(jstMonday, jstSunday);

  // 期間ラベル（月）
  const monthLabel = `${jstNow.getUTCFullYear()}年${jstNow.getUTCMonth() + 1}月`;

  return { todayStr, monthStr, mondayStr, sundayStr, weekLabel, monthLabel };
}

// 月/日（曜日）表示ヘルパー
function formatWeekLabel(monday: Date, sunday: Date): string {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const fmt = (d: Date) => {
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const wd = WEEKDAYS[d.getUTCDay()];
    return `${m}/${day}（${wd}）`;
  };
  return `${fmt(monday)}〜${fmt(sunday)}`;
}

// ─────────────────────────────────────────────────
// 同率順位を付与するヘルパー
// input: [{user_id, display_name, seconds, today_seconds?}, ...] (seconds 降順ソート済み)
// output: [{rank, user_id, display_name, seconds, today_seconds}, ...]
// ─────────────────────────────────────────────────
function assignRanks(rows: { user_id: string; display_name: string; seconds: number; today_seconds?: number }[]) {
  const result: { rank: number; user_id: string; display_name: string; seconds: number; today_seconds: number }[] = [];
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].seconds < rows[i - 1].seconds) {
      rank = i + 1;
    }
    result.push({ rank, user_id: rows[i].user_id, display_name: rows[i].display_name, seconds: rows[i].seconds, today_seconds: rows[i].today_seconds ?? 0 });
  }
  return result;
}

// ─────────────────────────────────────────────────
// 先月の期間 (YYYY-MM-DD) と表示ラベルを返すヘルパー
// ─────────────────────────────────────────────────
function getLastMonthPeriod() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);

  const year  = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth() + 1; // 1-12

  // 先月の年・月
  const lastYear  = month === 1 ? year - 1 : year;
  const lastMonth = month === 1 ? 12 : month - 1;

  // 先月1日
  const firstDay = `${lastYear}-${String(lastMonth).padStart(2, '0')}-01`;

  // 先月末日（当月1日の前日）
  const lastDayDate = new Date(Date.UTC(year, month - 1, 0)); // UTC月は0始まり
  const lastDay = lastDayDate.toISOString().slice(0, 10);

  // YYYY-MM 形式（SQLのstrftime比較用）
  const lastMonthStr = `${lastYear}-${String(lastMonth).padStart(2, '0')}`;

  // 表示ラベル
  const label = `${lastYear}年${lastMonth}月`;

  return { firstDay, lastDay, lastMonthStr, label };
}

// =============================================
// GET /api/ranking - 週・月・先月ランキング
// =============================================
ranking.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const { todayStr, monthStr, mondayStr, sundayStr, weekLabel, monthLabel } = getJstRankingPeriod();

  // ─────────────────────────────────────────
  // 今日の秒数集計（全ユーザー）— 今日増加分の表示用
  // ─────────────────────────────────────────
  const todayAllRows = await db.prepare(`
    SELECT u.user_id,
           COALESCE(u.display_name, u.user_id) AS display_name,
           COALESCE(SUM(ss.total_seconds), 0) AS today_seconds
    FROM study_sessions ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.status  = 'finished'
      AND ss.subject IS NOT NULL
      AND date(ss.started_at, '+9 hours') = ?
    GROUP BY ss.user_id
  `).bind(todayStr).all<{ user_id: string; display_name: string; today_seconds: number }>();

  // display_name → today_seconds のマップ
  const todayMap: Record<string, number> = {};
  for (const r of (todayAllRows.results ?? [])) {
    todayMap[r.display_name] = r.today_seconds;
  }

  // ─────────────────────────────────────────
  // 今週のランキング集計（全ユーザー）
  // 月曜 00:00 JST 〜 日曜 23:59 JST
  // date(started_at, '+9 hours') で JST 日付に変換
  // 表示名: COALESCE(u.display_name, u.user_id) でフォールバック付き
  // ─────────────────────────────────────────
  const weekAllRows = await db.prepare(`
    SELECT u.user_id,
           COALESCE(u.display_name, u.user_id) AS display_name,
           COALESCE(SUM(ss.total_seconds), 0) AS seconds
    FROM study_sessions ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.status  = 'finished'
      AND ss.subject IS NOT NULL
      AND date(ss.started_at, '+9 hours') >= ?
      AND date(ss.started_at, '+9 hours') <= ?
    GROUP BY ss.user_id
    ORDER BY seconds DESC
  `).bind(mondayStr, sundayStr).all<{ user_id: string; display_name: string; seconds: number }>();

  // today_seconds をマージ
  const weekAll = (weekAllRows.results ?? []).map(r => ({
    ...r,
    today_seconds: todayMap[r.display_name] ?? 0,
  }));

  // ログインユーザーの表示名を取得（自分の順位判定用）
  const myUserInfo = await db.prepare(
    'SELECT COALESCE(display_name, user_id) AS display_name FROM users WHERE id = ?'
  ).bind(userId).first<{ display_name: string }>();
  const myDisplayName = myUserInfo?.display_name ?? '';

  // 今週の上位5名（同率で5位を超えた場合は同率を含める）
  const weekRanked = assignRanks(weekAll);
  const weekTop5 = getTop5WithTies(weekRanked);

  // 自分の今週順位と秒数
  const myWeekEntry = weekRanked.find(r => r.display_name === myDisplayName);
  const myWeekRank = myWeekEntry?.rank ?? null;
  const myWeekSeconds = myWeekEntry?.seconds ?? 0;

  // ─────────────────────────────────────────
  // 今月のランキング集計（全ユーザー）
  // 1日 00:00 JST 〜 末日 23:59 JST
  // strftime('%Y-%m', started_at, '+9 hours') で JST 年月に変換
  // 表示名: COALESCE(u.display_name, u.user_id) でフォールバック付き
  // ─────────────────────────────────────────
  const monthAllRows = await db.prepare(`
    SELECT u.user_id,
           COALESCE(u.display_name, u.user_id) AS display_name,
           COALESCE(SUM(ss.total_seconds), 0) AS seconds
    FROM study_sessions ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.status  = 'finished'
      AND ss.subject IS NOT NULL
      AND strftime('%Y-%m', ss.started_at, '+9 hours') = ?
    GROUP BY ss.user_id
    ORDER BY seconds DESC
  `).bind(monthStr).all<{ user_id: string; display_name: string; seconds: number }>();

  // today_seconds をマージ
  const monthAll = (monthAllRows.results ?? []).map(r => ({
    ...r,
    today_seconds: todayMap[r.display_name] ?? 0,
  }));

  // 今月の上位5名（同率含む）
  const monthRanked = assignRanks(monthAll);
  const monthTop5 = getTop5WithTies(monthRanked);

  // 自分の今月順位と秒数
  const myMonthEntry = monthRanked.find(r => r.display_name === myDisplayName);
  const myMonthRank = myMonthEntry?.rank ?? null;
  const myMonthSeconds = myMonthEntry?.seconds ?? 0;

  // ─────────────────────────────────────────
  // 先月のランキング集計（TOP3＋同率）
  // ─────────────────────────────────────────
  const { firstDay, lastDay, lastMonthStr, label: lastMonthLabel } = getLastMonthPeriod();

  const lastMonthAllRows = await db.prepare(`
    SELECT u.user_id,
           COALESCE(u.display_name, u.user_id) AS display_name,
           COALESCE(SUM(ss.total_seconds), 0) AS seconds
    FROM study_sessions ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.status  = 'finished'
      AND ss.subject IS NOT NULL
      AND strftime('%Y-%m', ss.started_at, '+9 hours') = ?
    GROUP BY ss.user_id
    ORDER BY seconds DESC
  `).bind(lastMonthStr).all<{ user_id: string; display_name: string; seconds: number }>();

  const lastMonthAll    = lastMonthAllRows.results ?? [];
  const lastMonthRanked = assignRanks(lastMonthAll);
  // TOP3（同率3位は全員含める）
  const lastMonthTop3   = lastMonthRanked.filter(r => r.rank <= 3);

  // 自分の先月順位と秒数
  const myLastMonthEntry   = lastMonthRanked.find(r => r.display_name === myDisplayName);
  const myLastMonthRank    = myLastMonthEntry?.rank ?? null;
  const myLastMonthSeconds = myLastMonthEntry?.seconds ?? 0;

  return c.json({
    success: true,
    data: {
      week: {
        period_label: weekLabel,
        ranking: weekTop5,
        my_rank: myWeekRank,
        my_seconds: myWeekSeconds,
      },
      month: {
        period_label: monthLabel,
        ranking: monthTop5,
        my_rank: myMonthRank,
        my_seconds: myMonthSeconds,
      },
      last_month: {
        period_label: lastMonthLabel,
        ranking: lastMonthTop3,
        my_rank: myLastMonthRank,
        my_seconds: myLastMonthSeconds,
      },
    },
  });
});

// ─────────────────────────────────────────────────
// 上位5位（同率含む）を取得するヘルパー
// 例: 1,1,3,4,5,5 → 全員返す（5位が複数いる場合も含める）
// 例: 1,2,3,4,5,6 → 1〜5のみ
// ─────────────────────────────────────────────────
function getTop5WithTies(ranked: { rank: number; user_id: string; display_name: string; seconds: number }[]) {
  return ranked.filter(r => r.rank <= 5);
}

export default ranking;
