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

// =============================================
// GET /api/stats/subjects - 今月の教科別勉強時間集計
//
// レスポンス:
//   {
//     success: true,
//     data: {
//       english:  number,  // 英語（秒）
//       math:     number,  // 数学（秒）
//       japanese: number,  // 国語（秒）
//       science:  number,  // 理科（秒）
//       social:   number,  // 社会（秒）
//       other:    number,  // その他（秒）
//     }
//   }
//
// 計算ルール:
//   - 対象: status='finished' かつ subject IS NOT NULL
//   - 期間: JST 今月 (strftime('%Y-%m', started_at, '+9 hours') = 今月YYYY-MM)
//   - 複数教科選択時は total_seconds を教科数で均等配分（秒単位）
//   - 配分は浮動小数で合計し、最終的に Math.floor で整数秒に変換
// =============================================
stats.get('/subjects', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // JST 今月を取得（既存の getJstDateInfo() と同じロジック）
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const monthStr = jstNow.toISOString().slice(0, 7); // YYYY-MM

  // 今月の全セッション（subject カラムを含む）を取得
  const rows = await db.prepare(`
    SELECT total_seconds, subject
    FROM study_sessions
    WHERE user_id = ?
      AND status  = 'finished'
      AND subject IS NOT NULL
      AND strftime('%Y-%m', started_at, '+9 hours') = ?
  `).bind(userId, monthStr).all<{ total_seconds: number; subject: string }>();

  // 教科別秒数アキュムレータ（浮動小数で正確に積算）
  const acc: Record<string, number> = {
    english:  0,
    math:     0,
    japanese: 0,
    science:  0,
    social:   0,
    other:    0,
  };
  const KNOWN_SUBJECTS = Object.keys(acc);

  for (const row of rows.results ?? []) {
    // subject は "english,math,social" のようなカンマ区切り文字列
    const codes = row.subject.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (codes.length === 0) continue;

    // 均等配分: total_seconds ÷ 教科数
    const share = row.total_seconds / codes.length;

    for (const code of codes) {
      // 既知教科はそのまま、未知コードは other に合算
      const key = KNOWN_SUBJECTS.includes(code) ? code : 'other';
      acc[key] += share;
    }
  }

  return c.json({
    success: true,
    data: {
      english:  Math.floor(acc.english),
      math:     Math.floor(acc.math),
      japanese: Math.floor(acc.japanese),
      science:  Math.floor(acc.science),
      social:   Math.floor(acc.social),
      other:    Math.floor(acc.other),
    },
  });
});

// =============================================
// GET /api/stats/streak - 連続記録日数・自己ベスト連続記録日数
//
// レスポンス:
//   {
//     success: true,
//     data: {
//       current_streak: number,  // 現在の連続記録日数（JST基準、今日まで）
//       best_streak:    number,  // 過去最大の連続記録日数
//     }
//   }
//
// 計算ルール:
//   - 対象: status='finished' かつ subject IS NOT NULL（記録保存済みセッション）
//   - 1日に1回でも記録保存したらその日を「達成日」とカウント
//   - 日付は JST 基準 (date(started_at, '+9 hours'))
//   - current_streak: 今日(JST)から遡って連続している日数
//     ※今日に記録があれば今日を含む、なければ昨日から遡る
//   - best_streak: 全期間の最大連続記録日数
// =============================================
stats.get('/streak', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // JST 今日の日付文字列を取得
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jstNow.toISOString().slice(0, 10); // YYYY-MM-DD

  // 記録がある全日付リストを JST で取得（降順）
  const rows = await db.prepare(`
    SELECT DISTINCT date(started_at, '+9 hours') AS jst_date
    FROM study_sessions
    WHERE user_id = ?
      AND status  = 'finished'
      AND subject IS NOT NULL
    ORDER BY jst_date DESC
  `).bind(userId).all<{ jst_date: string }>();

  const dates: string[] = (rows.results ?? []).map(r => r.jst_date);

  if (dates.length === 0) {
    return c.json({ success: true, data: { current_streak: 0, best_streak: 0 } });
  }

  // ─────────────────────────────────────────
  // current_streak 計算
  //   1. 今日(JST)に記録があれば今日を起点にして遡る
  //   2. 今日に記録がなく昨日に記録があれば昨日を起点にして遡る
  //   3. どちらもなければ 0
  // ─────────────────────────────────────────
  const dateSet = new Set(dates);

  // 今日の前日 (JST)
  const yesterdayJst = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayJst.toISOString().slice(0, 10);

  let currentStreak = 0;
  if (dateSet.has(todayStr)) {
    // 今日を含めて遡る
    let checkDate = new Date(jstNow);
    while (true) {
      const d = checkDate.toISOString().slice(0, 10);
      if (!dateSet.has(d)) break;
      currentStreak++;
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
    }
  } else if (dateSet.has(yesterdayStr)) {
    // 昨日から遡る（今日はまだ勉強していないが連続中）
    let checkDate = new Date(yesterdayJst);
    while (true) {
      const d = checkDate.toISOString().slice(0, 10);
      if (!dateSet.has(d)) break;
      currentStreak++;
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
    }
  }
  // 今日も昨日も記録がなければ currentStreak = 0

  // ─────────────────────────────────────────
  // best_streak 計算
  //   昇順に並んだ全達成日リストを1日ずつチェックし
  //   連続している区間の最大長を求める
  // ─────────────────────────────────────────
  const sortedDates = [...dates].sort(); // 昇順
  let bestStreak = 1;
  let runStreak  = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00Z');
    const curr = new Date(sortedDates[i]     + 'T00:00:00Z');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      runStreak++;
      if (runStreak > bestStreak) bestStreak = runStreak;
    } else {
      runStreak = 1;
    }
  }

  // current_streak が best_streak を超える場合も考慮
  if (currentStreak > bestStreak) bestStreak = currentStreak;

  return c.json({
    success: true,
    data: {
      current_streak: currentStreak,
      best_streak:    bestStreak,
    },
  });
});

export default stats;
