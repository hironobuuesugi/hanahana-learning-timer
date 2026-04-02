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
//   - 表示するユーザー名は user_id をそのまま使用
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
// input: [{user_id, seconds}, ...] (seconds 降順ソート済み)
// output: [{rank, user_id, seconds}, ...]
// ─────────────────────────────────────────────────
function assignRanks(rows: { user_id: string; seconds: number }[]) {
  const result: { rank: number; user_id: string; seconds: number }[] = [];
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].seconds < rows[i - 1].seconds) {
      rank = i + 1;
    }
    result.push({ rank, user_id: rows[i].user_id, seconds: rows[i].seconds });
  }
  return result;
}

// =============================================
// GET /api/ranking - 週・月ランキング
// =============================================
ranking.get('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const { monthStr, mondayStr, sundayStr, weekLabel, monthLabel } = getJstRankingPeriod();

  // ─────────────────────────────────────────
  // 今週のランキング集計（全ユーザー）
  // 月曜 00:00 JST 〜 日曜 23:59 JST
  // date(started_at, '+9 hours') で JST 日付に変換
  // study_sessions.user_id は users.id (INTEGER) なので JOIN して表示名を取得
  // ─────────────────────────────────────────
  const weekAllRows = await db.prepare(`
    SELECT u.user_id AS user_id, COALESCE(SUM(ss.total_seconds), 0) AS seconds
    FROM study_sessions ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.status  = 'finished'
      AND ss.subject IS NOT NULL
      AND date(ss.started_at, '+9 hours') >= ?
      AND date(ss.started_at, '+9 hours') <= ?
    GROUP BY ss.user_id
    ORDER BY seconds DESC
  `).bind(mondayStr, sundayStr).all<{ user_id: string; seconds: number }>();

  const weekAll = weekAllRows.results ?? [];

  // ログインユーザーの文字列user_idを取得
  const myUserInfo = await db.prepare(
    'SELECT user_id FROM users WHERE id = ?'
  ).bind(userId).first<{ user_id: string }>();
  const myUserStrId = myUserInfo?.user_id ?? '';

  // 今週の上位5名（同率で5位を超えた場合は同率を含める）
  const weekRanked = assignRanks(weekAll);
  const weekTop5 = getTop5WithTies(weekRanked);

  // 自分の今週順位と秒数
  const myWeekEntry = weekRanked.find(r => r.user_id === myUserStrId);
  const myWeekRank = myWeekEntry?.rank ?? null;
  const myWeekSeconds = myWeekEntry?.seconds ?? 0;

  // ─────────────────────────────────────────
  // 今月のランキング集計（全ユーザー）
  // 1日 00:00 JST 〜 末日 23:59 JST
  // strftime('%Y-%m', started_at, '+9 hours') で JST 年月に変換
  // ─────────────────────────────────────────
  const monthAllRows = await db.prepare(`
    SELECT u.user_id AS user_id, COALESCE(SUM(ss.total_seconds), 0) AS seconds
    FROM study_sessions ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.status  = 'finished'
      AND ss.subject IS NOT NULL
      AND strftime('%Y-%m', ss.started_at, '+9 hours') = ?
    GROUP BY ss.user_id
    ORDER BY seconds DESC
  `).bind(monthStr).all<{ user_id: string; seconds: number }>();

  const monthAll = monthAllRows.results ?? [];

  // 今月の上位5名（同率含む）
  const monthRanked = assignRanks(monthAll);
  const monthTop5 = getTop5WithTies(monthRanked);

  // 自分の今月順位と秒数
  const myMonthEntry = monthRanked.find(r => r.user_id === myUserStrId);
  const myMonthRank = myMonthEntry?.rank ?? null;
  const myMonthSeconds = myMonthEntry?.seconds ?? 0;

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
    },
  });
});

// ─────────────────────────────────────────────────
// 上位5位（同率含む）を取得するヘルパー
// 例: 1,1,3,4,5,5 → 全員返す（5位が複数いる場合も含める）
// 例: 1,2,3,4,5,6 → 1〜5のみ
// ─────────────────────────────────────────────────
function getTop5WithTies(ranked: { rank: number; user_id: string; seconds: number }[]) {
  return ranked.filter(r => r.rank <= 5);
}

export default ranking;
