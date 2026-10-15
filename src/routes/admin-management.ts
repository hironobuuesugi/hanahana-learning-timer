// /api/admin配下で既存の認証・先生権限チェックを受ける。
import { Hono } from 'hono';
import type { Bindings, Variables, StudySessionRecord } from '../types';
import { settleDue } from './timer';
import { withSessionDetails } from '../utils/session-details';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { eventStatement, jstToday, nowISO, snapshot, studySeconds, subjects, validDate, utcMillis } from '../utils/study-management';
const management = new Hono<{
    Bindings: Bindings;
    Variables: Variables;
}>();
type Student = {
    id: number;
    user_id: string;
    display_name: string;
    archived_at: string | null;
    management_revision: number;
};
const dateSQL = "COALESCE(ss.study_date, date(COALESCE(ss.original_started_at, ss.started_at), '+9 hours'))";
async function student(db: D1Database, userId: string, teacher: string | undefined) {
    if (userId === teacher)
        return null;
    return db.prepare('SELECT id,user_id,display_name,archived_at,management_revision FROM users WHERE user_id = ?').bind(userId).first<Student>();
}
const positiveId = (s: string) => /^\d+$/.test(s) && Number.isSafeInteger(Number(s)) && Number(s) > 0 ? Number(s) : null;
const reasonText = (v: unknown) => typeof v === 'string' ? v.trim().slice(0, 500) : '';
management.get('/monthly-students', async (c) => {
    const month = c.req.query('month') ?? jstToday().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        return c.json({ success: false, error: '年月が正しくありません' }, 400);
    const archived = c.req.query('archived') === '1';
    const rows = await c.env.DB.prepare(`SELECT u.id,u.user_id,u.display_name,u.archived_at,u.management_revision,
    COALESCE(SUM(CASE WHEN ss.status='finished' AND ss.subject IS NOT NULL AND substr(${dateSQL},1,7)=? THEN ss.total_seconds ELSE 0 END),0) AS month_seconds,
    COUNT(DISTINCT CASE WHEN ss.status='finished' AND ss.subject IS NOT NULL AND substr(${dateSQL},1,7)=? THEN ${dateSQL} END) AS study_days
    FROM users u LEFT JOIN study_sessions ss ON ss.user_id=u.id
    WHERE u.user_id != ? AND u.archived_at IS ${archived ? 'NOT' : ''} NULL
    GROUP BY u.id ORDER BY month_seconds DESC,u.display_name COLLATE BINARY ASC,u.id ASC`)
        .bind(month, month, c.env.TEACHER_USER_ID).all();
    return c.json({ success: true, data: rows.results, month });
});
management.get('/student/:studentUserId/records', async (c) => {
    const s = await student(c.env.DB, c.req.param('studentUserId'), c.env.TEACHER_USER_ID);
    if (!s)
        return c.json({ success: false, error: '生徒が見つかりません' }, 404);
    const offset = Number(c.req.query('offset') ?? 0), month = c.req.query('month') ?? '';
    if (!Number.isSafeInteger(offset) || offset < 0 || (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))
        return c.json({ success: false, error: '検索条件が正しくありません' }, 400);
    const rows = await c.env.DB.prepare(`SELECT ss.*,${dateSQL} AS learning_date FROM study_sessions ss
    WHERE ss.user_id=? AND ss.status='finished' AND ss.subject IS NOT NULL
    ${month ? `AND substr(${dateSQL},1,7)=?` : ''} ORDER BY learning_date DESC,ss.id DESC LIMIT 31 OFFSET ?`)
        .bind(s.id, ...(month ? [month] : []), offset).all<StudySessionRecord>();
    return c.json({ success: true, data: await withSessionDetails(c.env.DB, rows.results.slice(0, 30)), has_more: rows.results.length > 30, student: s });
});
management.post('/student/:studentUserId/records', async (c) => {
    const db = c.env.DB, s = await student(db, c.req.param('studentUserId'), c.env.TEACHER_USER_ID);
    if (!s)
        return c.json({ success: false, error: '生徒が見つかりません' }, 404);
    if (s.archived_at)
        return c.json({ success: false, error: 'アーカイブを解除してから追加してください' }, 409);
    const b = await c.req.json().catch(() => null), subject = subjects(b?.subjects);
    if (!b || !validDate(b.study_date) || b.study_date > jstToday() || !subject || !Number.isSafeInteger(b.total_seconds) || b.total_seconds < 300 || b.total_seconds > 86400 || typeof b.memo !== 'string' || !b.memo.trim() || b.memo.length > 500)
        return c.json({ success: false, error: '日付・教科・5分以上の時間・500文字以内の内容を確認してください' }, 400);
    // 手入力の日付を時刻の事実として扱わない。study_dateが所属日、sourceが手入力であることを表す。
    const requestKey = b.request_id ?? crypto.randomUUID();
    if (typeof requestKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestKey))
        return c.json({success:false,error:'操作をやり直してください'},400);
    const prior = await db.prepare("SELECT id FROM management_events WHERE request_key=? AND actor_user_id=? AND target_user_id=? AND action='record_add'").bind(requestKey,c.get('userId'),s.id).first();
    if (prior) return c.json({success:true,message:'この学習記録は保存済みです'});
    const nominal = new Date(b.study_date + 'T00:00:00+09:00').toISOString(), token = requestKey, now = nowISO();
    const after = { study_date: b.study_date, total_seconds: b.total_seconds, subject, memo: b.memo.trim(), record_source: 'teacher' };
    const result = await db.batch([
        db.prepare(`INSERT INTO study_sessions(user_id,status,started_at,original_started_at,finished_at,total_seconds,subject,memo,study_date,record_source,operation_token,updated_at,saved_at)
      SELECT ?,'finished',?,?,?, ?,?,?,?,'teacher',?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND archived_at IS NULL AND management_revision=?)
      AND NOT EXISTS(SELECT 1 FROM management_events WHERE request_key=?)`)
            .bind(s.id, nominal, nominal, now, b.total_seconds, subject, b.memo.trim(), b.study_date, token, now, now, s.id, s.management_revision,requestKey),
        db.prepare(`INSERT INTO management_events(actor_user_id,target_user_id,session_id,action,after_json,reason,occurred_at,request_key)
      SELECT ?,user_id,id,'record_add',?,?,?,? FROM study_sessions WHERE operation_token=? AND NOT EXISTS(SELECT 1 FROM management_events WHERE request_key=?)`)
            .bind(c.get('userId'), JSON.stringify(after), reasonText(b.reason), now,requestKey, token,requestKey),
    ]);
    if (result[0].meta.changes !== 1) {
        const saved=await db.prepare('SELECT id FROM management_events WHERE request_key=? AND actor_user_id=? AND target_user_id=?').bind(requestKey,c.get('userId'),s.id).first();
        if(saved)return c.json({success:true,message:'この学習記録は保存済みです'});
        return c.json({ success: false, error: '生徒の状態が変わりました。再読込してください' }, 409);
    }
    return c.json({ success: true, message: '学習記録を保存しました' }, 201);
});
management.patch('/records/:id', async (c) => {
    const db = c.env.DB, id = positiveId(c.req.param('id')), b = await c.req.json().catch(() => null);
    const row = id ? await db.prepare('SELECT ss.* FROM study_sessions ss JOIN users u ON u.id=ss.user_id WHERE ss.id=? AND u.user_id != ?').bind(id, c.env.TEACHER_USER_ID).first<StudySessionRecord>() : null;
    if (!row || row.status !== 'finished' || !row.subject)
        return c.json({ success: false, error: '保存済み記録が見つかりません' }, 404);
    const subject = subjects(b?.subjects);
    if (!b || b.revision !== row.revision || !validDate(b.study_date) || b.study_date > jstToday() || !subject || !Number.isSafeInteger(b.total_seconds) || b.total_seconds < 300 || b.total_seconds > 86400 || typeof b.memo !== 'string' || !b.memo.trim() || b.memo.length > 500)
        return c.json({ success: false, error: '入力または記録の更新状態を確認してください。再読込が必要な場合があります' }, 409);
    const token = crypto.randomUUID(), after = { ...snapshot(row), study_date: b.study_date, total_seconds: b.total_seconds, subject, memo: b.memo.trim() };
    const result = await db.batch([
        db.prepare(`UPDATE study_sessions SET study_date=?,total_seconds=?,subject=?,memo=?,updated_at=?,revision=revision+1,operation_token=? WHERE id=? AND revision=? AND status='finished' AND subject IS NOT NULL`)
            .bind(b.study_date, b.total_seconds, subject, b.memo.trim(), nowISO(), token, row.id, row.revision),
        eventStatement(db, c.get('userId'), row.user_id, row.id, 'record_edit', snapshot(row), after, reasonText(b.reason), token),
    ]);
    if (result[0].meta.changes !== 1)
        return c.json({ success: false, error: '別の操作で変更されました。再読込してください' }, 409);
    return c.json({ success: true, message: '学習記録を修正しました' });
});
management.delete('/records/:id', async (c) => {
    const db = c.env.DB, id = positiveId(c.req.param('id')), b = await c.req.json().catch(() => null);
    const row = id ? await db.prepare('SELECT ss.* FROM study_sessions ss JOIN users u ON u.id=ss.user_id WHERE ss.id=? AND u.user_id != ?').bind(id, c.env.TEACHER_USER_ID).first<StudySessionRecord>() : null;
    if (!row || row.status !== 'finished' || !row.subject)
        return c.json({ success: false, error: '保存済み記録が見つかりません' }, 404);
    if (!b || b.revision !== row.revision || !reasonText(b.reason))
        return c.json({ success: false, error: '削除理由を入力し、最新の記録を確認してください' }, 409);
    const result = await db.batch([
        db.prepare(`INSERT INTO management_events(actor_user_id,target_user_id,session_id,action,before_json,reason,occurred_at)
      SELECT ?,user_id,id,'record_delete',?,?,? FROM study_sessions WHERE id=? AND revision=? AND status='finished' AND subject IS NOT NULL`)
            .bind(c.get('userId'), JSON.stringify(snapshot(row)), reasonText(b.reason), nowISO(), row.id, row.revision),
        db.prepare('DELETE FROM study_sessions WHERE id=? AND revision=? AND changes()=1').bind(row.id, row.revision),
    ]);
    if (result[1].meta.changes !== 1)
        return c.json({ success: false, error: '記録の状態が変わりました。再読込してください' }, 409);
    return c.json({ success: true, message: '学習記録を削除しました' });
});
management.get('/timers', async (c) => {
    const db = c.env.DB;
    const activeUsers = await db.prepare("SELECT DISTINCT user_id FROM study_sessions WHERE status IN ('running','paused','frozen')").all<{
        user_id: number;
    }>();
    for (const user of activeUsers.results)
        await settleDue(db, user.user_id);
    const rows = await db.prepare(`SELECT ss.*,u.user_id AS student_user_id,u.display_name FROM study_sessions ss JOIN users u ON u.id=ss.user_id
    WHERE u.user_id != ? AND (ss.status IN ('running','paused','frozen') OR (ss.status='finished' AND ss.subject IS NULL AND ss.total_seconds>=300))
    ORDER BY ss.user_id,CASE WHEN ss.status='finished' THEN 1 ELSE 0 END,ss.finished_at,ss.id`).bind(c.env.TEACHER_USER_ID).all<StudySessionRecord & {
        student_user_id: string;
        display_name: string;
    }>();
    const observed = Date.now();
    const data = await Promise.all((await withSessionDetails(db, rows.results, observed)).map(async row => ({ ...row,
        measured_seconds: await studySeconds(db, row, observed),
        waiting_seconds: row.status === 'finished' && row.finished_at ? Math.max(0, Math.floor((observed - utcMillis(row.finished_at)) / 1000)) : null,
    })));
    return c.json({ success: true, data, observed_at: nowISO() });
});
management.post('/timers/:id/finish', async (c) => {
    const db = c.env.DB, id = positiveId(c.req.param('id')), b = await c.req.json().catch(() => null);
    const row = id ? await db.prepare('SELECT ss.* FROM study_sessions ss JOIN users u ON u.id=ss.user_id WHERE ss.id=? AND u.user_id != ?').bind(id, c.env.TEACHER_USER_ID).first<StudySessionRecord>() : null;
    if (!row || !['running', 'paused', 'frozen'].includes(row.status))
        return c.json({ success: false, error: '終了できるタイマーがありません' }, 409);
    const measured = await studySeconds(db, row);
    if (!Number.isFinite(measured) || !b || b.revision !== row.revision || !Number.isSafeInteger(b.total_seconds) || b.total_seconds < row.total_seconds || b.total_seconds > measured || !reasonText(b.reason))
        return c.json({ success: false, error: '保全済み時間以上・計測値以下の学習時間と終了理由を指定してください' }, 409);
    const token = crypto.randomUUID(), now = nowISO(), after = { ...snapshot(row), status: 'finished', total_seconds: b.total_seconds };
    const result = await db.batch([
        db.prepare(`UPDATE study_sessions SET status='finished',finished_at=?,total_seconds=?,updated_at=?,revision=revision+1,operation_token=? WHERE id=? AND revision=? AND status=?`)
            .bind(now, b.total_seconds, now, token, row.id, row.revision, row.status),
        db.prepare(`UPDATE session_pauses SET resume_at=? WHERE session_id=? AND resume_at IS NULL AND EXISTS(SELECT 1 FROM study_sessions WHERE id=? AND operation_token=?)`).bind(now, row.id, row.id, token),
        eventStatement(db, c.get('userId'), row.user_id, row.id, 'teacher_finish', { ...snapshot(row), measured_seconds: measured }, after, reasonText(b.reason), token),
    ]);
    if (result[0].meta.changes !== 1)
        return c.json({ success: false, error: '生徒が同時に操作しました。再読込してください' }, 409);
    return c.json({ success: true, message: 'タイマーを終了しました。5分以上の記録は未保存として保全しました' });
});
management.post('/timers/:id/record', async (c) => {
    const db = c.env.DB, id = positiveId(c.req.param('id')), b = await c.req.json().catch(() => null);
    const row = id ? await db.prepare('SELECT ss.* FROM study_sessions ss JOIN users u ON u.id=ss.user_id WHERE ss.id=? AND u.user_id != ?').bind(id, c.env.TEACHER_USER_ID).first<StudySessionRecord>() : null;
    if (!row || row.status !== 'finished' || row.subject !== null || row.total_seconds < 300)
        return c.json({ success: false, error: '未保存記録が見つかりません' }, 409);
    const subject = subjects(b?.subjects);
    if (!b || b.revision !== row.revision || !subject || typeof b.memo !== 'string' || !b.memo.trim() || b.memo.length > 500 || !reasonText(b.reason))
        return c.json({ success: false, error: '教科・内容・代理保存理由を確認してください' }, 400);
    const seconds=b.total_seconds ?? row.total_seconds;
    if(!Number.isSafeInteger(seconds)||seconds<300||seconds>row.total_seconds)
        return c.json({success:false,error:'5分以上・元の未保存時間以下で指定してください'},422);
    const token = crypto.randomUUID(), after = { ...snapshot(row), subject, memo: b.memo.trim(),total_seconds:seconds,auto_stop_seconds:row.auto_stopped?(row.auto_stop_seconds??row.total_seconds):row.auto_stop_seconds };
    const result = await db.batch([
        db.prepare(`UPDATE study_sessions SET subject=?,memo=?,total_seconds=?,auto_stop_seconds=CASE WHEN auto_stopped=1 THEN COALESCE(auto_stop_seconds,total_seconds) ELSE auto_stop_seconds END,saved_at=COALESCE(saved_at,?),updated_at=?,revision=revision+1,operation_token=? WHERE id=? AND revision=? AND status='finished' AND subject IS NULL
      AND id=(SELECT id FROM study_sessions WHERE user_id=? AND status='finished' AND subject IS NULL AND total_seconds>=300 ORDER BY finished_at,id LIMIT 1)`)
            .bind(subject, b.memo.trim(),seconds, nowISO(), nowISO(), token, row.id, row.revision, row.user_id),
        eventStatement(db, c.get('userId'), row.user_id, row.id, 'teacher_record', snapshot(row), after, reasonText(b.reason), token),
    ]);
    if (result[0].meta.changes !== 1)
        return c.json({ success: false, error: '先に古い未保存記録を保存するか、最新の状態を確認してください' }, 409);
    return c.json({ success: true, message: '学習記録を保存しました' });
});
const attention = (alias='') => `(${alias}action IN ('auto_stop','time_review') OR (${alias}action IN ('record_edit','teacher_record') AND json_extract(${alias}before_json,'$.auto_stopped')=1 AND json_extract(${alias}before_json,'$.total_seconds') IS NOT json_extract(${alias}after_json,'$.total_seconds')))`;
const unreadAttention = () => `${attention('e.')} AND e.id=(SELECT MAX(e2.id) FROM management_events e2 WHERE e2.session_id=e.session_id AND e2.id<=? AND ${attention('e2.')})
  AND e.id<=? AND e.id>MAX(COALESCE((SELECT last_event_id FROM teacher_event_reads WHERE teacher_user_id=?),0),
  COALESCE((SELECT last_event_id FROM teacher_student_event_reads WHERE teacher_user_id=? AND student_user_id=e.target_user_id),0))`;
