// /api/admin配下の既存認証・先生権限チェックを使用。
import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { nowISO, validDate } from '../utils/study-management';

const shared = new Hono<{ Bindings: Bindings; Variables: Variables }>();
type Setting = { test_date: string | null; is_visible: number; revision: number; updated_at: string | null; display_message: string; message_visible: number };
shared.get('/', async c => {
  c.header('Cache-Control', 'no-store');
  const setting = await c.env.DB.prepare('SELECT test_date,is_visible,revision,updated_at,display_message,message_visible FROM shared_test_date WHERE id=1').first<Setting>();
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE archived_at IS NULL AND user_id != ?').bind(c.env.TEACHER_USER_ID).first<{ count: number }>();
  return c.json({ success: true, data: setting, eligible_count: count?.count ?? 0 });
});
for (const method of ['post', 'patch', 'delete'] as const) shared[method]('/', async c => {
  const b = await c.req.json().catch(() => null), db = c.env.DB;
  const before = await db.prepare('SELECT test_date,is_visible,revision,updated_at,display_message,message_visible FROM shared_test_date WHERE id=1').first<Setting>();
  if (!before || !b || b.revision !== before.revision) return c.json({ success: false, error: '設定が変更されました。再読み込みしてください。' }, 409);
  const date = method === 'delete' ? null : method === 'post' ? b.test_date : before.test_date;
  const visible = method === 'delete' ? false : b.visible;
  if ((date !== null && !validDate(date)) || (method !== 'delete' && typeof visible !== 'boolean') || (method === 'post' && !date) || (visible && !date))
    return c.json({ success: false, error: '有効な日付と表示設定を確認してください。' }, 400);
  const message = method === 'delete' ? '' : b.display_message === undefined ? before.display_message : b.display_message;
  const messageVisible = b.message_visible === undefined ? !!before.message_visible : b.message_visible;
  if(typeof message !== 'string' || message.length>120 || typeof messageVisible!=='boolean')return c.json({success:false,error:'表示メッセージは120文字以内で入力してください。'},400);
  const action = method === 'delete' ? 'testdate_delete' : method === 'post' ? 'testdate_set' : visible ? 'testdate_show' : 'testdate_hide';
  const now = nowISO(), after = { test_date: date, is_visible: visible ? 1 : 0, display_message: message.trim(), message_visible: messageVisible ? 1 : 0 };
  const result = await db.batch([
    db.prepare('UPDATE shared_test_date SET test_date=?,is_visible=?,display_message=?,message_visible=?,revision=revision+1,updated_at=? WHERE id=1 AND revision=?').bind(date, after.is_visible, after.display_message, after.message_visible, now, before.revision),
    db.prepare('INSERT INTO management_events(actor_user_id,action,before_json,after_json,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(c.get('userId'), action, JSON.stringify(before), JSON.stringify(after), now),
  ]);
  if (result[0].meta.changes !== 1) return c.json({ success: false, error: '設定が変更されました。再読み込みしてください。' }, 409);
  return c.json({ success: true, message: method === 'delete' ? '共通テスト日の設定を削除しました' : method === 'patch' && !visible ? '日付を保持して非表示にしました' : '共通テスト日を更新しました' });
});
export default shared;
