// 花はな Learning Timer：本人用タイマー。時間上限と履歴をサーバーで保全する。
import { Hono } from 'hono';
import { saveAllocation, allocationError } from '../utils/subject-allocation';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables, StudySessionRecord, TimerStateResponse } from '../types';
import { eventStatement, nowISO, sessionLimit, snapshot, studySeconds, subjects } from '../utils/study-management';
const timer = new Hono<{
    Bindings: Bindings;
    Variables: Variables;
}>();
timer.use('*', authMiddleware);
async function active(db: D1Database, user: number) {
    return db.prepare("SELECT * FROM study_sessions WHERE user_id=? AND status IN ('running','paused','frozen') ORDER BY created_at DESC,id DESC LIMIT 1").bind(user).first<StudySessionRecord>();
}
async function state(db: D1Database, s: StudySessionRecord): Promise<TimerStateResponse> {
    const pauses = (await db.prepare('SELECT pause_at,resume_at FROM session_pauses WHERE session_id=? ORDER BY pause_at').bind(s.id).all<{
        pause_at: string;
        resume_at: string | null;
    }>()).results;
    return { session_id: s.id, status: s.status, started_at: s.started_at, original_started_at: s.original_started_at ?? s.started_at,
        frozen_at: s.frozen_at, finished_at: s.finished_at, total_seconds: s.total_seconds, auto_stopped: s.auto_stopped,
        time_limit_seconds: sessionLimit(s), auto_stop_seconds: s.auto_stop_seconds, revision: s.revision, pauses };
}
// 同時操作で古い状態を上書きしない。関連ログと変更履歴も同一batchで処理する。
async function transition(db: D1Database, s: StudySessionRecord, setSQL: string, values: unknown[], children: (token: string) => D1PreparedStatement[] = () => []) {
    const token = crypto.randomUUID();
    const result = await db.batch([db.prepare(`UPDATE study_sessions SET ${setSQL},updated_at=?,revision=revision+1,operation_token=? WHERE id=? AND user_id=? AND revision=? AND status=?`)
            .bind(...values, nowISO(), token, s.id, s.user_id, s.revision, s.status), ...children(token)]);
    if (result[0].meta.changes !== 1)
        return null;
    return db.prepare('SELECT * FROM study_sessions WHERE id=? AND user_id=?').bind(s.id, s.user_id).first<StudySessionRecord>();
}
const closePauses = (db: D1Database, s: StudySessionRecord, at: string, token: string) => db.prepare(`UPDATE session_pauses SET resume_at=? WHERE session_id=? AND resume_at IS NULL AND EXISTS(SELECT 1 FROM study_sessions WHERE id=? AND operation_token=?)`).bind(at, s.id, s.id, token);
export async function settleDue(db: D1Database, user: number) {
    const s = await active(db, user);
    if (!s) return null;
    const measured = await studySeconds(db, s);
    if (!Number.isFinite(measured) || measured < sessionLimit(s)) return null;
    const seconds = sessionLimit(s), now = nowISO();
    return transition(db, s, "status='finished',finished_at=?,total_seconds=?,auto_stopped=1,auto_stop_seconds=?", [now, seconds, seconds], token => [
        closePauses(db, s, now, token), eventStatement(db, user, user, s.id, 'auto_stop', snapshot(s), { ...snapshot(s), status: 'finished', total_seconds: seconds, auto_stop_seconds: seconds }, '', token)
    ]);
}
const conflict = () => ({ success: false, error: 'タイマーの状態が変わりました。もう一度確認してください' });
timer.get('/current', async (c) => {
    await settleDue(c.env.DB, c.get('userId'));
    const s = await active(c.env.DB, c.get('userId'));
    return c.json({ success: true, data: s ? await state(c.env.DB, s) : null });
});
timer.get('/pending-record', async (c) => {
    const db = c.env.DB, user = c.get('userId');
    await settleDue(db, user);
    const s = await db.prepare(`SELECT * FROM study_sessions WHERE user_id=? AND status='finished' AND subject IS NULL AND total_seconds>=300 ORDER BY finished_at,id LIMIT 1`).bind(user).first<StudySessionRecord>();
    const count = await db.prepare(`SELECT COUNT(*) AS cnt FROM study_sessions WHERE user_id=? AND status='finished' AND subject IS NULL AND total_seconds>=300`).bind(user).first<{
        cnt: number;
    }>();
    return c.json({ success: true, data: s ? await state(db, s) : null, pending_count: count?.cnt ?? 0 });
});
timer.post('/start', async (c) => {
    const db = c.env.DB, user = c.get('userId'), b = await c.req.json().catch(() => ({})), limit = b?.time_limit_seconds ?? 5400;
    if (limit !== 5400 && limit !== 7200)
        return c.json({ success: false, error: '90分または120分を選んでください' }, 400);
    const pending = await db.prepare(`SELECT * FROM study_sessions WHERE user_id=? AND status='finished' AND subject IS NULL AND total_seconds>=300 ORDER BY finished_at,id LIMIT 1`).bind(user).first<StudySessionRecord>();
    if (pending)
        return c.json({ success: false, code: 'PENDING_RECORD', error: '未保存の勉強記録を保存してから、新しいタイマーを開始してください', data: await state(db, pending) }, 409);
    const existing = await active(db, user);
    if (existing)
        return c.json({ success: false, error: 'すでに別のタイマーが動いています', data: await state(db, existing) }, 409);
    const now = nowISO();
    const result = await db.prepare(`INSERT INTO study_sessions(user_id,status,started_at,original_started_at,total_seconds,time_limit_seconds,history_tracked)
    SELECT ?,'running',?,?,0,?,1 WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND is_active=1 AND archived_at IS NULL) AND NOT EXISTS(SELECT 1 FROM study_sessions WHERE user_id=? AND (status IN ('running','paused','frozen') OR (status='finished' AND subject IS NULL AND total_seconds>=300)))`).bind(user, now, now, limit, user, user).run();
    if (result.meta.changes !== 1)
        return c.json(conflict(), 409);
    const s = await db.prepare('SELECT * FROM study_sessions WHERE id=?').bind(result.meta.last_row_id).first<StudySessionRecord>();
    return c.json({ success: true, message: '勉強を開始しました！', data: await state(db, s!) }, 201);
});
timer.post('/pause', async (c) => {
    const db = c.env.DB, s = await active(db, c.get('userId'));
    if (!s || s.status !== 'running')
        return c.json(conflict(), 409);
    const now = nowISO(), r = await transition(db, s, "status='paused'", [], token => [db.prepare(`INSERT INTO session_pauses(session_id,pause_at) SELECT ?,? WHERE EXISTS(SELECT 1 FROM study_sessions WHERE id=? AND operation_token=?)`).bind(s.id, now, s.id, token)]);
    return r ? c.json({ success: true, data: await state(db, r) }) : c.json(conflict(), 409);
});
timer.post('/resume', async (c) => {
    const db = c.env.DB, s = await active(db, c.get('userId'));
    if (!s || s.status !== 'paused')
        return c.json(conflict(), 409);
    const r = await transition(db, s, "status='running'", [], token => [closePauses(db, s, nowISO(), token)]);
    return r ? c.json({ success: true, data: await state(db, r) }) : c.json(conflict(), 409);
});
async function finish(db: D1Database, s: StudySessionRecord) {
    const seconds = await studySeconds(db, s), now = nowISO();
    if (!Number.isFinite(seconds)) return null;
    return transition(db, s, "status='finished',finished_at=?,total_seconds=?", [now, seconds], token => [closePauses(db, s, now, token)]);
}
for (const path of ['/finish', '/finish-frozen', '/finish-abandoned'])
    timer.post(path, async (c) => {
        const db = c.env.DB, s = await active(db, c.get('userId'));
        if (!s)
            return c.json(conflict(), 409);
        if (path === '/finish' && s.status === 'frozen')
            return c.json({ success: false, error: '確認待ちのタイマーを確認してください' }, 409);
        if (path === '/finish-frozen' && s.status !== 'frozen')
            return c.json(conflict(), 409);
        const r = await finish(db, s);
        return r ? c.json({ success: true, message: 'タイマーを終了しました', data: await state(db, r) }) : c.json(conflict(), 409);
    });
