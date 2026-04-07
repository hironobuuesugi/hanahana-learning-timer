// =============================================
// 花はな Learning Timer - タイマーAPIルート
//
// POST /api/timer/start          - タイマー開始
// POST /api/timer/pause          - 一時停止
// POST /api/timer/resume         - 再開（一時停止→再開）
// POST /api/timer/finish         - 終了・合計時間確定
// POST /api/timer/freeze         - 凍結（ホーム戻り / ブラウザ離脱検知時）
// POST /api/timer/resume-frozen  - 凍結状態から再開
// POST /api/timer/finish-frozen  - 凍結状態からそのまま終了
// GET  /api/timer/current        - 現在のセッション状態取得
// =============================================

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables, StudySessionRecord, SessionPauseRecord, TimerStateResponse } from '../types'

const timer = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 全エンドポイントに認証を適用
timer.use('*', authMiddleware)

// =============================================
// 共通ヘルパー: アクティブセッションを取得
// 対象: running / paused / frozen
// =============================================
async function getActiveSession(db: D1Database, userId: number): Promise<StudySessionRecord | null> {
  return db.prepare(
    `SELECT * FROM study_sessions
     WHERE user_id = ? AND status IN ('running', 'paused', 'frozen')
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
    finished_at: session.finished_at ?? null,
    frozen_at: (session as any).frozen_at ?? null,
    total_seconds: session.total_seconds,
    auto_stopped: session.auto_stopped ?? 0,
    pauses: pauses.map(p => ({
      pause_at: p.pause_at,
      resume_at: p.resume_at ?? null,
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
  pauses: { pause_at: string; resume_at: string | null }[]
): number {
  const start = new Date(startedAt).getTime();
  const end   = new Date(finishedAt).getTime();
  const totalElapsed = Math.floor((end - start) / 1000);

  let pausedSeconds = 0;
  for (const p of pauses) {
    if (p.resume_at) {
      const pauseMs  = new Date(p.pause_at).getTime();
      const resumeMs = new Date(p.resume_at).getTime();
      pausedSeconds += Math.floor((resumeMs - pauseMs) / 1000);
    }
    // resume_at が null のものは呼び出し元で閉じてから渡す
  }

  return Math.max(0, totalElapsed - pausedSeconds);
}

// =============================================
// GET /api/timer/current - 現在のセッション状態を取得
// =============================================
timer.get('/current', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: true, data: null });
  }

  const state = await buildTimerState(db, session);
  return c.json({ success: true, data: state });
});

// =============================================
// GET /api/timer/pending-record
// 90分自動停止後で未記録（subject IS NULL）の finished セッションを返す。
// タイマーページを開いた時に確認し、案内バナーと記録ダイアログを表示するために使う。
// =============================================
timer.get('/pending-record', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await db.prepare(
    `SELECT * FROM study_sessions
     WHERE user_id = ? AND status = 'finished' AND auto_stopped = 1 AND subject IS NULL
     ORDER BY finished_at DESC LIMIT 1`
  ).bind(userId).first<StudySessionRecord>();

  if (!session) {
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

  const existing = await getActiveSession(db, userId);
  if (existing) {
    const state = await buildTimerState(db, existing);
    return c.json({
      success: false,
      error: 'すでに別のタイマーが動いています',
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

  await db.prepare(
    `INSERT INTO session_pauses (session_id, pause_at) VALUES (?, ?)`
  ).bind(session.id, now).run();

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
// POST /api/timer/resume - 再開（一時停止→再開）
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

  await db.prepare(
    `UPDATE session_pauses
     SET resume_at = ?
     WHERE session_id = ? AND resume_at IS NULL
     ORDER BY pause_at DESC LIMIT 1`
  ).bind(now, session.id).run();

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

  // frozen状態でのfinishは finish-frozen を使うよう誘導
  if (session.status === 'frozen') {
    return c.json({ success: false, error: '確認待ちのセッションは /finish-frozen を使用してください' }, 409);
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

  const pauses = await getPauses(db, session.id);
  const totalSeconds = calcTotalSeconds(session.started_at, now, pauses);

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
// POST /api/timer/freeze - セッションを凍結する
//
// 「ホームへ戻る」「ブラウザ離脱」時に呼ぶ。
// 呼び出した瞬間までの累計勉強秒数を total_seconds に確定保存し、
// status を 'frozen' に変更する。
//
// frozen 状態の特徴:
//   - total_seconds が「確定済み」の累計秒数
//   - 以降は時間が加算されない
//   - 次回タイマー画面を開くと確認ダイアログが表示される
//
// paused 中に freeze した場合:
//   - 一時停止ログを閉じ（resume_at = pause_at で差し引き0秒）
//   - 一時停止直前までの勉強時間を total_seconds に保存
// =============================================
timer.post('/freeze', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    // すでに終了 or セッションなし → 正常扱い
    return c.json({ success: true, message: 'セッションはありません', data: null });
  }

  // すでに frozen → 冪等に OK を返す
  if (session.status === 'frozen') {
    const state = await buildTimerState(db, session);
    return c.json({ success: true, message: 'すでに凍結済みです', data: state });
  }

  const now = new Date().toISOString();
  let totalSeconds = 0;

  if (session.status === 'paused') {
    // ─── 一時停止中に freeze ───
    // pause_at 時点が実質的な「勉強の中断時点」。
    // open な pause ログを取得し、resume_at = pause_at でクローズ
    // （差し引き 0 秒になるため、一時停止中の時間は加算されない）
    const allPauses = await getPauses(db, session.id);
    const lastOpenPause = allPauses.filter(p => !p.resume_at).sort(
      (a, b) => new Date(b.pause_at).getTime() - new Date(a.pause_at).getTime()
    )[0];

    const effectiveEnd = lastOpenPause ? lastOpenPause.pause_at : now;

    // 閉じた状態で計算
    const closedPauses = allPauses.map(p => ({
      pause_at: p.pause_at,
      resume_at: p.resume_at ?? effectiveEnd,
    }));
    totalSeconds = calcTotalSeconds(session.started_at, effectiveEnd, closedPauses);

    // DB の一時停止ログを整合性のために更新
    await db.prepare(
      `UPDATE session_pauses SET resume_at = ? WHERE session_id = ? AND resume_at IS NULL`
    ).bind(effectiveEnd, session.id).run();

  } else {
    // ─── running 中に freeze ───
    // now 時点までの勉強時間を計算
    const pauses = await getPauses(db, session.id);
    totalSeconds = calcTotalSeconds(session.started_at, now, pauses);
  }

  // status を frozen に変更、確定した total_seconds を保存
  await db.prepare(
    `UPDATE study_sessions
     SET status = 'frozen', frozen_at = ?, total_seconds = ?, updated_at = ?
     WHERE id = ?`
  ).bind(now, totalSeconds, now, session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({
    success: true,
    message: `セッションを保存しました（${formatSeconds(totalSeconds)}）`,
    data: state,
  });
});

// =============================================
// POST /api/timer/resume-frozen - 凍結状態から再開
//
// 「再開する」ボタンを押した時に呼ぶ。
// 凍結時点の total_seconds を引き継ぎ、
// frozen_at を新しい started_at として re-start する。
//
// 実装方式（シンプル版）:
//   - 既存の frozen セッションを finished に変更
//   - 新しい running セッションを total_seconds=0、
//     started_at=now で作成
//   - フロントエンドは resumed_seconds（= 引き継ぎ秒数）を加算して表示
//
// ただし、上記は複雑になるため、より明快な方式を採用:
//   - frozen セッションの status を running に戻す
//   - started_at を「now - total_seconds 秒前」に書き換える
//   - pauses テーブルは空の状態にする（freeze 時に整合済み）
//
// これにより calcElapsedSeconds は「adjusted_start から now まで」
// = total_seconds + (now - resume_time) を正確に返す。
// =============================================
timer.post('/resume-frozen', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: false, error: '再開するセッションがありません' }, 404);
  }
  if (session.status !== 'frozen') {
    return c.json({ success: false, error: 'セッションは凍結状態ではありません' }, 409);
  }

  const now = new Date().toISOString();
  const savedSeconds = session.total_seconds;

  // 「now - savedSeconds 秒前」を新しい started_at にする
  // → calcElapsedSeconds(state) = (now - adjusted_start) = savedSeconds + 経過秒数
  const adjustedStartMs = Date.now() - savedSeconds * 1000;
  const adjustedStartAt = new Date(adjustedStartMs).toISOString();

  await db.prepare(
    `UPDATE study_sessions
     SET status = 'running',
         started_at = ?,
         frozen_at = NULL,
         total_seconds = 0,
         updated_at = ?
     WHERE id = ?`
  ).bind(adjustedStartAt, now, session.id).run();

  // pause ログも不要（freeze 時にすべて閉じ済み）
  // ただし古い pause ログが残っているとズレるので削除
  await db.prepare(
    `DELETE FROM session_pauses WHERE session_id = ?`
  ).bind(session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({
    success: true,
    message: '再開しました！',
    data: state,
  });
});

// =============================================
// POST /api/timer/finish-frozen - 凍結状態からそのまま終了
//
// 「ここで終了する」ボタンを押した時に呼ぶ。
// frozen 時点で確定済みの total_seconds でそのまま終了する。
// 確認ダイアログが表示されていた間の時間は一切加算しない。
// =============================================
timer.post('/finish-frozen', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: false, error: '終了するセッションがありません' }, 404);
  }
  if (session.status !== 'frozen') {
    return c.json({ success: false, error: 'セッションは凍結状態ではありません' }, 409);
  }

  const now = new Date().toISOString();
  const totalSeconds = session.total_seconds; // 凍結時に確定済み

  await db.prepare(
    `UPDATE study_sessions
     SET status = 'finished',
         finished_at = ?,
         updated_at = ?
     WHERE id = ?`
  ).bind(now, now, session.id).run();

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
// POST /api/timer/record - 教科・勉強内容を記録する
//
// フィニッシュ後（status = 'finished'）のセッションに
// subjects（教科・複数可）と memo（勉強内容）を保存する。
//
// body: { session_id: number, subjects: string[], memo: string }
//
// subjects の有効値（複数選択可・1件以上必須）:
//   'english' | 'math' | 'japanese' | 'science' | 'social' | 'other'
//
// DB には subject カラムにカンマ区切り文字列で保存する。
//   例: ['english', 'math'] → 'english,math'
// =============================================
timer.post('/record', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  let body: { session_id?: unknown; subjects?: unknown; memo?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'リクエストの形式が正しくありません' }, 400);
  }

  const { session_id, subjects, memo } = body;

  // バリデーション: session_id
  if (!session_id || typeof session_id !== 'number') {
    return c.json({ success: false, error: 'session_id が必要です' }, 400);
  }

  // バリデーション: subjects（配列・1件以上）
  if (!Array.isArray(subjects) || (subjects as unknown[]).length === 0) {
    return c.json({ success: false, error: '教科を1つ以上選択してください' }, 400);
  }
  const validSubjects = ['english', 'math', 'japanese', 'science', 'social', 'other'];
  for (const s of subjects as unknown[]) {
    if (typeof s !== 'string' || !validSubjects.includes(s)) {
      return c.json({ success: false, error: '無効な教科が含まれています' }, 400);
    }
  }

  // バリデーション: memo
  if (!memo || typeof memo !== 'string' || (memo as string).trim() === '') {
    return c.json({ success: false, error: '勉強内容を入力してください' }, 400);
  }

  // セッションが自分のもので、finished であることを確認
  const session = await db.prepare(
    `SELECT * FROM study_sessions WHERE id = ? AND user_id = ? AND status = 'finished'`
  ).bind(session_id, userId).first<StudySessionRecord>();

  if (!session) {
    return c.json({ success: false, error: '記録対象のセッションが見つかりません' }, 404);
  }

  // 300秒（5分）未満のセッションは保存不可
  if ((session.total_seconds ?? 0) < 300) {
    return c.json({ success: false, error: '5分未満の勉強は記録できません' }, 422);
  }

  // 既に記録済みかチェック
  if ((session as any).subject) {
    return c.json({ success: false, error: 'すでに記録済みです' }, 409);
  }

  const now = new Date().toISOString();
  // 複数教科はカンマ区切り文字列として保存
  const subjectStr = (subjects as string[]).join(',');
  const memoTrimmed = (memo as string).trim();

  await db.prepare(
    `UPDATE study_sessions SET subject = ?, memo = ?, updated_at = ? WHERE id = ?`
  ).bind(subjectStr, memoTrimmed, now, session_id).run();

  return c.json({
    success: true,
    message: '記録しました！',
    data: { session_id, subjects: subjects as string[], subject: subjectStr, memo: memoTrimmed },
  });
});

// =============================================
// POST /api/timer/finish-abandoned (後方互換)
// 旧エンドポイント。finish-frozen に委譲。
// =============================================
timer.post('/finish-abandoned', async (c) => {
  // freeze してから finish-frozen を呼ぶ流れにリダイレクト
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);
  if (!session) {
    return c.json({ success: false, error: '終了するセッションがありません' }, 404);
  }

  const now = new Date().toISOString();

  if (session.status !== 'frozen') {
    // まず freeze する
    let totalSeconds = 0;
    if (session.status === 'paused') {
      const allPauses = await getPauses(db, session.id);
      const lastOpenPause = allPauses.filter(p => !p.resume_at)[0];
      const effectiveEnd = lastOpenPause ? lastOpenPause.pause_at : now;
      const closedPauses = allPauses.map(p => ({
        pause_at: p.pause_at,
        resume_at: p.resume_at ?? effectiveEnd,
      }));
      totalSeconds = calcTotalSeconds(session.started_at, effectiveEnd, closedPauses);
      await db.prepare(
        `UPDATE session_pauses SET resume_at = ? WHERE session_id = ? AND resume_at IS NULL`
      ).bind(effectiveEnd, session.id).run();
    } else {
      const pauses = await getPauses(db, session.id);
      totalSeconds = calcTotalSeconds(session.started_at, now, pauses);
    }
    await db.prepare(
      `UPDATE study_sessions SET status = 'frozen', frozen_at = ?, total_seconds = ?, updated_at = ? WHERE id = ?`
    ).bind(now, totalSeconds, now, session.id).run();
  }

  // frozen 状態で終了
  const savedSeconds = (session.status === 'frozen') ? session.total_seconds
    : (() => {
      // 計算済みの値を取り出し
      return session.total_seconds;
    })();

  await db.prepare(
    `UPDATE study_sessions SET status = 'finished', finished_at = ?, updated_at = ? WHERE id = ?`
  ).bind(now, now, session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({
    success: true,
    message: `記録しました！${formatSeconds(updated!.total_seconds)}勉強しました`,
    data: state,
  });
});

// =============================================
// POST /api/timer/auto-stop
//
// 90分経過時にフロントエンドから呼ぶ。
// running/paused 状態のセッションを自動停止（auto_stopped=1）に変更する。
// 記録確定はしない（subject/memo は入力待ち）。
// =============================================
timer.post('/auto-stop', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const session = await getActiveSession(db, userId);

  if (!session) {
    return c.json({ success: false, error: 'アクティブなセッションがありません' }, 404);
  }

  const now = new Date().toISOString();

  // 一時停止中のままなら resume_at を now に閉じる
  if (session.status === 'paused') {
    await db.prepare(
      `UPDATE session_pauses SET resume_at = ? WHERE session_id = ? AND resume_at IS NULL`
    ).bind(now, session.id).run();
  }

  const pauses = await getPauses(db, session.id);
  const totalSeconds = calcTotalSeconds(session.started_at, now, pauses);

  // auto_stopped=1 で finished にする
  await db.prepare(
    `UPDATE study_sessions
     SET status = 'finished',
         finished_at = ?,
         total_seconds = ?,
         auto_stopped = 1,
         updated_at = ?
     WHERE id = ?`
  ).bind(now, totalSeconds, now, session.id).run();

  const updated = await db.prepare(
    'SELECT * FROM study_sessions WHERE id = ?'
  ).bind(session.id).first<StudySessionRecord>();

  const state = await buildTimerState(db, updated!);
  return c.json({
    success: true,
    message: `90分経過のため自動停止しました（${formatSeconds(totalSeconds)}）`,
    data: state,
  });
});

// =============================================
// GET /api/timer/auto-stop-count
//
// 今月（JST）のログインユーザーの自動停止回数を返す。
// =============================================
timer.get('/auto-stop-count', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  // JST 今月の開始・終了を UTC で算出
  // UTC+9 なので JST 月初 00:00 = UTC 前日 15:00
  const nowUtcMs = Date.now();
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const nowJst = new Date(nowUtcMs + jstOffsetMs);
  const jstYear = nowJst.getUTCFullYear();
  const jstMonth = nowJst.getUTCMonth(); // 0-indexed

  // JST 月初 00:00:00 を UTC に変換
  const monthStartUtc = new Date(Date.UTC(jstYear, jstMonth, 1, 0, 0, 0) - jstOffsetMs);
  // JST 翌月初 00:00:00 を UTC に変換
  const monthEndUtc = new Date(Date.UTC(jstYear, jstMonth + 1, 1, 0, 0, 0) - jstOffsetMs);

  const row = await db.prepare(
    `SELECT COUNT(*) as cnt FROM study_sessions
     WHERE user_id = ?
       AND auto_stopped = 1
       AND started_at >= ?
       AND started_at < ?`
  ).bind(userId, monthStartUtc.toISOString(), monthEndUtc.toISOString())
   .first<{ cnt: number }>();

  return c.json({
    success: true,
    data: { count: row?.cnt ?? 0 },
  });
});

// =============================================
// POST /api/timer/discard
// 60秒未満セッションを完全に無効化（DB から削除）する。
//
// 集計・一覧どちらにも残らないよう DELETE で除去する。
// 対象: ログインユーザー本人の finished セッションで
//       total_seconds < 60 かつ subject が NULL（記録未入力）のもの。
// =============================================
timer.post('/discard', async (c) => {
  const userId = c.get('userId');
  const db     = c.env.DB;

  // body から session_id を受け取る
  let body: { session_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'リクエストの形式が正しくありません' }, 400);
  }

  const { session_id } = body;
  if (!session_id || typeof session_id !== 'number') {
    return c.json({ success: false, error: 'session_id が必要です' }, 400);
  }

  // 本人所有・finished・300秒未満・未記録 であることを確認
  const session = await db.prepare(
    `SELECT id, total_seconds FROM study_sessions
     WHERE id = ? AND user_id = ? AND status = 'finished' AND subject IS NULL`
  ).bind(session_id, userId).first<{ id: number; total_seconds: number }>();

  if (!session) {
    // 見つからない場合も成功扱い（冪等性: すでに削除済み or 対象外）
    return c.json({ success: true, message: '対象セッションなし（処理不要）' });
  }

  if ((session.total_seconds ?? 0) >= 300) {
    return c.json({ success: false, error: '5分以上のセッションは破棄できません' }, 422);
  }

  // DELETE で完全除去（session_pauses は CASCADE で自動削除）
  await db.prepare(
    `DELETE FROM study_sessions WHERE id = ?`
  ).bind(session_id).run();

  return c.json({ success: true, message: '短時間セッションを破棄しました' });
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