management.get('/attention', async c => {
    const db=c.env.DB, teacher=c.get('userId'), offset=Number(c.req.query('offset')??0);
    if(!Number.isSafeInteger(offset)||offset<0) return c.json({success:false,error:'検索条件が正しくありません'},400);
    await db.prepare(`INSERT OR IGNORE INTO teacher_event_reads(teacher_user_id,last_event_id) SELECT ?,COALESCE(MAX(id),0) FROM management_events WHERE json_extract(after_json,'$.legacy')=1`).bind(teacher).run();
    const max=await db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM management_events').first<{id:number}>();
    const through=max?.id??0;
    const rows=await db.prepare(`SELECT e.*,u.user_id AS student_user_id,u.display_name,ss.subject,ss.total_seconds,ss.status,ss.auto_stop_seconds,
      COALESCE(ss.study_date,date(COALESCE(ss.original_started_at,ss.started_at),'+9 hours')) AS learning_date
      FROM management_events e JOIN users u ON u.id=e.target_user_id LEFT JOIN study_sessions ss ON ss.id=e.session_id
      WHERE ${unreadAttention()} ORDER BY e.id DESC LIMIT 31 OFFSET ?`).bind(through,through,teacher,teacher,offset).all();
    const count=await db.prepare(`SELECT COUNT(*) AS count FROM management_events e JOIN users u ON u.id=e.target_user_id WHERE ${unreadAttention()}`).bind(through,through,teacher,teacher).first<{count:number}>();

    return c.json({success:true,data:rows.results.slice(0,30),has_more:rows.results.length>30,new_count:count?.count??0,read_through:max?.id??0});
});
management.post('/attention/read', async c => {
    const b=await c.req.json().catch(()=>null), db=c.env.DB;
    if(!b||typeof b.student_user_id!=='string'||!Number.isSafeInteger(b.read_through)||b.read_through<0)
      return c.json({success:false,error:'確認した生徒と既読位置を指定してください'},400);
    const target=await student(db,b.student_user_id,c.env.TEACHER_USER_ID);
    if(!target)return c.json({success:false,error:'生徒が見つかりません'},404);
    await db.prepare(`INSERT INTO teacher_student_event_reads(teacher_user_id,student_user_id,last_event_id)
      VALUES(?,?,MIN(?,(SELECT COALESCE(MAX(id),0) FROM management_events)))
      ON CONFLICT(teacher_user_id,student_user_id) DO UPDATE SET last_event_id=MAX(last_event_id,excluded.last_event_id)`)
      .bind(c.get('userId'),target.id,b.read_through).run();
    return c.json({success:true});
});
management.post('/attention/read-all', async c => {
    const b=await c.req.json().catch(()=>null);
    if(!b||!Number.isSafeInteger(b.read_through)||b.read_through<0)return c.json({success:false,error:'確認対象の新着位置を指定してください'},400);
    await c.env.DB.prepare(`INSERT INTO teacher_event_reads(teacher_user_id,last_event_id)
      VALUES(?,MIN(?,(SELECT COALESCE(MAX(id),0) FROM management_events)))
      ON CONFLICT(teacher_user_id) DO UPDATE SET last_event_id=MAX(last_event_id,excluded.last_event_id)`)
      .bind(c.get('userId'),b.read_through).run();
    return c.json({success:true,message:'すべて既読にしました'});
});
management.get('/history', async (c) => {
    const offset = Number(c.req.query('offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0)
        return c.json({ success: false, error: '検索条件が正しくありません' }, 400);
    const rows = await c.env.DB.prepare(`SELECT e.*,u.display_name,u.user_id AS student_user_id,a.display_name AS actor_name FROM management_events e
    LEFT JOIN users u ON u.id=e.target_user_id LEFT JOIN users a ON a.id=e.actor_user_id ORDER BY e.id DESC LIMIT 31 OFFSET ?`).bind(offset).all();
    return c.json({ success: true, data: rows.results.slice(0, 30), has_more: rows.results.length > 30 });
});
management.post('/accounts/:studentUserId/archive', async (c) => {
    const db = c.env.DB, s = await student(db, c.req.param('studentUserId'), c.env.TEACHER_USER_ID), b = await c.req.json().catch(() => null);
    if (!s)
        return c.json({ success: false, error: '生徒が見つかりません' }, 404);
    if (!b || typeof b.archived !== 'boolean' || b.revision !== s.management_revision)
        return c.json({ success: false, error: '最新の生徒の状態を確認してください' }, 409);
    if (b.archived === !!s.archived_at)
        return c.json({ success: true, message: 'すでに指定の状態です' });
    const at = b.archived ? nowISO() : null;
    const result = await db.batch([
        db.prepare(`UPDATE users SET archived_at=?,management_revision=management_revision+1 WHERE id=? AND management_revision=?
      AND NOT EXISTS(SELECT 1 FROM study_sessions WHERE user_id=? AND (status IN ('running','paused','frozen') OR (status='finished' AND subject IS NULL AND total_seconds>=300)))`)
            .bind(at, s.id, s.management_revision, s.id),
        db.prepare(`INSERT INTO management_events(actor_user_id,target_user_id,action,before_json,after_json,occurred_at)
      SELECT ?,?,?,?, ?,? WHERE changes()=1`).bind(c.get('userId'), s.id, b.archived ? 'archive' : 'unarchive', JSON.stringify({ archived_at: s.archived_at }), JSON.stringify({ archived_at: at }), nowISO()),
        db.prepare(`DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND archived_at IS NOT NULL AND management_revision=?)`).bind(s.id, s.id, s.management_revision + 1),
    ]);
    if (result[0].meta.changes !== 1)
        return c.json({ success: false, error: '稼働中・未保存の記録を先に処理するか、状態を再取得してください' }, 409);
    return c.json({ success: true, message: b.archived ? 'アーカイブしました' : 'アーカイブを解除しました' });
});
management.post('/accounts/:studentUserId/delete-check', async (c) => {
    const db = c.env.DB, s = await student(db, c.req.param('studentUserId'), c.env.TEACHER_USER_ID), b = await c.req.json().catch(() => null);
    if (!s || !s.archived_at)
        return c.json({ success: false, error: '先に対象生徒をアーカイブしてください' }, 409);
    const teacher = await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(c.get('userId')).first<{
        password_hash: string;
    }>();
    if (!teacher || typeof b?.password !== 'string' || !await verifyPassword(b.password, teacher.password_hash))
        return c.json({ success: false, error: '先生のログインパスワードを確認してください' }, 403);
    const token = crypto.randomUUID(), expiry = new Date(Date.now() + 5 * 60000).toISOString();
    await db.prepare(`INSERT INTO teacher_event_reads(teacher_user_id,last_event_id,delete_target_id,delete_target_revision,delete_token_hash,delete_expires_at)
    VALUES(?,(SELECT COALESCE(MAX(id),0) FROM management_events),?,?,?,?) ON CONFLICT(teacher_user_id) DO UPDATE SET delete_target_id=excluded.delete_target_id,delete_target_revision=excluded.delete_target_revision,delete_token_hash=excluded.delete_token_hash,delete_expires_at=excluded.delete_expires_at`)
        .bind(c.get('userId'), s.id, s.management_revision, await hashPassword(token), expiry).run();
    return c.json({ success: true, token });
});
management.delete('/accounts/:studentUserId', async (c) => {
    const db = c.env.DB, s = await student(db, c.req.param('studentUserId'), c.env.TEACHER_USER_ID), b = await c.req.json().catch(() => null);
    if (!s || !s.archived_at || typeof b?.token !== 'string' || b.revision !== s.management_revision)
        return c.json({ success: false, error: '対象と再認証を確認してください' }, 409);
    const tokenHash = await hashPassword(b.token), teacher = c.get('userId');
    const confirmation = await db.prepare(`SELECT teacher_user_id FROM teacher_event_reads WHERE teacher_user_id=? AND delete_target_id=? AND delete_target_revision=? AND delete_token_hash=? AND delete_expires_at>?`)
        .bind(teacher, s.id, s.management_revision, tokenHash, nowISO()).first();
    if (!confirmation)
        return c.json({ success: false, error: '再認証の期限が切れたか、対象が変わりました。やり直してください' }, 403);
    const result = await db.batch([
        db.prepare(`UPDATE teacher_event_reads SET delete_token_hash=NULL,delete_expires_at=NULL WHERE teacher_user_id=? AND delete_target_id=? AND delete_target_revision=? AND delete_token_hash=? AND delete_expires_at>?
      AND EXISTS(SELECT 1 FROM users WHERE id=? AND archived_at IS NOT NULL AND management_revision=?)`).bind(teacher, s.id, s.management_revision, tokenHash, nowISO(), s.id, s.management_revision),
        db.prepare(`INSERT INTO management_events(actor_user_id,action,reason,occurred_at) SELECT ?,'account_delete','関連データ・履歴内の個人情報を削除',? WHERE changes()=1`).bind(teacher, nowISO()),
        db.prepare(`DELETE FROM login_logs WHERE user_id=? AND EXISTS(SELECT 1 FROM teacher_event_reads WHERE teacher_user_id=? AND delete_target_id=? AND delete_token_hash IS NULL)`).bind(s.id, teacher, s.id),
        db.prepare(`DELETE FROM teacher_comments WHERE student_user_id=? AND EXISTS(SELECT 1 FROM teacher_event_reads WHERE teacher_user_id=? AND delete_target_id=? AND delete_token_hash IS NULL)`).bind(s.user_id, teacher, s.id),
        db.prepare(`UPDATE management_events SET actor_user_id=CASE WHEN actor_user_id=? THEN NULL ELSE actor_user_id END,target_user_id=NULL,session_id=NULL,before_json='{}',after_json='{}',reason='個人情報削除済み'
      WHERE (target_user_id=? OR actor_user_id=?) AND EXISTS(SELECT 1 FROM teacher_event_reads WHERE teacher_user_id=? AND delete_target_id=? AND delete_token_hash IS NULL)`).bind(s.id, s.id, s.id, teacher, s.id),
        db.prepare(`DELETE FROM users WHERE id=? AND management_revision=? AND archived_at IS NOT NULL AND EXISTS(SELECT 1 FROM teacher_event_reads WHERE teacher_user_id=? AND delete_target_id=? AND delete_token_hash IS NULL)`)
            .bind(s.id, s.management_revision, teacher, s.id),
        db.prepare('UPDATE teacher_event_reads SET delete_target_id=NULL,delete_target_revision=NULL WHERE teacher_user_id=?').bind(teacher),
    ]);
    if (result[0].meta.changes !== 1 || result[5].meta.changes !== 1)
        return c.json({ success: false, error: '対象の状態が変わりました。再認証してください' }, 409);
    return c.json({ success: true, message: 'アカウントと関連データを完全削除しました' });
});
export default management;
