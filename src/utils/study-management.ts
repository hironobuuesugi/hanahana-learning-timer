import type { StudySessionRecord } from '../types';
export const SUBJECT_CODES = ['english', 'math', 'japanese', 'science', 'social', 'other'];
export const utcMillis = (value: string) => Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
export const nowISO = () => new Date().toISOString();
export const jstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
export const validDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const ms = Date.parse(value + 'T00:00:00+09:00');
    return Number.isFinite(ms) && new Date(ms + 9 * 3600000).toISOString().slice(0, 10) === value;
};
export function subjects(value: unknown): string | null {
    return Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string' && SUBJECT_CODES.includes(v))
        ? [...new Set(value)].join(',') : null;
}
export const sessionLimit = (s: Pick<StudySessionRecord, 'time_limit_seconds'>) => s.time_limit_seconds === 7200 ? 7200 : 5400;
export const snapshot = (s: StudySessionRecord & {
    subject?: string | null;
    memo?: string | null;
    study_date?: string | null;
}) => ({
    status: s.status, started_at: s.started_at, original_started_at: s.original_started_at,
    study_date: s.study_date ?? null, total_seconds: s.total_seconds, subject: s.subject ?? null,
    memo: s.memo ?? null, auto_stopped: s.auto_stopped, auto_stop_seconds: s.auto_stop_seconds ?? null,
    time_limit_seconds: sessionLimit(s),
});
export async function studySeconds(db: D1Database, s: StudySessionRecord, at = Date.now()) {
    if (s.status === 'frozen' || s.status === 'finished')
        return Math.min(sessionLimit(s), Math.max(0, s.total_seconds));
    const pauses = (await db.prepare('SELECT pause_at, resume_at FROM session_pauses WHERE session_id = ?')
        .bind(s.id).all<{
        pause_at: string;
        resume_at: string | null;
    }>()).results;
    const paused = pauses.reduce((sum, p) => sum + Math.max(0, (p.resume_at ? utcMillis(p.resume_at) : at) - utcMillis(p.pause_at)), 0);
    return Math.min(sessionLimit(s), Math.max(0, Math.floor((at - utcMillis(s.started_at) - paused) / 1000)));
}
export function eventStatement(db: D1Database, actor: number, target: number, session: number | null, action: string, before: unknown, after: unknown, reason: string, token?: string) {
    return db.prepare(`INSERT INTO management_events (actor_user_id,target_user_id,session_id,action,before_json,after_json,reason,occurred_at)
    SELECT ?,?,?,?,?,?,?,? ${token ? 'WHERE EXISTS (SELECT 1 FROM study_sessions WHERE id = ? AND operation_token = ?)' : ''}`)
        .bind(actor, target, session, action, JSON.stringify(before), JSON.stringify(after), reason, nowISO(), ...(token ? [session, token] : []));
}
