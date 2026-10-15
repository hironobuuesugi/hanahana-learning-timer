import type { StudySessionRecord } from '../types';
import { utcMillis } from './study-management';

// updated_atや学習日から開始・終了・保存の事実を推測しない。
export async function withSessionDetails<T extends StudySessionRecord>(db: D1Database, rows: T[], at = Date.now()) {
  const pauses = new Map<number, Array<{ pause_at: string; resume_at: string | null }>>();
  const events = new Map<number, Array<{ action: string; before_json: string; after_json: string; occurred_at: string }>>();
  for (let i = 0; i < rows.length; i += 80) {
    const ids = rows.slice(i, i + 80).map(s => s.id), placeholders = ids.map(() => '?').join(',');
    if (!ids.length) continue;
    const p = await db.prepare(`SELECT session_id,pause_at,resume_at FROM study_pause_history WHERE session_id IN (${placeholders}) ORDER BY original_pause_id`).bind(...ids).all<{ session_id: number; pause_at: string; resume_at: string | null }>();
    const e = await db.prepare(`SELECT session_id,action,before_json,after_json,occurred_at FROM management_events WHERE session_id IN (${placeholders}) AND action IN ('teacher_finish','teacher_record','record_save','time_review','record_add') ORDER BY id`).bind(...ids).all<{ session_id: number; action: string; before_json: string; after_json: string; occurred_at: string }>();
    for (const row of p.results) { if (!pauses.has(row.session_id)) pauses.set(row.session_id, []); pauses.get(row.session_id)!.push(row); }
    for (const row of e.results) { if (!events.has(row.session_id)) events.set(row.session_id, []); events.get(row.session_id)!.push(row); }
  }
  return rows.map(s => {
    const manual = s.record_source === 'teacher', history = pauses.get(s.id) ?? [], changes = events.get(s.id) ?? [];
    const firstSave = changes.find(e => {
      if (e.action === 'record_add') return true;
      try { return !JSON.parse(e.before_json).subject && !!JSON.parse(e.after_json).subject; } catch { return false; }
    });
    const complete = !manual && s.history_tracked === 1;
    const openPause = [...history].reverse().find(p => p.resume_at === null);
    const end = manual ? null : s.finished_at;
    const pauseSeconds = complete ? history.reduce((sum, p) => sum + Math.max(0, Math.floor(((p.resume_at ? utcMillis(p.resume_at) : at) - utcMillis(p.pause_at)) / 1000)), 0) : null;
    return { ...s, timeline: {
      manual, history_complete: complete,
      started_at: manual ? null : s.original_started_at,
      paused_at: s.status === 'paused' ? openPause?.pause_at ?? null : null,
      stopped_at: s.status === 'paused' ? openPause?.pause_at ?? null : s.status === 'frozen' ? s.frozen_at : end,
      finished_at: end,
      saved_at: s.subject ? s.saved_at ?? firstSave?.occurred_at ?? null : null,
      pause_count: complete ? history.length : null, pause_seconds: pauseSeconds,
      finish_kind: changes.some(e => e.action === 'teacher_finish') ? 'teacher' : s.auto_stopped ? 'auto' : 'normal',
    } };
  });
}