timer.post('/freeze', async (c) => {
    const db = c.env.DB, s = await active(db, c.get('userId'));
    if (!s)
        return c.json({ success: true, data: null });
    if (s.status === 'frozen')
        return c.json({ success: true, data: await state(db, s) });
    const seconds = await studySeconds(db, s), now = nowISO();
    if (!Number.isFinite(seconds)) return c.json({success:false,error:'タイマーの時刻を確認できません'},409);
    const r = await transition(db, s, "status='frozen',frozen_at=?,total_seconds=?", [now, seconds], token => [closePauses(db, s, now, token)]);
    return r ? c.json({ success: true, data: await state(db, r) }) : c.json(conflict(), 409);
});
timer.post('/resume-frozen', async (c) => {
    const db = c.env.DB, s = await active(db, c.get('userId'));
    if (!s || s.status !== 'frozen')
        return c.json(conflict(), 409);
    const adjusted = new Date(Date.now() - s.total_seconds * 1000).toISOString();
    const r = await transition(db, s, "status='running',original_started_at=COALESCE(original_started_at,started_at),started_at=?,frozen_at=NULL", [adjusted], token => [db.prepare(`DELETE FROM session_pauses WHERE session_id=? AND EXISTS(SELECT 1 FROM study_sessions WHERE id=? AND operation_token=?)`).bind(s.id, s.id, token)]);
    return r ? c.json({ success: true, data: await state(db, r) }) : c.json(conflict(), 409);
});
timer.post('/auto-stop', async (c) => {
    const db = c.env.DB, r = await settleDue(db, c.get('userId'));
    return r ? c.json({ success: true, data: await state(db, r) }) : c.json({ success: false, error: '自動停止の上限に達していないか、状態が変わりました' }, 422);
});
timer.get('/record-status', async (c) => {
    const id = Number(c.req.query('session_id')), s = await c.env.DB.prepare("SELECT id,subject,total_seconds FROM study_sessions WHERE id=? AND user_id=? AND status='finished'").bind(id, c.get('userId')).first<{
        id: number;
        subject: string | null;
        total_seconds: number;
    }>();
    return c.json({ success: true, data: { session_id: id, saved: !!s?.subject, resolved: !!s && (!!s.subject || s.total_seconds < 300) } });
});
timer.post('/record', async (c) => {
    const db = c.env.DB, user = c.get('userId'), b = await c.req.json().catch(() => null), subject = subjects(b?.subjects);
    if (!b || !Number.isSafeInteger(b.session_id) || !subject || typeof b.memo !== 'string' || !b.memo.trim() || b.memo.length > 500)
        return c.json({ success: false, error: '教科と500文字以内の勉強内容を入力してください' }, 400);
    const s = await db.prepare("SELECT * FROM study_sessions WHERE id=? AND user_id=? AND status='finished' AND subject IS NULL AND total_seconds>=300").bind(b.session_id, user).first<StudySessionRecord>();
    if (!s)
        return c.json({ success: false, error: '保存対象が変更されたか、すでに保存済みです' }, 409);
    const final = s.auto_stopped ? b.total_seconds ?? s.total_seconds : s.total_seconds;
    if (!Number.isSafeInteger(final) || final < 300 || (s.auto_stopped && final % 300 !== 0) || final > (s.auto_stop_seconds ?? s.total_seconds))
        return c.json({ success: false, error: final < 300 ? '学習時間が5分未満のため保存できません。5分以上に修正してください。' : '元の計測時間以下・5分刻みで指定してください' }, 422);
    const oldest = await db.prepare("SELECT id FROM study_sessions WHERE user_id=? AND status='finished' AND subject IS NULL AND total_seconds>=300 ORDER BY finished_at,id LIMIT 1").bind(user).first<{
        id: number;
    }>();
    if (oldest?.id !== s.id)
        return c.json({ success: false, error: '古い未保存記録から保存してください' }, 409);
    const allocation = saveAllocation(b.subjects, final, b.subject_allocations);
    if (!allocation) return c.json({success:false,error:allocationError},422);
    const after = { ...snapshot(s), ...allocation, subject, memo: b.memo.trim(), total_seconds: final, auto_stop_seconds: s.auto_stopped ? (s.auto_stop_seconds ?? s.total_seconds) : s.auto_stop_seconds };
    const r = await transition(db, s, 'subject=?,memo=?,total_seconds=?,allocation_version=?,subject_allocations=?,saved_at=COALESCE(saved_at,?),auto_stop_seconds=CASE WHEN auto_stopped=1 THEN COALESCE(auto_stop_seconds,total_seconds) ELSE auto_stop_seconds END', [subject, b.memo.trim(), final, allocation.allocation_version, allocation.subject_allocations, nowISO()], token => [
        eventStatement(db, user, user, s.id, s.auto_stopped && final !== s.total_seconds ? 'time_review' : 'record_save', snapshot(s), after, '', token)
    ]);
    return r ? c.json({ success: true, message: '記録しました！', data: { session_id: s.id } }) : c.json(conflict(), 409);
});
timer.get('/auto-stop-count', async (c) => {
    const now = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM study_sessions WHERE user_id=? AND auto_stopped=1 AND substr(COALESCE(study_date,date(COALESCE(original_started_at,started_at),'+9 hours')),1,7)=?").bind(c.get('userId'), now).first<{
        count: number;
    }>();
    return c.json({ success: true, data: { count: row?.count ?? 0 } });
});
timer.post('/discard', async (c) => {
    const b = await c.req.json().catch(() => null);
    if (!b || !Number.isSafeInteger(b.session_id))
        return c.json({ success: false, error: '対象が正しくありません' }, 400);
    const db = c.env.DB, user = c.get('userId'), s = await db.prepare("SELECT * FROM study_sessions WHERE id=? AND user_id=? AND status='finished' AND subject IS NULL").bind(b.session_id, user).first<StudySessionRecord>();
    if (!s)
        return c.json({ success: true });
    if (s.total_seconds >= 300)
        return c.json({ success: false, error: '5分以上の未保存記録は破棄できません' }, 422);
    await db.prepare("DELETE FROM study_sessions WHERE id=? AND user_id=? AND status='finished' AND subject IS NULL AND total_seconds<300 AND revision=?").bind(s.id, user, s.revision).run();
    return c.json({ success: true });
});
export default timer;
