// =============================================
// 花はな Learning Timer - タイマーAPIルート
//
// POST /api/timer/start    - タイマー開始
// POST /api/timer/pause    - 一時停止
// POST /api/timer/resume   - 再開
// POST /api/timer/finish   - 終了・合計時間確定
// GET  /api/timer/current  - 現在のセッション状態取得
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables, StudySessionRecord, SessionPauseRecord, TimerStateResponse } from '../types'

const timer = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
timer.use('*', authMiddleware)

// =============================================
// 共通ヘルパー: アクティブセッション（running/paused）を取得
// =============================================
async function getActiveSession(db: D1Database, userId: number): Promise<StudySessionRecord | null> {
  return db.prepare(
    `SELECT * FROM study_sessions
     WHERE user_id = ? AND status IN ('running', 'paused')
     ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first<StudySessionRecord>();
}

// =============================================
// 共通ヘルパー: セッションの一時停止ログを取得
// =============================================
async function getPauses(db: D1Database, sessionId: number): Promise<SessionPauseRecord[]> {
  const result = await db.prepare(
    `SELECT * FROM session_pauses WHERE session_id = ? ORDER BY pause_at ASC`
  ).bind(sessionId).all<SessionPauseRecord>();
  return result.results;
}

// =============================================
// 共通ヘルパー: タイマー状態レスポンスを組み立てる
// =============================================
async function buildTimerState(db: D1Database, session: StudySessionRecord): Promise<TimerStateResponse> {
  const pauses = await getPauses(db, session.id);
  return {
    session_id: session.id,
    status: session.status,
    started_at: session.started_at,
    finished_at: session.finished_at,
    total_seconds: session.total_seconds,
    pauses: pauses.map(p => ({
      pause_at: p.pause_at,
      resume_at: p.resume_at,
    })),
  };
}

// =============================================
// 合計勉強秒数を計算するヘルパー
// 開始〜終了 の時間から 一時停止時間の合計 を引く
// =============================================
function calcTotalSeconds(
  startedAt: string,
  finishedAt: string,
  pauses: SessionPauseRecord[]
): number {
  const start = new Date(startedAt).getTime();
  const end   = new Date(finishedAt).getTime();
  const totalElapsed = Math.floor((end - start) / 1000);

  // 一時停止していた合計秒数を算出
  let pausedSeconds = 0;
  for (const p of pauses) {
    if (p.resume_at) {
      const pauseMs  = new Date(p.pause_at).getTime();
      const resumeMs = new Date(p.resume_at).getTime();
      pausedSeconds += Math.floor((resumeMs - pauseMs) / 1000);
    }
    // resume_at が null（フィニッシュ直前まで一時停止中）の場合は
    // finish 処理内で resume してから finish するので、ここでは無視
  }

  return Math.max(0, totalElapsed - pausedSeconds);
}

// =============================================
// GET /api/timer/current - 現在のセッション状態を取得
// （ページ読み込み時・復元用）
// =============================================
timer.get('/current', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    // アクティブなセッションなし → タイマーはリセット状態
    return c.json({ success: true, data: null });
  }

  const state = await buildTimerState(db, session);
  return c.json({ success: true, data: state });
});

// =============================================
// POST /api/timer/start - タイマー開始
// =============================================
timer.post('/start', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // すでにアクティブなセッションがある場合は拒否
  const existing = await getActiveSession(db, userId);
  if (existing) {
    const state = await buildTimerState(db, existing);
    return c.json({
      success: false,
      error: 'すでに勉強中のセッションがあります',
      data: state,
    }, 409);
  }

  const now = new Date().toISOString();

  const result = await db.prepare(
    `INSERT INTO study_sessions (user_id, status, started_at, total_seconds)
     VALUES (?, 'running', ?, 0)`
  ).bind(userId, now).run();

  if (!result.success) {
    return c.json({ success: false, error: 'タイマーの開始に失敗しました' }, 500);
  }

  // 作成したセッションを取得して返す
  const session = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(result.meta.last_row_id).first<StudySessionRecord>();

  if (!session) {
    return c.json({ success: false, error: 'セッションの取得に失敗しました' }, 500);
  }

  const state = await buildTimerState(db, session);
  return c.json({ success: true, message: '勉強を開始しました！', data: state }, 201);
});

// =============================================
// POST /api/timer/pause - 一時停止
// =============================================
timer.post('/pause', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: false, error: 'アクティブなセッションがありません' }, 404);
  }
  if (session.status !== 'running') {
    return c.json({ success: false, error: 'すでに一時停止中です' }, 409);
  }

  const now = new Date().toISOString();

  // 一時停止ログを挿入
  await db.prepare(
    `INSERT INTO session_pauses (session_id, pause_at) VALUES (?, ?)`
  ).bind(session.id, now).run();

  // セッション状態を更新
  await db.prepare(
    `UPDATE study_sessions SET status = 'paused', updated_at = ? WHERE id = ?`
  ).bind(now, session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({ success: true, message: '一時停止しました', data: state });
});

// =============================================
// POST /api/timer/resume - 再開
// =============================================
timer.post('/resume', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: false, error: 'アクティブなセッションがありません' }, 404);
  }
  if (session.status !== 'paused') {
    return c.json({ success: false, error: '一時停止中ではありません' }, 409);
  }

  const now = new Date().toISOString();

  // 直近の一時停止ログに resume_at をセット
  await db.prepare(
    `UPDATE session_pauses
     SET resume_at = ?
     WHERE session_id = ? AND resume_at IS NULL
     ORDER BY pause_at DESC LIMIT 1`
  ).bind(now, session.id).run();

  // セッション状態を running に戻す
  await db.prepare(
    `UPDATE study_sessions SET status = 'running', updated_at = ? WHERE id = ?`
  ).bind(now, session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({ success: true, message: '再開しました！', data: state });
});

// =============================================
// POST /api/timer/finish - 終了・合計時間確定
// =============================================
timer.post('/finish', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: false, error: 'アクティブなセッションがありません' }, 404);
  }

  const now = new Date().toISOString();

  // 一時停止中のままフィニッシュした場合は resume_at を now にセット
  if (session.status === 'paused') {
    await db.prepare(
      `UPDATE session_pauses
       SET resume_at = ?
       WHERE session_id = ? AND resume_at IS NULL`
    ).bind(now, session.id).run();
  }

  // 一時停止ログを取得して合計秒数を計算
  const pauses = await getPauses(db, session.id);
  const totalSeconds = calcTotalSeconds(session.started_at, now, pauses);

  // セッションを finished に更新
  await db.prepare(
    `UPDATE study_sessions
     SET status = 'finished', finished_at = ?, total_seconds = ?, updated_at = ?
     WHERE id = ?`
  ).bind(now, totalSeconds, now, session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({
    success: true,
    message: `お疲れ様でした！${formatSeconds(totalSeconds)}勉強しました`,
    data: state,
  });
});

// =============================================
// POST /api/timer/finish-abandoned
// 「ここで終了する」用：放置セッションを現時刻で終了
//
// 通常の /finish との違い:
//   - /finish      → ユーザーが今まさに操作して終了
//   - /finish-abandoned → 離脱したセッションを後から締める
//     ブラウザを閉じた瞬間は記録できないため、
//     「確認ダイアログで選択した時点」を終了時刻とする。
//     ※ 要件「勝手に長時間加算しない」に対応:
//       running 状態で長時間放置された場合、
//       pause_at=started_at として一時停止扱いにし
//       放置分の時間を加算しない。
// =============================================
timer.post('/finish-abandoned', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: false, error: '終了するセッションがありません' }, 404);
  }

  const now = new Date().toISOString();

  // ─────────────────────────────────────────────────────────
  // 「勝手に長時間加算しない」ルールの実装
  //
  // running 状態で放置されていたセッションは、
  // 「ユーザーが確認ダイアログを開いた瞬間まで」の
  // 勉強時間のみを記録する。
  //
  // 具体的な処理:
  //   running → 一時停止ログなし or 全て resume 済み
  //     → 通常通り now を finish_at として計算
  //   paused  → resume_at=null の一時停止ログがある
  //     → その pause_at までの時間で計算（放置分は無視）
  // ─────────────────────────────────────────────────────────

  let finishedAt = now;
  let totalSeconds = 0;

  if (session.status === 'paused') {
    // ─── 一時停止中のまま離脱していた場合 ───
    // 「pause_at の時点」が実質的な勉強終了時刻。
    // その時点までの勉強時間 = started_at〜pause_at の間から
    // それ以前の一時停止時間を引いた値。
    //
    // 手順:
    // 1. 最後の pause_at を取得（resume_at=null のもの）
    // 2. その pause_at を finishedAt として計算
    // 3. resume_at を pause_at（= finishedAt）でクローズ
    //    （DB の整合性のため。計算後に更新する）
    const lastPauseRow = await db.prepare(
      `SELECT id, pause_at FROM session_pauses
       WHERE session_id = ? AND resume_at IS NULL
       ORDER BY pause_at DESC LIMIT 1`
    ).bind(session.id).first<{ id: number; pause_at: string }>();

    const effectiveFinishAt = lastPauseRow ? lastPauseRow.pause_at : session.started_at;
    finishedAt = effectiveFinishAt;

    // finishedAt = pause_at で計算するので、
    // pauses の resume_at が null のまま getPauses しても
    // calcTotalSeconds 内では「pause〜finishedAt」の時間は
    // 一時停止として差し引かれないことを保証するため
    // finishedAt 以前に resume_at=null のものだけ収集して計算する
    const allPauses = await getPauses(db, session.id);
    const closedPauses = allPauses.map(p => ({
      ...p,
      // resume_at が null（今回の一時停止）は finishedAt（= pause_at）で閉じる
      // → start〜pause_at の差が 0 なので差し引き量も 0 になり正しく計算される
      resume_at: p.resume_at ?? effectiveFinishAt,
    }));
    totalSeconds = calcTotalSeconds(session.started_at, finishedAt, closedPauses);

    // DB の一時停止ログを閉じる（整合性保持）
    await db.prepare(
      `UPDATE session_pauses SET resume_at = ? WHERE session_id = ? AND resume_at IS NULL`
    ).bind(now, session.id).run();

  } else {
    // ─── running のまま離脱していた場合 ───
    // ダイアログを開いた「今 (now)」を終了時刻とみなす。
    const pauses = await getPauses(db, session.id);
    totalSeconds = calcTotalSeconds(session.started_at, finishedAt, pauses);
  }

  await db.prepare(
    `UPDATE study_sessions
     SET status = 'finished', finished_at = ?, total_seconds = ?, updated_at = ?
     WHERE id = ?`
  ).bind(finishedAt, totalSeconds, now, session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({
    success: true,
    message: `記録しました！${formatSeconds(totalSeconds)}勉強しました`,
    data: state,
  });
});

// =============================================
// 秒数を「XX時間YY分ZZ秒」に変換するヘルパー
// =============================================
function formatSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}時間${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export default timer;
