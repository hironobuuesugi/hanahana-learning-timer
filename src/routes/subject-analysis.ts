// /api/admin配下の既存認証・先生判定を必ず通す。
import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { analysisMonth, subjectAnalysis, summarizeSubjects, studyDaySQL, type AllocationRecord } from '../utils/subject-allocation';
const analysis = new Hono<{ Bindings: Bindings; Variables: Variables }>();
analysis.get('/', async c => {
  const month = analysisMonth(c.req.query('month'));
  if (!month) return c.json({ success: false, error: '今月以前の年月、または累計を選んでください' }, 400);
  const includeArchived = c.req.query('include_archived') === '1';
  const users = await c.env.DB.prepare(`SELECT id,user_id,display_name,archived_at FROM users WHERE user_id != ? ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY id`)
    .bind(c.env.TEACHER_USER_ID).all<{ id: number; user_id: string; display_name: string; archived_at: string | null }>();
  const rows = await c.env.DB.prepare(`SELECT ss.user_id,ss.subject,ss.total_seconds,ss.allocation_version,ss.subject_allocations FROM study_sessions ss JOIN users u ON u.id=ss.user_id
    WHERE u.user_id != ? ${includeArchived ? '' : 'AND u.archived_at IS NULL'} AND ss.status='finished' AND ss.subject IS NOT NULL ${month === 'all' ? '' : `AND substr(${studyDaySQL},1,7)=?`} ORDER BY ss.id`)
    .bind(c.env.TEACHER_USER_ID, ...(month === 'all' ? [] : [month])).all<AllocationRecord & { user_id: number }>();
  const grouped = new Map<number, AllocationRecord[]>();
  for (const row of rows.results) { if (!grouped.has(row.user_id)) grouped.set(row.user_id, []); grouped.get(row.user_id)!.push(row); }
  const data = users.results.map(u => ({ student_user_id: u.user_id, display_name: u.display_name, archived: !!u.archived_at, ...summarizeSubjects(grouped.get(u.id) ?? []) }))
    .sort((a, b) => b.total_seconds - a.total_seconds || a.display_name.localeCompare(b.display_name, 'ja') || a.student_user_id.localeCompare(b.student_user_id));
  c.header('Cache-Control', 'no-store');
  return c.json({ success: true, data, month });
});
analysis.get('/:studentUserId', async c => {
  const month = analysisMonth(c.req.query('month'));
  if (!month) return c.json({ success: false, error: '今月以前の年月、または累計を選んでください' }, 400);
  const student = await c.env.DB.prepare('SELECT id,user_id,display_name,archived_at FROM users WHERE user_id=? AND user_id!=?')
    .bind(c.req.param('studentUserId'), c.env.TEACHER_USER_ID).first<{ id: number; user_id: string; display_name: string; archived_at: string | null }>();
  if (!student) return c.json({ success: false, error: '生徒が見つかりません' }, 404);
  c.header('Cache-Control', 'no-store');
  return c.json({ success: true, data: { student_user_id: student.user_id, display_name: student.display_name, archived: !!student.archived_at, ...await subjectAnalysis(c.env.DB, student.id, month) } });
});
export default analysis;
